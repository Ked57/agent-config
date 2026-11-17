// Turns a finished run directory into a run record (impure: runs diff, gates and reads files).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandTags, countFeatures, mcpCalls, subagentCalls, detectPolicies, evaluateChecks, newDependencies, parseJsonScore, parseUnifiedDiff, parseVitestJson, scoreRun } from './checks.mjs';
import { matchesAny } from './config.mjs';
import { TELEMETRY_OFF, sandboxRoot } from './env.mjs';
import { ensureBrowserTools } from './browser.mjs';

const GATE_TIMEOUT_MS = 10 * 60 * 1000;

export function runGate(command, app, timeoutMs = GATE_TIMEOUT_MS, extraEnv = {}) {
  const result = spawnSync('bash', ['-c', command], {
    cwd: app,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...TELEMETRY_OFF, CI: '1', NO_COLOR: '1', PATH: `${path.join(app, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}`, ...extraEnv }
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const timedOut = result.error?.code === 'ETIMEDOUT';
  return { ok: result.status === 0, timedOut, outputTail: output.split('\n').slice(-30).join('\n'), tail: result.status === 0 ? '' : `${timedOut ? `timed out after ${Math.round(timeoutMs / 1000)}s\n` : ''}${output.split('\n').slice(-30).join('\n')}` };
}

/**
 * Runs a task's `command` check: copies hidden files from the fixture into the app (after the diff
 * was taken, so neither the agent nor the judge sees them), runs the command, then removes them.
 * Without a reporter the score is 1 for a pass and 0 for a fail. With `"reporter": "vitest-json"`
 * the command (which must end with the `vitest run ...` invocation) gets `--reporter=json
 * --outputFile=<file outside the app>` appended; CLI flags override any reporter the agent put in its
 * Vitest config. The score is then passed / total test cases, and 0 when a test file failed to load,
 * no test ran, the report is missing or the command timed out. With `"reporter": "json-score"` the
 * command gets `EVAL_SCORE_FILE` (see `jsonScoreCheck`).
 */
export function runCommandCheck(check, { fixture, app }) {
  const copied = [];
  for (const [from, to] of Object.entries(check.copy ?? {})) {
    const target = path.join(app, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(fixture.dir, from), target, { recursive: true });
    copied.push(target);
  }
  try {
    const base = { id: check.id, label: check.label ?? check.id, level: check.level ?? 'required', ...(check.weight !== undefined ? { weight: check.weight } : {}) };
    const toolsEnv = check.browserTools ? { EVAL_TOOLS_DIR: ensureBrowserTools(path.join(sandboxRoot(), '.cache')) } : {};
    if (check.reporter === 'vitest-json') return vitestCheck(check, app, base);
    if (check.reporter === 'json-score') return jsonScoreCheck(check, app, base, toolsEnv);
    const result = runGate(check.run, app, (check.timeoutSec ?? 600) * 1000, toolsEnv);
    const pass = check.expect === 'fail' ? !result.ok : result.ok;
    return { ...base, pass, score: pass ? 1 : 0, detail: pass ? '' : result.tail.slice(-600) };
  } finally {
    for (const target of copied) {
      fs.rmSync(target, { recursive: true, force: true });
      const parent = path.dirname(target);
      if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmSync(parent, { recursive: true, force: true });
    }
  }
}

function vitestCheck(check, app, base) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-vitest-'));
  try {
    const outputFile = path.join(scratch, 'report.json');
    const result = runGate(`${check.run} --reporter=json --outputFile=${JSON.stringify(outputFile)}`, app, (check.timeoutSec ?? 600) * 1000);
    const report = !result.timedOut && fs.existsSync(outputFile) ? parseVitestJson(fs.readFileSync(outputFile, 'utf8')) : null;
    if (!report) return { ...base, pass: false, score: 0, passed: 0, total: 0, detail: (result.timedOut ? result.tail : `no Vitest JSON report\n${result.tail}`).slice(-600) };
    const loaded = !report.loadFailed.length && report.total > 0;
    const pass = result.ok && loaded && report.passed === report.total;
    const notes = [
      ...report.loadFailed.map((file) => `failed to load ${file.file}: ${file.message}`),
      ...(report.total ? [] : ['no test ran']),
      ...report.failed.map((name) => `failed: ${name}`),
      ...(!result.ok && loaded && !report.failed.length ? [`command failed outside test cases\n${result.tail}`] : [])
    ];
    return { ...base, pass, score: loaded ? report.passed / report.total : 0, passed: report.passed, total: report.total, detail: notes.join('\n').slice(0, 1200) };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * A continuous check: the command writes `{ score, components, detail }` to `$EVAL_SCORE_FILE` (a temp
 * file outside the app). A valid file sets the score even when the command exits non-zero (it may exit 1
 * to signal "below threshold"); `pass` is `score >= passAt` (default 1). No valid file, or a timeout,
 * scores 0 with the output's tail as detail.
 */
function jsonScoreCheck(check, app, base, extraEnv = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-score-'));
  try {
    const scoreFile = path.join(scratch, 'score.json');
    const result = runGate(check.run, app, (check.timeoutSec ?? 600) * 1000, { ...extraEnv, EVAL_SCORE_FILE: scoreFile });
    const report = !result.timedOut && fs.existsSync(scoreFile) ? parseJsonScore(fs.readFileSync(scoreFile, 'utf8')) : null;
    if (!report) {
      const why = result.timedOut ? `timed out after ${check.timeoutSec ?? 600}s` : fs.existsSync(scoreFile) ? 'invalid score file' : 'no score file';
      return { ...base, reporter: 'json-score', pass: false, score: 0, components: {}, detail: `${why}\n${result.outputTail}`.slice(-600) };
    }
    return { ...base, reporter: 'json-score', pass: report.score >= (check.passAt ?? 1), score: report.score, components: report.components, detail: report.detail };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

export function diffAgainstPristine(fixture, pristine, app) {
  const excludes = [...fixture.diffExclude, '.eval-ready', '.eval-manifest.json'].flatMap((pattern) => [`--exclude=${pattern}`]);
  const result = spawnSync('diff', ['-ruN', ...excludes, pristine, app], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  // Rewrite absolute roots to a/ and b/ so the patch is portable and does not reveal the arm.
  return (result.stdout ?? '').replaceAll(`${app}/`, 'b/').replaceAll(`${pristine}/`, 'a/');
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
};

const finalFiles = (app, ignored) => (globs) => {
  const out = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored.includes(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const relative = path.relative(app, full).split(path.sep).join('/');
        if (matchesAny(relative, globs)) out.push({ path: relative, content: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  visit(app);
  return out;
};

/** Both arms' plugins as `{ name, skills, agents }`, merged by name. */
const armPlugins = (armsInfo) => {
  const byName = {};
  for (const plugin of [...(armsInfo.A?.plugins ?? []), ...(armsInfo.B?.plugins ?? [])]) {
    const entry = typeof plugin === 'string' ? { name: plugin.split('@')[0] } : { ...plugin, name: (plugin.name ?? plugin.id ?? '').split('@')[0] };
    if (!entry.name) continue;
    const seen = byName[entry.name] ?? { name: entry.name, skills: [], agents: [] };
    byName[entry.name] = { name: entry.name, skills: [...new Set([...seen.skills, ...(entry.skills ?? [])])], agents: [...new Set([...seen.agents, ...(entry.agents ?? [])])] };
  }
  return Object.values(byName);
};

/**
 * Which policies, skills and plugins of either arm a run's transcript shows firing, plus the commands
 * matching a policy signal. Also used to re-derive a reused run's telemetry against this eval's arms.
 */
export function runTelemetry({ transcript, transcriptText, armsInfo, taskSet, prompt }) {
  const telemetry = detectPolicies(transcript.events, {
    policies: [...new Set([...(armsInfo.A.policies ?? []), ...(armsInfo.B.policies ?? [])])],
    skills: [...new Set([...(armsInfo.A.skills ?? []), ...(armsInfo.B.skills ?? [])])],
    plugins: armPlugins(armsInfo),
    signals: taskSet.policySignals ?? {},
    prompt,
    commandTags: commandTags(transcriptText),
    subagents: subagentCalls(transcriptText)
  });
  return { ...telemetry, commands: transcript.events.commands.filter((command) => Object.values(taskSet.policySignals ?? {}).some((signal) => new RegExp(signal.commandPattern).test(command))) };
}

/** `prompt` is the exact prompt sent (with any arm prefix); it defaults to the job's or the task's. */
export function measureRun({ job, fixture, pristine, runDir, app, taskSet, task, provider, armsInfo, agentResult, prompt = job.prompt ?? task.prompt }) {
  const patch = diffAgainstPristine(fixture, pristine, app);
  fs.writeFileSync(path.join(runDir, 'diff.patch'), patch);
  const diff = parseUnifiedDiff(patch);
  const gates = Object.fromEntries(Object.entries(fixture.gates).map(([name, command]) => [name, runGate(command, app)]));
  const ignored = ['node_modules', 'dist', '.git'];
  const staticResults = evaluateChecks(task.checks, diff, finalFiles(app, ignored));
  const checks = (task.checks ?? []).map((check) => (check.type === 'command'
    ? runCommandCheck(check, { fixture, app })
    : staticResults.find((result) => result.id === check.id)));
  let deps = { added: [] };
  if (fixture.dependencies?.type === 'npm') {
    deps = { added: newDependencies(readJson(path.join(pristine, fixture.dependencies.file)), readJson(path.join(app, fixture.dependencies.file))) };
  }
  const transcriptPath = path.join(runDir, provider.transcriptFile);
  const transcriptText = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
  const transcript = provider.parseTranscript(transcriptText);
  const completed = agentResult.exitCode === 0 && !agentResult.timedOut && transcript.subtype === 'success';
  const record = {
    id: job.id,
    task: job.task,
    category: task.category,
    arm: job.arm,
    rep: job.rep,
    status: completed ? 'ok' : 'error',
    error: agentResult.timedOut ? 'timeout' : completed ? null : (transcript.subtype ?? `exit ${agentResult.exitCode}`),
    exitCode: agentResult.exitCode,
    wallMs: agentResult.wallMs,
    agent: { model: transcript.model, turns: transcript.turns, toolCalls: transcript.toolCalls, toolsByName: transcript.toolsByName },
    cost: { usd: transcript.costUsd, ...(transcript.usage ?? {}) },
    gates,
    gatesPass: Object.values(gates).every((gate) => gate.ok),
    checks,
    deps,
    diff: { changedFiles: diff.changedFiles, addedLines: diff.addedLines, removedLines: diff.removedLines },
    features: countFeatures(taskSet.featurePatterns, diff.code),
    telemetry: runTelemetry({ transcript, transcriptText, armsInfo, taskSet, prompt }),
    mcpCalls: mcpCalls(transcriptText),
    resultExcerpt: transcript.resultText.slice(-2000)
  };
  return { ...record, ...scoreRun(record) };
}

/**
 * Re-scores a finished run's task checks against the current task definition (no agent, no gates).
 * Returns the check list (scored the same way as measureRun); recompute the run's `score` and
 * `allPass` with `scoreRun` afterwards. The aggregate always rescores from the checks.
 */
export function recheckRun({ fixture, app, runDir, task }) {
  const diff = parseUnifiedDiff(fs.readFileSync(path.join(runDir, 'diff.patch'), 'utf8'));
  const staticResults = evaluateChecks(task.checks, diff, finalFiles(app, ['node_modules', 'dist', '.git']));
  return (task.checks ?? []).map((check) => (check.type === 'command'
    ? runCommandCheck(check, { fixture, app })
    : staticResults.find((result) => result.id === check.id)));
}
