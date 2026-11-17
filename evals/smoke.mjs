#!/usr/bin/env node
// Regression smoke for agent-config: one arm, one rep of the tasks in evals/smoke.json, compared with
// evals/smoke-baseline.json. See evals/README.md, "Regression smoke".
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree, sandboxRoot } from './lib/env.mjs';
import { baselineFrom, judgeSmoke, renderSmoke, smokeRow } from './lib/smoke.mjs';

const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(EVALS_DIR, '..');
const SPEC_FILE = path.join(EVALS_DIR, 'smoke.json');
const BASELINE_FILE = path.join(EVALS_DIR, 'smoke-baseline.json');
const EVALS_HOME = process.env.AGENT_CONFIG_EVALS_HOME ?? path.join(os.homedir(), 'agent-config-evals');
const EXIT_PROVIDER_STOP = 75;

const USAGE = `Usage: npm run eval:smoke -- [options]

  --ref <ref>          Config to test: WORKTREE (default, uncommitted changes included), a branch or a commit.
  --only <id,id>       Run only these smoke tasks.
  --update-baseline    Write the results to evals/smoke-baseline.json (review the report first).
  --from <dir>         Report on (or --update-baseline from) a finished smoke dir; no agent runs.
  --resume <dir>       Continue a smoke run that stopped (usage limit, crash).
  --no-reuse           Run every task, even when an identical earlier run could be reused.
  --max-usd <n>        Stop starting new runs once a task set has spent this (default: 8).

Exit code 1 on a firing failure, an errored run or a failed gate; cost and turn drift only warn.
The judge is off: a single arm has nothing to compare against.`;

function parseArgs(argv) {
  const options = { ref: 'WORKTREE', only: null, updateBaseline: false, from: null, resume: null, reuse: true, maxUsd: '8' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      index += 1;
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--ref') options.ref = value();
    else if (arg === '--only') options.only = value().split(',').map((id) => id.trim()).filter(Boolean);
    else if (arg === '--update-baseline') options.updateBaseline = true;
    else if (arg === '--from') options.from = path.resolve(value());
    else if (arg === '--resume') options.resume = path.resolve(value());
    else if (arg === '--no-reuse') options.reuse = false;
    else if (arg === '--max-usd') options.maxUsd = value();
    else throw new Error(`Unknown option ${arg}\n\n${USAGE}`);
  }
  return options;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const git = (...args) => spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).stdout.trim();

function runSets({ spec, tasks, dir, options }) {
  const sets = [...new Set(tasks.map((task) => task.set))];
  for (const set of sets) {
    const out = path.join(dir, set);
    const ids = tasks.filter((task) => task.set === set).map((task) => task.id);
    const resuming = fs.existsSync(path.join(out, 'config.json'));
    const runsDir = path.join(out, 'results', 'runs');
    if (resuming && fs.existsSync(runsDir) && fs.readdirSync(runsDir).filter((file) => file.endsWith('.json')).length >= ids.length) continue;
    const args = resuming
      ? ['--resume', out, '--max-usd', options.maxUsd]
      : ['--single-arm', '--a', options.ref, '--tasks', set, '--only', ids.join(','), '--reps', '1', '--no-judge',
        '--model', spec.model, '--effort', spec.effort ?? 'medium', '--concurrency', '1', '--max-usd', options.maxUsd,
        '--out', out, '--name', `smoke-${set}`, ...(spec.modes?.[set] ? ['--a-mode', spec.modes[set]] : []), ...(options.reuse ? [] : ['--no-reuse'])];
    console.log(`\n== ${set}: ${ids.join(', ')}`);
    const result = spawnSync(process.execPath, [path.join(EVALS_DIR, 'run.mjs'), ...args], { stdio: 'inherit', cwd: REPO_ROOT });
    if (result.status === EXIT_PROVIDER_STOP) {
      console.log(`\nStopped by the provider. Wait, then: npm run eval:smoke -- --resume ${dir}`);
      process.exit(EXIT_PROVIDER_STOP);
    }
    if (result.status !== 0) console.log(`\n${set}: run.mjs exited ${result.status}; its tasks are reported as they stand.`);
    // The set's sandbox (about 0.5 GB of arm home and fixture copies) is not needed once its runs are
    // saved: arm builds are cached under the evals home, and --resume rebuilds a missing sandbox.
    const sandbox = fs.existsSync(path.join(out, 'config.json')) ? readJson(path.join(out, 'config.json')).sandbox : null;
    if (sandbox && fs.existsSync(sandbox)) removeTree(sandbox, sandboxRoot());
  }
}

function collectRows(dir, tasks) {
  const rows = [];
  for (const set of new Set(tasks.map((task) => task.set))) {
    const out = path.join(dir, set);
    if (!fs.existsSync(path.join(out, 'arms.json'))) continue;
    const arm = readJson(path.join(out, 'arms.json')).A;
    const runsDir = path.join(out, 'results', 'runs');
    for (const file of fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter((name) => name.endsWith('.json')) : []) {
      const run = readJson(path.join(runsDir, file));
      if (tasks.some((task) => task.id === run.task && task.set === set)) rows.push(smokeRow(run, arm));
    }
  }
  return rows;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return console.log(USAGE);
  const spec = readJson(SPEC_FILE);
  const unknown = (options.only ?? []).filter((id) => !spec.tasks.some((task) => task.id === id));
  if (unknown.length) throw new Error(`Not smoke tasks: ${unknown.join(', ')}`);
  const tasks = spec.tasks.filter((task) => !options.only || options.only.includes(task.id));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = options.from ?? options.resume ?? path.join(EVALS_HOME, `${stamp}-smoke`);
  if (!options.from) runSets({ spec, tasks, dir, options });

  const baseline = fs.existsSync(BASELINE_FILE) ? readJson(BASELINE_FILE) : null;
  const rows = collectRows(dir, tasks);
  const judged = judgeSmoke({ spec: { ...spec, tasks }, baseline, rows });
  const report = renderSmoke(judged);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SMOKE.md'), `# Smoke ${path.basename(dir)}\n\n${report}\n`);
  console.log(`\n${report}\n\nReport: ${path.join(dir, 'SMOKE.md')}`);

  if (options.updateBaseline) {
    if (options.only) throw new Error('--update-baseline needs every smoke task: drop --only');
    const config = fs.existsSync(path.join(dir, tasks[0].set, 'config.json')) ? readJson(path.join(dir, tasks[0].set, 'config.json')) : {};
    const ref = config.arms?.A?.ref ?? options.ref;
    const meta = { generated: new Date().toISOString().slice(0, 10), ref, commit: git('rev-parse', '--short', 'HEAD'), model: spec.model, effort: spec.effort ?? 'medium' };
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(baselineFrom({ spec, rows, meta }), null, 2)}\n`);
    console.log(`Baseline written: ${path.relative(REPO_ROOT, BASELINE_FILE)}${judged.failed ? ' (WARNING: this run has failures)' : ''}`);
  }
  if (judged.failed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error?.message ?? error);
  process.exitCode = 1;
}
