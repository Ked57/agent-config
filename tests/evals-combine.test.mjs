import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { combineEvals, combineProblems } from '../evals/lib/combine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
};

const arm = (ref, version = '0.15.42') => ({ ref, sha: ref === 'BARE' ? null : 'abc123', add: [], remove: [], pluginMode: ref === 'BARE' ? 'none' : 'install', home: `/sandbox/x/arms/${ref}/home`, hashes: ref === 'BARE' ? {} : { '.agents/AGENTS.md': 'h1' }, policies: [], skills: [], plugins: ref === 'BARE' ? [] : [{ id: 'pstack@cursor-plugins', name: 'pstack', version, gitCommitSha: 'bf0c7cd', skills: ['poteto-mode'], agents: [] }] });

/** A finished eval as `loadEval` reads it: BARE vs WORKTREE, one rep, B scoring `scoreB` per task. */
function syntheticEval({ dir = '/results/x', set, fixture, ids, scoreB = 1, model = 'claude-opus-5-5', version }) {
  const config = { name: set, provider: 'claude', model, effort: 'medium', reps: 1, seed: 7, taskIds: ids, judgeProvider: 'claude', judgeModel: 'claude-sonnet-5-5', judgeEffort: 'medium', arms: { A: { ref: 'BARE', add: [], remove: [] }, B: { ref: 'WORKTREE', add: [], remove: [] } }, plugins: 'install', fixtureHash: `${fixture}-hash` };
  const taskSet = { name: set, fixture, categories: { core: { label: 'Core' } }, tasks: ids.map((id) => ({ id, category: 'core', prompt: `Do ${id}.` })) };
  const record = (task, armId, score) => ({ id: `${task}__${armId}__r1`, task, category: 'core', arm: armId, rep: 1, status: 'ok', gatesPass: true, checks: [{ id: 'hidden', level: 'required', pass: score === 1, score }], cost: { usd: armId === 'A' ? 0.1 : 0.12 }, wallMs: 60000, agent: { turns: 10, toolCalls: 5 }, telemetry: { policies: {}, skills: {} }, diff: { changedFiles: ['src/a.ts'], addedLines: 3, removedLines: 0 } });
  const runs = ids.flatMap((id) => [record(id, 'A', 0.5), record(id, 'B', scoreB)]);
  const judgeSets = { 'claude-sonnet-5-5': ids.map((id) => ({ id: `${id}__AB__r1`, kind: 'AB', task: id, reps: [1, 1], sides: ['A', 'B'], runs: [`${id}__A__r1`, `${id}__B__r1`], preference: 'B', unanimous: true, scores: { A: { correctness: 3, overall: 3 }, B: { correctness: 4, overall: 4 } }, reasons: ['B handles the edge case.'], notes: { A: [], B: [] }, costUsd: 0.05 })) };
  return { dir, config, taskSet, armsInfo: { A: arm('BARE'), B: arm('WORKTREE', version), identical: false, changedFiles: ['.agents/AGENTS.md'], watched: ['plugin:pstack'] }, runs, judgeSets };
}

test('combineEvals pools task sets, prefixing only colliding ids, and keeps each task\'s source', () => {
  const backend = syntheticEval({ dir: '/r/backend', set: 'ts-backend', fixture: 'ts-backend', ids: ['B1', 'N1'] });
  const vue = syntheticEval({ dir: '/r/vue', set: 'vue-primevue', fixture: 'vue-primevue', ids: ['L1', 'N1'], scoreB: 0.5 });
  const merged = combineEvals([backend, vue], { name: 'full-vs-bare' });
  assert.deepEqual(merged.config.taskIds, ['B1', 'ts-backend.N1', 'L1', 'vue-primevue.N1']);
  assert.deepEqual(merged.taskSet.tasks.map((task) => [task.id, task.sourceSet, task.sourceTask, task.fixture]), [
    ['B1', 'ts-backend', 'B1', 'ts-backend'], ['ts-backend.N1', 'ts-backend', 'N1', 'ts-backend'],
    ['L1', 'vue-primevue', 'L1', 'vue-primevue'], ['vue-primevue.N1', 'vue-primevue', 'N1', 'vue-primevue']
  ]);
  assert.equal(merged.taskSet.fixture, 'ts-backend+vue-primevue');
  const run = merged.runs.find((entry) => entry.sourceSet === 'vue-primevue' && entry.sourceTask === 'N1' && entry.arm === 'B');
  assert.deepEqual([run.id, run.task, run.sourceRun, run.fixture], ['vue-primevue.N1__B__r1', 'vue-primevue.N1', 'N1__B__r1', 'vue-primevue']);
  const judgment = merged.judgeSets['claude-sonnet-5-5'].find((entry) => entry.task === 'ts-backend.N1');
  assert.deepEqual([judgment.id, judgment.runs], ['ts-backend.N1__AB__r1', ['ts-backend.N1__A__r1', 'ts-backend.N1__B__r1']]);
  assert.equal(merged.runs.length, 8);
  assert.deepEqual(merged.renames.filter((entry) => entry.dir === '/r/vue').map((entry) => entry.to), ['L1__A__r1', 'L1__B__r1', 'vue-primevue.N1__A__r1', 'vue-primevue.N1__B__r1']);
  assert.deepEqual(merged.config.combined.inputs.map((input) => [input.dir, input.taskSet, input.runs]), [['/r/backend', 'ts-backend', 4], ['/r/vue', 'vue-primevue', 4]]);
  assert.equal(merged.config.sandbox, undefined);
});

