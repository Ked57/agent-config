#!/usr/bin/env node
// A/B eval runner for agent-config. See evals/README.md.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate } from './lib/aggregate.mjs';
import { buildArm, compareInventories } from './lib/arms.mjs';
import { browserSmoke } from './lib/browser.mjs';
import { DEFAULTS, parseArgs, resolveConfig, validateTaskSet } from './lib/config.mjs';
import { browserToolEnv } from './lib/env.mjs';
import { copyForRun, loadFixture, preparePristine, verifyPristine } from './lib/fixtures.mjs';
import { buildJudgePrompt, judgePair } from './lib/judge.mjs';
import { measureRun } from './lib/measure.mjs';
import { budgetAllows, buildRunQueue, planJudgePairs } from './lib/plan.mjs';
import { agentProvider, judgeProvider } from './lib/providers/index.mjs';
import { renderReport } from './lib/report.mjs';

const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(EVALS_DIR, '..');
const EVALS_HOME = process.env.AGENT_CONFIG_EVALS_HOME ?? path.join(os.homedir(), 'agent-config-evals');
const CACHE_ROOT = path.join(EVALS_HOME, '.cache');
const MAX_DIFF_CHARS = 60000;

const USAGE = `Usage: npm run eval -- --b <ref> [options]

Arms
  --a <ref>                 Arm A agent-config ref (default: main). WORKTREE = current working tree.
  --b <ref>                 Arm B ref (required). Use --b main for an A/A control.
  --a-add / --b-add <path>[=<src>]   Add or replace policy/<x>.md or skills/<x> in that arm.
                            <src>: a ref (same path), <ref>:<path>, or a file/dir. Omit for the working tree.
  --a-remove / --b-remove <path>     Remove policy/<x>.md or skills/<x> from that arm.
Tasks
  --tasks <name|file>       Task set in evals/tasks/<name>.json or a path (default: ${DEFAULTS.tasks}).
  --only <id,id>            Run only these task ids.   --smoke   Task set's smoke subset, 1 rep.
  --reps <n>                Repetitions per task and arm (default: ${DEFAULTS.reps}).
Agent
  --provider <name>         Agent provider (default: claude).  --model <id> (default: ${DEFAULTS.model})
  --effort <level>          (default: ${DEFAULTS.effort})   --timeout-min <n> per run (default: ${DEFAULTS.timeoutMin})
  --env KEY=VALUE           Extra env for agent processes (repeatable).
  --watch <policy|skill>    Track firing of a policy/skill even if unchanged between arms (repeatable).
Judge
  --no-judge                Skip judging.   --judge-model <id>   --judge-effort <level>
  --judge-reps <n>          Verdicts per pair, alternating patch order (default: ${DEFAULTS.judgeReps}).
  --judge-controls <n>      A#1-vs-A#2 noise pairs per task (default: ${DEFAULTS.judgeControls}).
  --judge-command "<cmd>"   Judge with any CLI that reads the prompt on stdin (e.g. another model family).
Execution
  --concurrency <n>         Parallel runs/judgments (default: ${DEFAULTS.concurrency}).
  --max-usd <n>             Stop starting new work once spend reaches this.   --max-runs <n>   Cap total runs.
  --browser                 Playwright smoke of the fixture's routes after each run.
  --out <dir>               Results dir (default: ~/agent-config-evals/<timestamp>-<name>).
  --resume <dir>            Continue an earlier eval (finished runs and judgments are skipped).
  --report-only             With --resume: re-aggregate and rewrite the report only.
  --dry-run                 Build arms and fixture, print the plan, call no models.
  --name <name>             Label for the results dir and report.`;

const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const readDir = (directory) => (fs.existsSync(directory) ? fs.readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => readJson(path.join(directory, file))) : []);

function loadTaskSet(nameOrPath) {
  const file = fs.existsSync(nameOrPath) ? path.resolve(nameOrPath) : path.join(EVALS_DIR, 'tasks', `${nameOrPath}.json`);
  if (!fs.existsSync(file)) throw new Error(`Task set not found: ${nameOrPath}`);
  const taskSet = readJson(file);
  const errors = validateTaskSet(taskSet);
  if (errors.length) throw new Error(`Invalid task set ${file}:\n- ${errors.join('\n- ')}`);
  return taskSet;
}

async function pool(items, concurrency, worker, shouldStop) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length && !shouldStop()) await worker(queue.shift());
  }));
}

