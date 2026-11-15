#!/usr/bin/env node
// A/B eval runner for agent-config. See evals/README.md.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate } from './lib/aggregate.mjs';
import { buildArm, compareInventories, inventory } from './lib/arms.mjs';
import { browserSmoke } from './lib/browser.mjs';
import { DEFAULTS, judgeSetId, parseArgs, resolveConfig, validateTaskSet } from './lib/config.mjs';
import { ancestorAgentConfig, browserToolEnv } from './lib/env.mjs';
import { httpSmoke } from './lib/http-smoke.mjs';
import { copyForRun, fixtureHash, loadFixture, preparePristine, verifyPristine } from './lib/fixtures.mjs';
import { buildJudgePrompt, judgePair } from './lib/judge.mjs';
import { measureRun, recheckRun } from './lib/measure.mjs';
import { budgetAllows, buildRunQueue, changedArmFiles, fixedFlagsOnResume, flippedChecks, planJudgePairs } from './lib/plan.mjs';
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
  --b <ref>                 Arm B ref (required unless --single-arm). Use --b main for an A/A control.
  --single-arm              Run only arm A (no --b, no judging): validate tasks and checks cheaply.
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
  --rejudge                 With --resume: skip agent runs and judge the saved pairs with the current
                            judge settings into a separate judge set (compared in the report).