test('combineProblems refuses different models, arms, plugin versions, or the same task set twice', () => {
  const base = syntheticEval({ dir: '/r/a', set: 'ts-backend', fixture: 'ts-backend', ids: ['B1'] });
  const ok = syntheticEval({ dir: '/r/b', set: 'vue-primevue', fixture: 'vue-primevue', ids: ['L1'] });
  assert.deepEqual(combineProblems([base, ok]), []);
  assert.match(combineProblems([base]).join(), /at least two/);
  assert.match(combineProblems([base, { ...ok, config: { ...ok.config, model: 'claude-haiku-5-5' } }]).join(), /model claude-haiku-5-5 differs/);
  assert.match(combineProblems([base, syntheticEval({ dir: '/r/c', set: 'vue-primevue', fixture: 'vue-primevue', ids: ['L1'], version: '0.16.0' })]).join(), /arm B plugins .*0\.16\.0/);
  const prefixed = { ...ok, config: { ...ok.config, arms: { ...ok.config.arms, B: { ...ok.config.arms.B, prefix: '/pstack:poteto-mode' } } } };
  assert.match(combineProblems([base, prefixed]).join(), /arm B prefix/);
  const otherInstall = { ...ok, armsInfo: { ...ok.armsInfo, B: { ...ok.armsInfo.B, hashes: { '.agents/AGENTS.md': 'h2' } } } };
  assert.match(combineProblems([base, otherInstall]).join(), /arm B installed/);
  assert.match(combineProblems([base, { ...base, dir: '/r/again' }]).join(), /appears more than once/);
  assert.throws(() => combineEvals([base, prefixed], { name: 'x' }), /Cannot combine/);
});

test('npm run eval -- --combine writes one report over both task sets and refuses --resume on it', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-evals-combine-'));
  const dirs = [];
  for (const [set, ids, scoreB] of [['ts-backend', ['B1', 'B2', 'B3', 'N1'], 1], ['vue-primevue', ['L1', 'L2', 'N1'], 0.75]]) {
    const dir = path.join(scratch, set);
    const input = syntheticEval({ dir, set, fixture: set, ids, scoreB });
    writeJson(path.join(dir, 'config.json'), input.config);
    writeJson(path.join(dir, 'taskset.json'), input.taskSet);
    writeJson(path.join(dir, 'arms.json'), input.armsInfo);
    for (const run of input.runs) {
      writeJson(path.join(dir, 'results', 'runs', `${run.id}.json`), run);
      fs.mkdirSync(path.join(dir, 'runs', run.id, 'app'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'runs', run.id, 'diff.patch'), `+${run.id}\n`);
    }
    for (const judgment of input.judgeSets['claude-sonnet-5-5']) writeJson(path.join(dir, 'results', 'judge', 'claude-sonnet-5-5', `${judgment.id}.json`), judgment);
    dirs.push(dir);
  }
  const out = path.join(scratch, 'out');
  const result = spawnSync(process.execPath, [path.join(root, 'evals', 'run.mjs'), '--combine', ...dirs, '--name', 'full-vs-bare', '--out', out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Combined 2 evals \(14 runs, 7 tasks\)/);
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  assert.equal(summary.primary.tasks, 7);
  assert.deepEqual(Object.keys(summary.perFixture), ['ts-backend', 'vue-primevue']);
  assert.equal(summary.perFixture['ts-backend'].meanD, 0.5);
  assert.equal(summary.perFixture['vue-primevue'].meanD, 0.25);
  assert.match(fs.readFileSync(path.join(out, 'REPORT.md'), 'utf8'), /## Per fixture \(descriptive\)/);
  assert.equal(fs.readFileSync(path.join(out, 'runs', 'vue-primevue.N1__B__r1', 'diff.patch'), 'utf8'), '+N1__B__r1\n');
  assert.ok(!fs.existsSync(path.join(out, 'runs', 'B1__A__r1', 'app')), 'worked copies stay in the source dirs');
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'audit.jsonl'), 'utf8').split('\n')[0]).action, 'combine');
  const resume = spawnSync(process.execPath, [path.join(root, 'evals', 'run.mjs'), '--resume', out, '--report-only'], { encoding: 'utf8' });
  assert.notEqual(resume.status, 0);
  assert.match(resume.stderr, /made by --combine: re-run .* on the source dirs, then combine again/);
  fs.rmSync(scratch, { recursive: true, force: true });
});
