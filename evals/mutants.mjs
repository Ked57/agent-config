#!/usr/bin/env node
// Mutation gate for hidden tests and task checks (`npm run eval:mutants`). For every task with a
// `mutants/<task>/manifest.json` under its fixture, applies each reference, known-failing and mutant
// patch to a fresh copy of the prepared fixture and scores the task's checks exactly as a recheck
// does. Fails when a reference fails, the untouched fixture passes, a mutant expected to be killed
// survives, or a task kills fewer than 80% of its mutants. No agent or model calls.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { copyForRun, loadFixture, preparePristine } from './lib/fixtures.mjs';
import { ensureDesignAssets } from './lib/design-assets.mjs';
import { checkScore, requiredScore } from './lib/checks.mjs';
import { diffAgainstPristine, recheckRun } from './lib/measure.mjs';
import { declaredKillRate, normalisePatch, scoreTask, validateManifest } from './lib/mutants.mjs';

const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SANDBOX = process.env.AGENT_CONFIG_EVALS_SANDBOX ?? '/var/tmp/agent-config-evals';
// Left behind by hand-built mutant apps and by running hidden tests in them; never part of a patch.
const PATCH_EXCLUDES = ['.eval-ready', '.eval-manifest.json', '__hidden__', '.vite', '.vite-temp', '.vitest-cache', '*.out'];

const USAGE = `Usage: npm run eval:mutants -- [options]

  --set <name>         only this task set (repeatable; default: every set in evals/tasks/)
  --fixture <name>     only task sets on this fixture
  --task <id>          only this task (repeatable)
  --concurrency <n>    parallel checks (default 4)
  --json <file>        also write the results as JSON
  --keep               keep the scratch copies under ${SANDBOX}/mutants/
  --make-patch <app>   print the patch of a worked app against the fixture (needs --fixture) and exit`;

/** Mean required-check scores for the gate table: references; untouched fixture; mutants (plus the score gate when set). */
function scoreLine(manifest, byFile) {
  const shown = (file) => (typeof byFile.get(file)?.score === 'number' ? byFile.get(file).score.toFixed(2) : '–');
  const gate = manifest.scoreGate ? ` (gate: ref ≥ ${manifest.scoreGate.referenceMin}, untouched ≤ ${manifest.scoreGate.untouchedMax}, drop ≥ ${manifest.scoreGate.mutantMaxDrop})` : '';
  return `${(manifest.references ?? []).map((reference) => shown(reference.file)).join(' ')}; ${shown(null)}; ${manifest.mutants.map((mutant) => shown(mutant.file)).join(' ')}${gate}`;
}

/** Reads the task's manifest and lists its directory; null when the task has no mutants. */
export function taskMutants(fixture, task) {
  const dir = path.join(fixture.dir, 'mutants', task.id);
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  return { dir, manifest: JSON.parse(fs.readFileSync(file, 'utf8')), files: fs.readdirSync(dir) };
}

/** Every task set in `evals/tasks/`, with its fixture. */
export function loadTaskSets() {
  return fs.readdirSync(path.join(EVALS_DIR, 'tasks')).filter((file) => file.endsWith('.json')).sort().map((file) => {
    const taskSet = JSON.parse(fs.readFileSync(path.join(EVALS_DIR, 'tasks', file), 'utf8'));
    return { taskSet, fixture: loadFixture(taskSet.fixture) };
  });
}

/** The patch of a worked app against `base` (the template), in the stable form `normalisePatch` gives. */
function makePatch(fixture, base, app) {
  const raw = diffAgainstPristine({ ...fixture, diffExclude: [...fixture.diffExclude, ...PATCH_EXCLUDES] }, base, path.resolve(app));
  return normalisePatch(raw);
}