async function main() {
  const raw = parseArgs(process.argv.slice(2));
  if (raw.help) return console.log(USAGE);

  let config;
  let outDir;
  let taskSet;
  if (raw.resume) {
    outDir = path.resolve(raw.resume);
    config = readJson(path.join(outDir, 'config.json'));
    taskSet = readJson(path.join(outDir, 'taskset.json'));
    for (const key of ['concurrency', 'maxUsd', 'maxRuns', 'judge', 'judgeReps', 'judgeControls', 'browser']) if (raw[key] !== undefined) config[key] = raw[key];
  } else {
    taskSet = loadTaskSet(raw.tasks ?? DEFAULTS.tasks);
    config = resolveConfig(raw, taskSet);
    config.seed = crypto.randomInt(1, 2 ** 31);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outDir = path.resolve(raw.out ?? path.join(EVALS_HOME, `${stamp}-${config.name}`));
    if (fs.existsSync(path.join(outDir, 'config.json'))) throw new Error(`${outDir} already holds an eval; use --resume ${outDir}`);
    writeJson(path.join(outDir, 'config.json'), config);
    writeJson(path.join(outDir, 'taskset.json'), taskSet);
  }
  const reportOnly = Boolean(raw.reportOnly);
  log(`Eval ${config.name} → ${outDir}`);

  const fixture = loadFixture(taskSet.fixture);
  const tasksById = Object.fromEntries(taskSet.tasks.map((task) => [task.id, task]));
  const armsFile = path.join(outDir, 'arms.json');
  let armsInfo;
  if (fs.existsSync(armsFile)) armsInfo = readJson(armsFile);
  else {
    const built = {};
    for (const arm of ['A', 'B']) {
      log(`Building arm ${arm} from ${config.arms[arm].ref}${config.arms[arm].add.length + config.arms[arm].remove.length ? ' with toggles' : ''}`);
      built[arm] = buildArm({ repoRoot: REPO_ROOT, spec: config.arms[arm], armDir: path.join(outDir, 'arms', arm) });
    }
    armsInfo = { A: built.A, B: built.B, ...compareInventories(built.A, built.B) };
    writeJson(armsFile, armsInfo);
  }
  log(`Arms ${armsInfo.identical ? 'identical (A/A control)' : `differ in ${armsInfo.changedFiles.length} file(s); watching ${armsInfo.watched.join(', ') || 'nothing'}`}`);

  const pristine = reportOnly ? null : preparePristine(fixture, CACHE_ROOT, log);
  const provider = agentProvider(config.provider);
  const resultsDir = path.join(outDir, 'results', 'runs');
  const judgeDir = path.join(outDir, 'results', 'judge');
  const runs = readDir(resultsDir);
  const judgments = readDir(judgeDir);
  const spend = {
    runsUsd: runs.reduce((sum, run) => sum + (run.cost?.usd ?? 0), 0),
    judgeUsd: judgments.reduce((sum, judgment) => sum + (judgment.costUsd ?? 0), 0)
  };
  const spent = () => spend.runsUsd + spend.judgeUsd;

  let stopReason = null;
  let interrupted = 0;
  process.on('SIGINT', () => {
    interrupted += 1;
    if (interrupted > 1) process.exit(130);
    stopReason = 'interrupted';
    log('Interrupted: finishing in-flight work, then writing the report (Ctrl-C again to abort).');
  });

  const queue = buildRunQueue({ taskIds: config.taskIds, reps: config.reps, seed: config.seed });
  const done = new Set(runs.map((run) => run.id));
  const pending = reportOnly ? [] : queue.filter((job) => !done.has(job.id));
  if (raw.dryRun) {
    console.log(JSON.stringify({ outDir, arms: { A: armsInfo.A.ref, B: armsInfo.B.ref }, identical: armsInfo.identical, changedFiles: armsInfo.changedFiles, watched: armsInfo.watched, tasks: config.taskIds, reps: config.reps, pendingRuns: pending.length, completedRuns: runs.length }, null, 2));
    return;
  }

  let inFlight = 0;
  log(`${pending.length} run(s) pending, ${runs.length} already done, $${spent().toFixed(2)} spent so far`);
  await pool(pending, config.concurrency, async (job) => {
    const budget = budgetAllows(config, { spentUsd: spent(), runsDone: runs.length, runsInFlight: inFlight });
    if (!budget.ok) {
      stopReason ??= budget.reason;
      return;
    }
    inFlight += 1;
    try {
      const task = tasksById[job.task];
      const arm = armsInfo[job.arm];
      const runDir = path.join(outDir, 'runs', job.id);
      const app = path.join(runDir, 'app');
      copyForRun(fixture, pristine, app);
      log(`start ${job.id}`);
      const env = { ...browserToolEnv(job.id), ...config.env };
      const agentResult = await provider.runAgent({
        home: arm.home,
        cwd: app,
        prompt: task.prompt,
        model: config.model,
        effort: config.effort,
        transcriptPath: path.join(runDir, provider.transcriptFile),
        stderrPath: path.join(runDir, 'stderr.log'),
        timeoutMs: config.timeoutMin * 60 * 1000,
        env
      });
      // Stop dev servers or browsers the agent left behind in this run's copy.
      spawnSync('pkill', ['-f', '--', app]);
      spawnSync('agent-browser', ['close'], { env: { PATH: process.env.PATH, HOME: arm.home, AGENT_BROWSER_SESSION: env.AGENT_BROWSER_SESSION }, timeout: 20000 });
      const record = measureRun({ job, fixture, pristine, runDir, app, taskSet, task, provider, armsInfo, agentResult });
      if (config.browser) record.browser = await browserSmoke({ fixture, app, outDir: path.join(runDir, 'screens'), cacheRoot: CACHE_ROOT }).catch((error) => ({ ok: false, error: String(error), routes: {} }));
      writeJson(path.join(resultsDir, `${job.id}.json`), record);
      runs.push(record);
      spend.runsUsd += record.cost?.usd ?? 0;
      const fired = Object.entries(record.telemetry.policies).filter(([name, value]) => value.fired && armsInfo.watched.includes(name)).map(([name]) => name);
      log(`done  ${job.id} ${record.status} ${(record.wallMs / 60000).toFixed(1)}min $${(record.cost?.usd ?? 0).toFixed(2)} gates=${record.gatesPass ? 'pass' : 'FAIL'} checks=${record.checks.filter((c) => c.level === 'required' && c.pass).length}/${record.checks.filter((c) => c.level === 'required').length}${fired.length ? ` fired=${fired.join(',')}` : ''} | total $${spent().toFixed(2)}`);
    } catch (error) {
      log(`FAILED ${job.id}: ${error.message}`);
    } finally {
      inFlight -= 1;
    }
  }, () => Boolean(stopReason));

  if (config.judge && !reportOnly) {
    const judge = judgeProvider(config);
    const judgeHome = path.join(outDir, 'judge-home');
    fs.mkdirSync(judgeHome, { recursive: true });
    const judged = new Set(judgments.map((judgment) => judgment.id));
    const pairs = planJudgePairs({ runs, controls: config.judgeControls, armsIdentical: armsInfo.identical }).filter((pair) => !judged.has(pair.id));
    log(`${pairs.length} judgment(s) pending`);
    const patchOf = (run) => {
      const patch = fs.readFileSync(path.join(outDir, 'runs', run.id, 'diff.patch'), 'utf8');
      return patch.length > MAX_DIFF_CHARS ? `${patch.slice(0, MAX_DIFF_CHARS)}\n[... diff truncated ...]` : patch;
    };
    await pool(pairs, config.concurrency, async (pair) => {
      const budget = budgetAllows(config, { spentUsd: spent(), runsDone: runs.length }, 'judge');
      if (!budget.ok) {
        stopReason ??= budget.reason;
        return;
      }
      const runsBySide = { [pair.sides[0]]: pair.left, [pair.sides[1]]: pair.right };
      try {
        const verdict = await judgePair({
          sides: pair.sides,
          repeats: config.judgeReps,
          ask: (prompt) => judge.ask({ home: judgeHome, prompt, model: config.judgeModel, effort: config.judgeEffort }),
          buildPrompt: (order) => buildJudgePrompt({ context: fixture.judgeContext, task: tasksById[pair.task].prompt, patch1: patchOf(runsBySide[order[0]]), patch2: patchOf(runsBySide[order[1]]) })
        });
        const record = { id: pair.id, kind: pair.kind, task: pair.task, reps: pair.reps, sides: pair.sides, runs: [pair.left.id, pair.right.id], ...verdict };
        writeJson(path.join(judgeDir, `${pair.id}.json`), record);
        judgments.push(record);
        spend.judgeUsd += verdict.costUsd;
        log(`judged ${pair.id}: ${verdict.preference}${verdict.unanimous ? '' : ' (split)'}`);
      } catch (error) {
        log(`FAILED judge ${pair.id}: ${error.message}`);
      }
    }, () => Boolean(stopReason));
  }

  if (pristine) {
    const changed = verifyPristine(fixture, pristine);
    if (changed.length) log(`WARNING: ${changed.length} pristine fixture file(s) changed through hard links (e.g. ${changed[0]}); delete ${pristine} to rebuild it.`);
  }
  if (stopReason) log(`Stopped early: ${stopReason}. Resume with: npm run eval -- --resume ${outDir}`);

  const summary = aggregate({ config, taskSet, armsInfo, runs, judgments });
  summary.stoppedEarly = stopReason;
  writeJson(path.join(outDir, 'summary.json'), summary);
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), renderReport({ summary, config, armsInfo, taskSet, fixture, spend }));
  log(`Verdict: ${summary.recommendation.verdict}. Spend $${spent().toFixed(2)}. Report: ${path.join(outDir, 'REPORT.md')}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
