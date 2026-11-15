// Turns a finished run directory into a run record (impure: runs diff, gates and reads files).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { countFeatures, detectPolicies, evaluateChecks, newDependencies, parseUnifiedDiff } from './checks.mjs';
import { matchesAny } from './config.mjs';
import { TELEMETRY_OFF } from './env.mjs';

const GATE_TIMEOUT_MS = 10 * 60 * 1000;

export function runGate(command, app) {
  const result = spawnSync('bash', ['-c', command], {
    cwd: app,
    encoding: 'utf8',
    timeout: GATE_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...TELEMETRY_OFF, CI: '1', NO_COLOR: '1', PATH: `${path.join(app, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}` }
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { ok: result.status === 0, tail: result.status === 0 ? '' : output.split('\n').slice(-30).join('\n') };
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

export function measureRun({ job, fixture, pristine, runDir, app, taskSet, task, provider, armsInfo, agentResult }) {
  const patch = diffAgainstPristine(fixture, pristine, app);
  fs.writeFileSync(path.join(runDir, 'diff.patch'), patch);
  const diff = parseUnifiedDiff(patch);
  const gates = Object.fromEntries(Object.entries(fixture.gates).map(([name, command]) => [name, runGate(command, app)]));
  const ignored = ['node_modules', 'dist', '.git'];
  const checks = evaluateChecks(task.checks, diff, finalFiles(app, ignored));
  let deps = { added: [] };
  if (fixture.dependencies?.type === 'npm') {
    deps = { added: newDependencies(readJson(path.join(pristine, fixture.dependencies.file)), readJson(path.join(app, fixture.dependencies.file))) };
  }
  const transcriptPath = path.join(runDir, provider.transcriptFile);
  const transcript = provider.parseTranscript(fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '');
  const telemetry = detectPolicies(transcript.events, {
    policies: [...new Set([...armsInfo.A.policies, ...armsInfo.B.policies])],
    skills: [...new Set([...armsInfo.A.skills, ...armsInfo.B.skills])],
    signals: taskSet.policySignals ?? {}
  });
  const completed = agentResult.exitCode === 0 && !agentResult.timedOut && transcript.subtype === 'success';
  return {
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
    features: countFeatures(taskSet.featurePatterns, diff.added),
    telemetry: { ...telemetry, commands: transcript.events.commands.filter((command) => Object.values(taskSet.policySignals ?? {}).some((signal) => new RegExp(signal.commandPattern).test(command))) },
    resultExcerpt: transcript.resultText.slice(-2000)
  };
}