/** Worker: copy the fixture, apply one patch, run the task's checks, report. */
function runJob({ fixtureName, pristine, scratch, task, patch, label, install }) {
  const fixture = loadFixture(fixtureName);
  const runDir = path.join(scratch, 'jobs', `${task.id}__${label}`.replace(/[^A-Za-z0-9._-]+/g, '_'));
  const app = path.join(runDir, 'app');
  const started = Date.now();
  try {
    copyForRun(fixture, pristine, app);
    if (patch) {
      const applied = spawnSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: app, encoding: 'utf8' });
      if (applied.status !== 0) return { error: `does not apply: ${applied.stderr.trim()}`, ms: Date.now() - started };
      if (install && /^\+\+\+ b\/package\.json$/m.test(fs.readFileSync(patch, 'utf8'))) {
        fs.rmSync(path.join(app, 'node_modules'), { recursive: true, force: true });
        const installed = spawnSync('sh', ['-c', install], { cwd: app, encoding: 'utf8' });
        if (installed.status !== 0) return { error: `${install} failed: ${(installed.stderr || installed.stdout).trim().slice(-400)}`, ms: Date.now() - started };
      }
    }
    fs.writeFileSync(path.join(runDir, 'diff.patch'), diffAgainstPristine(fixture, pristine, app));
    const checks = recheckRun({ fixture, app, runDir, task });
    const required = checks.filter((check) => (check.level ?? 'required') === 'required');
    const failed = required.filter((check) => !check.pass || (check.total !== undefined && check.passed !== check.total));
    return {
      pass: failed.length === 0,
      score: requiredScore(required),
      checkScores: Object.fromEntries(required.map((check) => [check.id, checkScore(check)])),
      failed: failed.map((check) => check.id),
      details: Object.fromEntries(failed.map((check) => [check.id, String(check.detail ?? '').slice(-400)])),
      ms: Date.now() - started
    };
  } catch (error) {
    return { error: String(error?.stack ?? error), ms: Date.now() - started };
  } finally {
    if (!workerData.keep) fs.rmSync(runDir, { recursive: true, force: true });
  }
}

if (!isMainThread) {
  parentPort.on('message', (job) => parentPort.postMessage({ key: job.key, result: runJob(job) }));
}