Execution
  --concurrency <n>         Parallel runs/judgments (default: ${DEFAULTS.concurrency}).
  --max-usd <n>             Stop starting new work once spend reaches this.   --max-runs <n>   Cap total runs.
  --browser                 Playwright smoke of the fixture's routes after each run.
  --http                    Boot the service and hit the fixture's HTTP endpoints after each run.
  --out <dir>               Results dir (default: ~/agent-config-evals/<timestamp>-<name>).
  --resume <dir>            Continue an earlier eval (finished runs and judgments are skipped).
  --report-only             With --resume: re-aggregate and rewrite the report only.
  --recheck                 With --resume: re-score saved runs against the repo's current task checks
                            (hidden tests included); no agent runs, gates are not re-run.
  --dry-run                 Build arms and fixture, print the plan, call no models.
  --name <name>             Label for the results dir and report.`;

const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
/** Appends one line to the eval's audit trail: every resume, rejudge, recheck and report-only pass leaves a record. */
const appendAudit = (outDir, entry) => fs.appendFileSync(path.join(outDir, 'audit.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
const readAudit = (outDir) => (fs.existsSync(path.join(outDir, 'audit.jsonl')) ? fs.readFileSync(path.join(outDir, 'audit.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);
const readDir = (directory) => (fs.existsSync(directory) ? fs.readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => readJson(path.join(directory, file))) : []);

function loadTaskSet(nameOrPath) {
  const file = fs.existsSync(nameOrPath) ? path.resolve(nameOrPath) : path.join(EVALS_DIR, 'tasks', `${nameOrPath}.json`);
  if (!fs.existsSync(file)) throw new Error(`Task set not found: ${nameOrPath}`);
  const taskSet = readJson(file);
  const errors = validateTaskSet(taskSet);
  if (errors.length) throw new Error(`Invalid task set ${file}:\n- ${errors.join('\n- ')}`);
  return taskSet;
}

/** Evals from before judge sets kept verdicts directly in results/judge/; move them under their judge's id. */
function migrateLegacyJudgments(outDir, config) {
  const root = path.join(outDir, 'results', 'judge');
  if (!fs.existsSync(root)) return;
  const legacy = fs.readdirSync(root).filter((file) => file.endsWith('.json'));
  if (!legacy.length) return;
  const set = judgeSetId(config);
  fs.mkdirSync(path.join(root, set), { recursive: true });
  for (const file of legacy) {
    const record = readJson(path.join(root, file));
    record.judge ??= { set, provider: config.judgeProvider, model: config.judgeModel, effort: config.judgeEffort };
    writeJson(path.join(root, set, file), record);
    fs.rmSync(path.join(root, file));
  }
  log(`Moved ${legacy.length} earlier judgment(s) into results/judge/${set}/`);
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
    const fixed = fixedFlagsOnResume(raw);
    if (fixed.length) throw new Error(`--resume keeps the eval's arms, tasks, model and reps: drop ${fixed.join(', ')} or start a new eval`);
    migrateLegacyJudgments(outDir, config);
    const overrides = {};
    for (const key of ['concurrency', 'maxUsd', 'maxRuns', 'judge', 'judgeReps', 'judgeControls', 'browser', 'http', 'judgeModel', 'judgeEffort', 'judgeProvider', 'judgeCommand']) if (raw[key] !== undefined && raw[key] !== config[key]) {
      overrides[key] = { from: config[key] ?? null, to: raw[key] };
      config[key] = raw[key];
    }
    if (raw.judgeCommand) config.judgeProvider = 'command';
    else if (raw.judgeModel && config.judgeProvider === 'command') config.judgeProvider = 'claude';
    if (!raw.dryRun) {
      // Keep config.json in step with the report: a later --report-only must pick the same judge set.
      if (Object.keys(overrides).length) writeJson(path.join(outDir, 'config.json'), config);
      appendAudit(outDir, { action: raw.recheck ? 'recheck' : raw.rejudge ? 'rejudge' : raw.reportOnly ? 'report-only' : 'resume', overrides });
    }
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
  const currentFixtureHash = fixtureHash(fixture);
  const agentRunsWanted = !reportOnly && !raw.rejudge && !raw.recheck;
  if (!raw.resume) {
    config.fixtureHash = currentFixtureHash;
    writeJson(path.join(outDir, 'config.json'), config);
  } else if (agentRunsWanted && config.fixtureHash && config.fixtureHash !== currentFixtureHash) {
    throw new Error(`Fixture ${fixture.name} changed since this eval started (${config.fixtureHash} → ${currentFixtureHash}): new runs would not be comparable with the saved ones. Start a new eval, or use --report-only, --rejudge or --recheck.`);
  }
  const warnings = [];
  if (raw.resume && agentRunsWanted && !config.fixtureHash) warnings.push('This eval predates fixture hashes: runs added by --resume may use a different fixture version than the earlier ones.');
  const ancestors = ancestorAgentConfig(path.join(outDir, 'runs', 'run', 'app'));
  if (ancestors.length) warnings.push(`Agent working copies sit under ${ancestors.map((file) => `\`${file}\``).join(', ')}: Claude Code loads these as project config in BOTH arms regardless of HOME. Keep results outside your home (AGENT_CONFIG_EVALS_HOME or --out) for a clean isolation.`);
  const tasksById = Object.fromEntries(taskSet.tasks.map((task) => [task.id, task]));
  const armsFile = path.join(outDir, 'arms.json');
  let armsInfo;
  if (fs.existsSync(armsFile)) {
    armsInfo = readJson(armsFile);
    for (const arm of config.singleArm ? ['A'] : ['A', 'B']) {
      if (!fs.existsSync(armsInfo[arm].home)) continue;
      const changed = changedArmFiles(armsInfo[arm].hashes, inventory(armsInfo[arm].home).hashes);
      if (!changed.length) continue;
      const message = `Arm ${arm}'s installed config changed after it was built (${changed.slice(0, 5).join(', ')})`;
      if (agentRunsWanted && !raw.dryRun) throw new Error(`${message}; new runs would not match the saved ones. Start a new eval.`);
      warnings.push(`${message}.`);
    }
  } else {
    const built = {};
    for (const arm of config.singleArm ? ['A'] : ['A', 'B']) {
      log(`Building arm ${arm} from ${config.arms[arm].ref}${config.arms[arm].add.length + config.arms[arm].remove.length ? ' with toggles' : ''}`);
      built[arm] = buildArm({ repoRoot: REPO_ROOT, spec: config.arms[arm], armDir: path.join(outDir, 'arms', arm) });
    }
    built.B ??= built.A;
    armsInfo = { A: built.A, B: built.B, ...compareInventories(built.A, built.B) };
    writeJson(armsFile, armsInfo);
  }
  log(`Arms ${armsInfo.identical ? 'identical (A/A control)' : `differ in ${armsInfo.changedFiles.length} file(s); watching ${armsInfo.watched.join(', ') || 'nothing'}`}`);

  const pristine = agentRunsWanted ? preparePristine(fixture, CACHE_ROOT, log) : null;
  const provider = agentProvider(config.provider);
  const resultsDir = path.join(outDir, 'results', 'runs');
  const activeJudgeSet = judgeSetId(config);
  const judgeRoot = path.join(outDir, 'results', 'judge');
  const judgeDir = path.join(judgeRoot, activeJudgeSet);
  const runs = readDir(resultsDir);
  // A judgment belongs to the patches it saw: once a run is redone, verdicts on its old patch are dropped.
  const patchSha = (id) => {
    const file = path.join(outDir, 'runs', id, 'diff.patch');
    return fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
  };
  const patchShaCache = {};
  const currentPatch = (id) => (patchShaCache[id] ??= patchSha(id));
  const isCurrent = (judgment) => !judgment.patches || judgment.runs.every((id, index) => currentPatch(id) === null || currentPatch(id) === judgment.patches[index]);
  const readJudgments = (directory) => {
    const all = readDir(directory);
    const current = all.filter(isCurrent);
    if (current.length < all.length) warnings.push(`${all.length - current.length} judgment(s) in ${path.basename(directory)} were made on patches that have since been replaced and are ignored.`);
    return current;
  };
  const judgments = readJudgments(judgeDir);
  const otherJudgeSets = Object.fromEntries((fs.existsSync(judgeRoot) ? fs.readdirSync(judgeRoot, { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory() && entry.name !== activeJudgeSet)
    .map((entry) => [entry.name, readJudgments(path.join(judgeRoot, entry.name))]));
  const spend = {
    runsUsd: runs.reduce((sum, run) => sum + (run.cost?.usd ?? 0), 0),
    judgeUsd: [judgments, ...Object.values(otherJudgeSets)].flat().reduce((sum, judgment) => sum + (judgment.costUsd ?? 0), 0)
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

  const queue = buildRunQueue({ taskIds: config.taskIds, reps: config.reps, seed: config.seed, arms: config.singleArm ? ['A'] : ['A', 'B'] });
  const done = new Set(runs.map((run) => run.id));
  if (raw.recheck) {
    // Pick up edited checks and hidden tests from the repo's copy of this task set. Prompts, categories
    // and everything else the runs were made under stay as saved; only the checks are replaced.
    const current = loadTaskSet(taskSet.name);
    const currentById = Object.fromEntries(current.tasks.map((task) => [task.id, task]));
    const at = new Date().toISOString();
    const flips = [];
    for (const run of runs) {
      const task = currentById[run.task];
      const runDir = path.join(outDir, 'runs', run.id);
      if (!task || !fs.existsSync(path.join(runDir, 'app'))) continue;
      const before = run.checks ?? [];
      run.checksOriginal ??= before;
      run.checks = recheckRun({ fixture, app: path.join(runDir, 'app'), runDir, task });
      const flipped = flippedChecks(before, run.checks);
      flips.push(...flipped.map((flip) => ({ run: run.id, ...flip })));
      run.rechecks = [...(run.rechecks ?? []), { at, fixtureHash: currentFixtureHash, flipped }];
      writeJson(path.join(resultsDir, `${run.id}.json`), run);
      log(`rechecked ${run.id}: ${run.checks.filter((c) => c.level === 'required' && c.pass).length}/${run.checks.filter((c) => c.level === 'required').length} required checks pass${flipped.length ? ` (${flipped.length} changed)` : ''}`);
    }
    const previousTaskSet = sha256(JSON.stringify(taskSet));
    taskSet = { ...taskSet, tasks: taskSet.tasks.map((task) => (currentById[task.id] ? { ...task, checks: currentById[task.id].checks } : task)) };
    writeJson(path.join(outDir, 'taskset.json'), taskSet);
    appendAudit(outDir, { action: 'recheck-result', fixtureHash: currentFixtureHash, runFixtureHash: config.fixtureHash ?? null, tasksetBefore: previousTaskSet, tasksetAfter: sha256(JSON.stringify(taskSet)), flips });
  }
  const pending = agentRunsWanted ? queue.filter((job) => !done.has(job.id)) : [];
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
      record.fixtureHash = currentFixtureHash;
      // A run that wrote through a hard link has changed node_modules for every later run: stop there.
      const cacheChanged = verifyPristine(fixture, pristine);
      if (cacheChanged.length) {
        record.fixtureCacheChanged = cacheChanged.slice(0, 20);
        stopReason ??= `the fixture cache was modified while ${job.id} ran (${cacheChanged.length} file(s), e.g. ${cacheChanged[0]}); resume rebuilds it`;
      }
      if (config.browser) record.browser = await browserSmoke({ fixture, app, outDir: path.join(runDir, 'screens'), cacheRoot: CACHE_ROOT }).catch((error) => ({ ok: false, error: String(error), routes: {} }));
      if (config.http) record.http = await httpSmoke({ fixture, app, outDir: path.join(runDir, 'http') }).catch((error) => ({ ok: false, error: String(error), requests: {} }));
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
    log(`${pairs.length} judgment(s) pending with judge ${activeJudgeSet}`);
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
        const record = { id: pair.id, kind: pair.kind, task: pair.task, reps: pair.reps, sides: pair.sides, runs: [pair.left.id, pair.right.id], patches: [currentPatch(pair.left.id), currentPatch(pair.right.id)], judge: { set: activeJudgeSet, provider: config.judgeProvider, model: config.judgeProvider === 'command' ? null : config.judgeModel, effort: config.judgeEffort }, ...verdict };
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
    if (changed.length) warnings.push(`${changed.length} cached fixture file(s) changed during this eval through hard links (e.g. \`${changed[0]}\`): runs after the first write used a modified node_modules. The cache is rebuilt on the next eval.`);
    for (const arm of config.singleArm ? ['A'] : ['A', 'B']) {
      const changedConfig = changedArmFiles(armsInfo[arm].hashes, inventory(armsInfo[arm].home).hashes);
      if (changedConfig.length) warnings.push(`Arm ${arm}'s installed config was modified during the eval (${changedConfig.slice(0, 5).join(', ')}).`);
    }
  }
  for (const warning of warnings) log(`WARNING: ${warning}`);
  if (stopReason) log(`Stopped early: ${stopReason}. Resume with: npm run eval -- --resume ${outDir}`);

  const summary = aggregate({ config, taskSet, armsInfo, runs, judgments, activeJudgeSet, otherJudgeSets });
  summary.stoppedEarly = stopReason;
  summary.warnings = warnings;
  summary.history = readAudit(outDir);
  writeJson(path.join(outDir, 'summary.json'), summary);
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), renderReport({ summary, config, armsInfo, taskSet, fixture, spend }));
  log(`Verdict: ${summary.recommendation.verdict}. Spend $${spent().toFixed(2)}. Report: ${path.join(outDir, 'REPORT.md')}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