function parseArgs(argv) {
  const options = { sets: [], tasks: [], concurrency: 4, keep: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--set') options.sets.push(value());
    else if (arg === '--task') options.tasks.push(...value().split(','));
    else if (arg === '--fixture') options.fixture = value();
    else if (arg === '--concurrency') options.concurrency = Math.max(1, Number.parseInt(value(), 10) || 1);
    else if (arg === '--json') options.json = path.resolve(value());
    else if (arg === '--make-patch') options.makePatch = value();
    else if (arg === '--keep') options.keep = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}\n\n${USAGE}`);
  }
  return options;
}

const pool = (size, scratch, keep) => {
  const workers = Array.from({ length: size }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { keep } }));
  return {
    async run(jobs, onResult) {
      const queue = [...jobs];
      await Promise.all(workers.map((worker) => new Promise((resolve, reject) => {
        const next = () => {
          const job = queue.shift();
          if (!job) return resolve();
          worker.once('message', ({ key, result }) => {
            onResult(key, result);
            next();
          });
          worker.postMessage({ ...job, scratch });
        };
        worker.once('error', reject);
        next();
      })));
    },
    close: () => Promise.all(workers.map((worker) => worker.terminate()))
  };
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return console.log(USAGE);
  const scratch = path.join(SANDBOX, 'mutants', `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  fs.mkdirSync(path.join(scratch, 'tmp'), { recursive: true });
  // Hidden tests create temp databases; keep them in the scratch dir so nothing outlives the gate.
  process.env.TMPDIR = path.join(scratch, 'tmp');
  const quiet = () => {};
  try {
    if (options.makePatch) {
      if (!options.fixture) throw new Error('--make-patch needs --fixture');
      const fixture = loadFixture(options.fixture);
      process.stdout.write(makePatch(fixture, fixture.templateDir, options.makePatch));
      return;
    }
    const started = Date.now();
    const errors = [];
    const tasks = [];
    for (const { taskSet, fixture } of loadTaskSets()) {
      if (options.sets.length && !options.sets.includes(taskSet.name)) continue;
      if (options.fixture && fixture.name !== options.fixture) continue;
      if (!fs.existsSync(path.join(fixture.dir, 'mutants'))) continue;
      for (const task of taskSet.tasks) {
        if (options.tasks.length && !options.tasks.includes(task.id)) continue;
        const found = taskMutants(fixture, task);
        if (!found) continue;
        const problems = validateManifest(found.manifest, task.id, found.files);
        for (const problem of problems) errors.push(`${taskSet.name}/${task.id}: ${problem}`);
        if (!problems.length) tasks.push({ taskSet, fixture, task, ...found });
      }
    }
    if (options.tasks.length && !tasks.length) throw new Error(`No mutants found for ${options.tasks.join(', ')}`);
    for (const entry of tasks) ensureDesignAssets(entry.fixture.dir, [entry.task]);

    const pristines = new Map();
    const jobs = [];
    for (const entry of tasks) {
      if (!pristines.has(entry.fixture.name)) {
        console.log(`Preparing fixture ${entry.fixture.name} ...`);
        pristines.set(entry.fixture.name, preparePristine(entry.fixture, path.join(scratch, 'cache'), quiet));
      }
      const { manifest } = entry;
      const files = [null, ...[...(manifest.references ?? []), ...(manifest.knownFailing ?? []), ...manifest.mutants].map((item) => item.file)];
      for (const file of files) {
        jobs.push({
          key: `${entry.taskSet.name}/${entry.task.id}/${file ?? '(untouched)'}`,
          fixtureName: entry.fixture.name,
          pristine: pristines.get(entry.fixture.name),
          task: entry.task,
          patch: file && path.join(entry.dir, file),
          install: manifest.installAfterPatch,
          label: file ? file.replace(/\.patch$/, '') : 'untouched'
        });
      }
    }
    // Slow tasks first so the pool does not end on one long tail.
    const slow = (job) => -Math.max(0, ...(job.task.checks ?? []).map((check) => check.timeoutSec ?? 0));
    jobs.sort((a, b) => slow(a) - slow(b));

    const results = new Map();
    let done = 0;
    if (jobs.length) {
      const workers = pool(Math.min(options.concurrency, jobs.length), scratch, options.keep);
      try {
        await workers.run(jobs, (key, result) => {
          results.set(key, result);
          done += 1;
          const state = result.error ? 'ERROR' : result.pass ? 'pass' : `fail (${result.failed.join(', ')})`;
          console.log(`[${done}/${jobs.length}] ${key}: ${state} ${(result.ms / 1000).toFixed(1)}s`);
        });
      } finally {
        await workers.close();
      }
    }

    const summary = [];
    for (const entry of tasks) {
      const prefix = `${entry.taskSet.name}/${entry.task.id}`;
      const byFile = new Map();
      for (const [key, result] of results) {
        if (!key.startsWith(`${prefix}/`)) continue;
        const file = key.slice(prefix.length + 1);
        if (result.error) errors.push(`${prefix}: ${file}: ${result.error.split('\n')[0]}`);
        else byFile.set(file === '(untouched)' ? null : file, result);
      }
      const commandCheckIds = (entry.task.checks ?? []).filter((check) => check.type === 'command').map((check) => check.id);
      const score = scoreTask({ manifest: entry.manifest, results: byFile, baselinePasses: entry.manifest.baselinePasses === true, commandCheckIds });
      for (const error of score.errors) errors.push(`${prefix}: ${error}`);
      const refsPassing = (entry.manifest.references ?? []).filter((reference) => byFile.get(reference.file)?.pass).length;
      const knownFailing = (entry.manifest.knownFailing ?? []).filter((known) => byFile.get(known.file) && !byFile.get(known.file).pass).length;
      summary.push({
        task: prefix,
        mutants: score.total,
        killed: score.killed,
        killRate: score.killRate,
        declaredKillRate: declaredKillRate(entry.manifest),
        references: `${refsPassing}/${(entry.manifest.references ?? []).length}`,
        knownFailing: `${knownFailing}/${(entry.manifest.knownFailing ?? []).length}`,
        untouched: byFile.get(null) ? (byFile.get(null).pass ? 'passes' : `fails ${byFile.get(null).failed.join(', ')}`) : '-',
        unexpectedKills: score.unexpectedKills,
        survivors: entry.manifest.mutants.filter((mutant) => (score.killedFiles ? !score.killedFiles.includes(mutant.file) : byFile.get(mutant.file)?.pass)).filter((mutant) => byFile.has(mutant.file)).map((mutant) => mutant.file),
        scores: scoreLine(entry.manifest, byFile)
      });
    }

    const seconds = (Date.now() - started) / 1000;
    console.log('\n| Task | Mutants | Killed | Kill rate | References pass | Known failing fail | Untouched | Scores (references; untouched; mutants) |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const row of summary) console.log(`| ${row.task} | ${row.mutants} | ${row.killed} | ${(row.killRate * 100).toFixed(0)}% | ${row.references} | ${row.knownFailing} | ${row.untouched} | ${row.scores} |`);
    for (const row of summary) {
      if (row.survivors.length) console.log(`${row.task} survivors: ${row.survivors.join(', ')}`);
      if (row.unexpectedKills.length) console.log(`${row.task} killed although listed as survives (update the manifest): ${row.unexpectedKills.join(', ')}`);
    }
    console.log(`\n${jobs.length} checks in ${seconds.toFixed(1)}s, concurrency ${options.concurrency}.`);
    if (options.json) {
      fs.mkdirSync(path.dirname(options.json), { recursive: true });
      fs.writeFileSync(options.json, `${JSON.stringify({ seconds, concurrency: options.concurrency, summary, errors, results: Object.fromEntries(results) }, null, 2)}\n`);
    }
    if (errors.length) {
      console.error(`\n${errors.length} violation(s):\n${errors.map((error) => `- ${error}`).join('\n')}`);
      process.exitCode = 1;
    } else console.log('Mutation gate passed.');
  } finally {
    if (!options.keep) fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// Only as the entry script: tests import taskMutants and loadTaskSets.
if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  });
}
