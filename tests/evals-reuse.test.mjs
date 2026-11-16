import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { aggregate } from '../evals/lib/aggregate.mjs';
import { detectPolicies, mcpCalls, parseJsonScore, skillFileRead } from '../evals/lib/checks.mjs';
import { combineEvals } from '../evals/lib/combine.mjs';
import { DEFAULTS, parseArgs, resolveConfig, taskForMode, validateTaskSet } from '../evals/lib/config.mjs';
import { copyTaskFiles, fixtureHash, runFixtureHash } from '../evals/lib/fixtures.mjs';
import { initProblems } from '../evals/lib/isolation.mjs';
import { diffAgainstPristine, runCommandCheck } from '../evals/lib/measure.mjs';
import { expectedMcpServers, mcpConfigFor, writeMcpConfig } from '../evals/lib/modes.mjs';
import { scoreTask, validateManifest } from '../evals/lib/mutants.mjs';
import { budgetAllows } from '../evals/lib/plan.mjs';
import { renderReport } from '../evals/lib/report.mjs';
import { backfillKeys, copyReusedRun, indexRuns, inputsKey, newRunsUsd, planReuse, reuseSourceDirs, runAppDir, runInputs, scanRuns } from '../evals/lib/reuse.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// removeTree refuses roots shallower than three path segments, so work one level below the temp dir.
const temp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-evals-reuse-')), 'w');
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
};

/** A fixture dir with a hidden test, a binary mockup and a nested spec dir. */
function makeFixture() {
  const dir = temp();
  fs.mkdirSync(path.join(dir, 'hidden'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'hidden', 'a.test.ts'), 'test a');
  fs.mkdirSync(path.join(dir, 'mockups', 'nested'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'mockups', 'home.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x00, 0x10]));
  fs.writeFileSync(path.join(dir, 'mockups', 'nested', 'notes.md'), '# notes');
  fs.mkdirSync(path.join(dir, 'figma-stub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'figma-stub', 'server.mjs'), '// stub');
  fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify({ name: 'f', gates: {}, setup: ['npm ci', 'node {fixtureDir}/scaffold.mjs .'] }));
  fs.writeFileSync(path.join(dir, 'scaffold.mjs'), '// generator');
  fs.mkdirSync(path.join(dir, 'template', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'template', 'src', 'app.ts'), 'export {};');
  fs.mkdirSync(path.join(dir, 'hidden', 'other'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'hidden', 'other', 'b.test.ts'), 'test b');
  return dir;
}

const task = {
  id: 't1', category: 'c', prompt: 'Do it',
  checks: [{ id: 'acc', type: 'command', run: 'vitest run x', copy: { 'hidden/a.test.ts': 'src/__hidden__/a.test.ts' } }],
  files: { 'mockups/home.png': 'docs/home.png' }
};
const config = { provider: 'claude', model: 'm', effort: 'medium', timeoutMin: 45, env: {}, http: false, browser: false, plugins: 'install', arms: { A: { ref: 'main', add: [], remove: [] }, B: { ref: 'fix/x', add: [], remove: [] } } };
const armInfo = (sha, extra = {}) => ({ ref: 'main', sha, add: [], remove: [], pluginMode: 'install', plugins: [{ id: 'pstack@m', version: '1.0', gitCommitSha: 'abc' }], hashes: { '.agents/policy/routing.md': 'h1' }, ...extra });
const armsInfo = { A: armInfo('sha1'), B: armInfo('sha2') };

test('inputsKey: same inputs give the same key, any single changed input a different one', () => {
  const fixtureDir = makeFixture();
  const base = { config, armsInfo, arm: 'A', task, rep: 1, runFixtureHash: 'f1', fixtureDir };
  const key = (overrides = {}) => inputsKey(runInputs({ ...base, ...overrides }));
  assert.equal(key(), key());
  assert.equal(key(), inputsKey(JSON.parse(JSON.stringify(runInputs(base)))), 'key order does not matter');
  const variants = {
    model: { config: { ...config, model: 'other' } },
    effort: { config: { ...config, effort: 'high' } },
    timeout: { config: { ...config, timeoutMin: 60 } },
    http: { config: { ...config, http: true } },
    browser: { config: { ...config, browser: true } },
    commit: { armsInfo: { ...armsInfo, A: armInfo('sha9') } },
    plugin: { armsInfo: { ...armsInfo, A: armInfo('sha1', { plugins: [{ id: 'pstack@m', version: '1.1', gitCommitSha: 'abc' }] }) } },
    installed: { armsInfo: { ...armsInfo, A: armInfo('sha1', { hashes: { '.agents/policy/routing.md': 'h2' } }) } },
    toggle: { armsInfo: { ...armsInfo, A: armInfo('sha1', { remove: ['skills/manual-qa'] }) } },
    prefix: { config: { ...config, arms: { ...config.arms, A: { ...config.arms.A, prefix: '/pstack:poteto-mode' } } } },
    prompt: { task: { ...task, prompt: 'Do it now' } },
    checks: { task: { ...task, checks: [{ ...task.checks[0], run: 'vitest run y' }] } },
    rep: { rep: 2 },
    fixture: { runFixtureHash: 'f2' },
    task: { task: { ...task, id: 't2' } }
  };
  const keys = new Set([key()]);
  for (const [name, overrides] of Object.entries(variants)) {
    const changed = key(overrides);
    assert.ok(!keys.has(changed), `${name} must change the key`);
    keys.add(changed);
  }
  // File contents count, binary task files and hidden tests included.
  const before = key();
  fs.appendFileSync(path.join(fixtureDir, 'mockups', 'home.png'), Buffer.from([0x01]));
  const afterPng = key();
  assert.notEqual(afterPng, before);
  fs.appendFileSync(path.join(fixtureDir, 'hidden', 'a.test.ts'), '\n');
  assert.notEqual(key(), afterPng);
  // The arm letter is not an input: arm B of one eval is arm A of another.
  assert.equal(inputsKey(runInputs({ ...base, arm: 'B', armsInfo: { A: armsInfo.B, B: armsInfo.A } })), key());
});

/** Two result dirs: eval 1 with finished runs of an arm, one failed, and a combined dir that must be skipped. */
function makeEvals(fixtureDir) {
  const home = temp();
  const key = (rep) => inputsKey(runInputs({ config, armsInfo, arm: 'B', task, rep, runFixtureHash: 'f1', fixtureDir }));
  const eval1 = path.join(home, 'eval1');
  const record = (rep, status) => ({ id: `t1__B__r${rep}`, task: 't1', arm: 'B', rep, status, cost: { usd: 2 }, prompt: 'Do it', inputsKey: key(rep), checks: [] });
  writeJson(path.join(eval1, 'config.json'), {});
  writeJson(path.join(eval1, 'results', 'runs', 't1__B__r1.json'), record(1, 'ok'));
  writeJson(path.join(eval1, 'results', 'runs', 't1__B__r2.json'), record(2, 'isolation'));
  fs.writeFileSync(path.join(eval1, 'results', 'runs', 'broken.json'), '{');
  fs.mkdirSync(path.join(eval1, 'runs', 't1__B__r1', 'app'), { recursive: true });
  fs.mkdirSync(path.join(eval1, 'runs', 't1__B__r1', 'session'), { recursive: true });
  fs.writeFileSync(path.join(eval1, 'runs', 't1__B__r1', 'diff.patch'), 'patch');
  fs.writeFileSync(path.join(eval1, 'runs', 't1__B__r1', 'transcript.jsonl'), '{}');
  fs.writeFileSync(path.join(eval1, 'runs', 't1__B__r1', 'session', 's.jsonl'), '{}');
  const combined = path.join(home, 'combined');
  writeJson(path.join(combined, 'config.json'), { combined: { inputs: [] } });
  writeJson(path.join(combined, 'results', 'runs', 't1__B__r1.json'), record(1, 'ok'));
  return { home, eval1, key };
}

test('reuse: eval 2 reuses eval 1\'s finished run as its arm A, never a non-ok run, and copies all but the app', () => {
  const fixtureDir = makeFixture();
  const { home, eval1 } = makeEvals(fixtureDir);
  const eval2 = path.join(home, 'eval2');
  // Eval 2 compares eval 1's arm B (now arm A) with a new arm.
  const config2 = { ...config, arms: { A: config.arms.B, B: { ref: 'fix/y', add: [], remove: [] } } };
  const arms2 = { A: armsInfo.B, B: armInfo('sha3') };
  const dirs = reuseSourceDirs({ evalsHome: home, exclude: eval2 });
  assert.deepEqual(dirs, [eval1], 'combined dirs are skipped');
  const index = indexRuns(scanRuns(dirs));
  const pending = [1, 2].flatMap((rep) => ['A', 'B'].map((arm) => ({ id: `t1__${arm}__r${rep}`, task: 't1', arm, rep })));
  const keyOf = (job) => inputsKey(runInputs({ config: config2, armsInfo: arms2, arm: job.arm, task, rep: job.rep, runFixtureHash: 'f1', fixtureDir }));
  const plan = planReuse({ pending, keyOf, index });
  assert.deepEqual(plan.reuse.map((entry) => entry.job.id), ['t1__A__r1'], 'rep 2 failed isolation in eval 1, so it is run again');
  assert.deepEqual(plan.run.map((job) => job.id), ['t1__B__r1', 't1__A__r2', 't1__B__r2']);
  // A non-ok record never stands in, even if it reached the index.
  const failed = { dir: eval1, runId: 'x', record: { status: 'error', inputsKey: keyOf(pending[0]) } };
  assert.equal(planReuse({ pending: [pending[0]], keyOf, index: new Map([[keyOf(pending[0]), [failed]]]) }).reuse.length, 0);
  // One source run stands in once: an A/A eval has equal keys in both arms.
  const twice = planReuse({ pending: [pending[0], { ...pending[0], id: 'same-key' }], keyOf, index });
  assert.equal(twice.reuse.length, 1);
  assert.equal(planReuse({ pending: [pending[0]], keyOf, index, used: [{ dir: eval1, runId: 't1__B__r1' }] }).reuse.length, 0);

  const { job, source } = plan.reuse[0];
  const record = copyReusedRun({ source, job, outDir: eval2, at: '2026-11-16T00:00:00.000Z' });
  assert.equal(record.id, 't1__A__r1');
  assert.equal(record.arm, 'A', 'the arm letter is remapped');
  assert.equal(record.reusedFrom.dir, eval1);
  assert.equal(record.reusedFrom.runId, 't1__B__r1');
  assert.equal(record.cost.usd, 2, 'the recorded cost is kept');
  const copied = path.join(eval2, 'runs', 't1__A__r1');
  assert.deepEqual(fs.readdirSync(copied).sort(), ['diff.patch', 'session', 'transcript.jsonl']);
  assert.equal(runAppDir(eval2, record), path.join(eval1, 'runs', 't1__B__r1', 'app'), '--recheck reads the source app');
  // A chain of reuses points at the origin.
  const again = planReuse({ pending: [job], keyOf, index: indexRuns([{ dir: eval2, runId: record.id, record }]), used: [] });
  assert.equal(copyReusedRun({ source: again.reuse[0].source, job, outDir: path.join(home, 'eval3') }).reusedFrom.dir, eval1);
});

test('reuse budget: reused runs cost this eval nothing and do not count against --max-runs', () => {
  const runs = [{ id: 'a', arm: 'A', cost: { usd: 3 }, reusedFrom: { dir: '/x', runId: 'a' } }, { id: 'b', arm: 'B', cost: { usd: 2 } }];
  assert.equal(newRunsUsd(runs), 2);
  assert.equal(budgetAllows({ maxUsd: 4, maxRuns: null }, { spentUsd: newRunsUsd(runs), runsDone: 1 }).ok, true);
  assert.equal(budgetAllows({ maxUsd: 4, maxRuns: null }, { spentUsd: runs.reduce((sum, run) => sum + run.cost.usd, 0), runsDone: 1 }).ok, false);
  const taskSet = { name: 's', categories: { c: { label: 'C' } }, tasks: [{ id: 't', category: 'c', prompt: 'p' }] };
  const record = (arm, extra) => ({ id: `t__${arm}__r1`, task: 't', category: 'c', arm, rep: 1, status: 'ok', gatesPass: true, wallMs: 60000, cost: { usd: arm === 'A' ? 3 : 2 }, checks: [{ id: 'k', level: 'required', pass: true, score: 1 }], ...extra });
  const all = [record('A', { reusedFrom: { dir: '/evals/old', runId: 't__B__r1', madeAt: '2026-11-10T00:00:00.000Z' } }), record('B')];
  const info = { A: armsInfo.A, B: armsInfo.B, identical: false, watched: [] };
  const summary = aggregate({ config: { taskIds: ['t'], watch: [], reps: 1 }, taskSet, armsInfo: info, runs: all, judgments: [] });
  assert.equal(summary.spend.runsUsd, 2);
  assert.deepEqual(summary.spend.reusedUsdByArm, { A: 3, B: 0 });
  assert.equal(summary.spend.totalUsd, 2);
  assert.equal(summary.cost.meanA, 3, 'cost comparisons keep the recorded cost');
  const report = renderReport({ summary, config: { name: 'x', reps: 1, arms: { A: {}, B: {} } }, armsInfo: info, taskSet, fixture: { name: 'f' } });
  assert.match(report, /Arm A: 1 of 1 runs reused\*\* from `\/evals\/old` \(1 run\(s\), made 2026-11-10\)/);
  assert.match(report, /\| t \(reused: A 1\/1, B 0\/1\) \|/);
  assert.match(report, /not made in the same time window/);
  assert.match(report, /Reused runs, arm A \(recorded cost/);
});

test('--combine carries reusedFrom through', () => {
  const input = (name, reusedFrom) => ({
    dir: `/e/${name}`, config: { provider: 'claude', model: 'm', effort: 'medium', arms: config.arms, taskIds: [`${name}-t`] }, armsInfo,
    taskSet: { name, fixture: 'f', categories: { c: {} }, tasks: [{ id: `${name}-t`, category: 'c', prompt: 'p' }] },
    runs: [{ id: `${name}-t__A__r1`, task: `${name}-t`, arm: 'A', rep: 1, category: 'c', ...(reusedFrom ? { reusedFrom } : {}) }], judgeSets: {}
  });
  const merged = combineEvals([input('one', { dir: '/old', runId: 'x', at: 'now' }), input('two')], { name: 'all' });
  assert.deepEqual(merged.runs[0].reusedFrom, { dir: '/old', runId: 'x', at: 'now' });
});

test('--backfill-keys keys an unchanged eval and refuses runs whose fixture or task changed', () => {
  const fixtureDir = makeFixture();
  const taskSet = { name: 's', fixture: 'f', categories: { c: {} }, tasks: [task, { ...task, id: 't2' }] };
  const runs = [{ id: 't1__A__r1', task: 't1', arm: 'A', rep: 1, status: 'ok', prompt: 'Do it' }, { id: 't2__A__r1', task: 't2', arm: 'A', rep: 1, status: 'ok', prompt: 'Do it' }];
  const stored = config;
  const hashes = { storedRunFixtureHash: 'f1', currentRunFixtureHash: 'f1' };
  const ok = backfillKeys({ config: stored, armsInfo, taskSet, runs, currentTaskSet: taskSet, fixtureDir, ...hashes });
  assert.equal(ok.updated.length, 2);
  assert.equal(ok.updated[0].inputsKey, inputsKey(runInputs({ config: stored, armsInfo, arm: 'A', task, rep: 1, runFixtureHash: 'f1', fixtureDir })), 'a backfilled key equals a new run\'s key');
  const changedFixture = backfillKeys({ config: stored, armsInfo, taskSet, runs, currentTaskSet: taskSet, fixtureDir, storedRunFixtureHash: 'f1', currentRunFixtureHash: 'f2' });
  assert.equal(changedFixture.updated.length, 0);
  assert.match(changedFixture.refused[0].reason, /fixture template hash f1 \(stored\) differs from f2 \(current\)/);
  const current = { ...taskSet, tasks: [task, { ...task, id: 't2', checks: [] }] };
  const changedTask = backfillKeys({ config: stored, armsInfo, taskSet, runs, currentTaskSet: current, fixtureDir, ...hashes });
  assert.deepEqual(changedTask.updated.map((run) => run.id), ['t1__A__r1']);
  assert.match(changedTask.refused[0].reason, /task t2: checks differ/);
});

test('task files copy binary files byte-exactly and directories recursively, and stay out of the diff', () => {
  const fixtureDir = makeFixture();
  const root = temp();
  const files = { 'mockups/home.png': 'docs/home.png', 'mockups/nested': 'docs/nested' };
  for (const dir of ['base', 'app']) {
    fs.mkdirSync(path.join(root, dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, dir, 'src', 'x.ts'), 'x');
    copyTaskFiles({ dir: fixtureDir }, files, path.join(root, dir));
  }
  assert.ok(fs.readFileSync(path.join(root, 'app', 'docs', 'home.png')).equals(fs.readFileSync(path.join(fixtureDir, 'mockups', 'home.png'))));
  assert.equal(fs.readFileSync(path.join(root, 'app', 'docs', 'nested', 'notes.md'), 'utf8'), '# notes');
  assert.equal(diffAgainstPristine({ diffExclude: [] }, path.join(root, 'base'), path.join(root, 'app')), '');
  fs.writeFileSync(path.join(root, 'app', 'src', 'x.ts'), 'y');
  assert.doesNotMatch(diffAgainstPristine({ diffExclude: [] }, path.join(root, 'base'), path.join(root, 'app')), /home\.png|notes\.md/);
});

test('--no-reuse, --reuse-from, --backfill-keys parse; concurrency defaults to 1', () => {
  assert.equal(DEFAULTS.concurrency, 1);
  assert.equal(DEFAULTS.reuse, true);
  assert.deepEqual(parseArgs(['--no-reuse', '--reuse-from', '/a', '--reuse-from', '/b', '--backfill-keys', '/c']), { reuse: false, reuseFrom: ['/a', '/b'], backfillKeys: '/c' });
});

test('json-score: parsing, pass at passAt, non-zero exit with a valid file keeps its score, no file scores 0', () => {
  assert.deepEqual(parseJsonScore('{"score":0.7,"components":{"visual":0.6},"detail":"ok"}'), { score: 0.7, components: { visual: 0.6 }, detail: 'ok' });
  for (const bad of ['nope', '{"score":1.2}', '{"score":"1"}', '{"score":0.5,"components":{"x":2}}', '{"score":0.5,"components":[1]}']) assert.equal(parseJsonScore(bad), null, bad);
  const app = temp();
  fs.mkdirSync(app, { recursive: true });
  const check = (script, extra = {}) => runCommandCheck({ id: 'visual', type: 'command', reporter: 'json-score', run: `node -e '${script}'`, ...extra }, { fixture: { dir: app }, app });
  const write = (json, code = 0) => `require("fs").writeFileSync(process.env.EVAL_SCORE_FILE, ${JSON.stringify(JSON.stringify(json))}); process.exit(${code})`;
  const full = check(write({ score: 1, components: { a: 1 }, detail: 'all good' }));
  assert.deepEqual([full.pass, full.score, full.components, full.detail, full.reporter], [true, 1, { a: 1 }, 'all good', 'json-score']);
  const partial = check(write({ score: 0.8, components: { a: 0.8 } }, 1), { passAt: 0.75 });
  assert.deepEqual([partial.pass, partial.score], [true, 0.8], 'exit 1 with a valid file keeps the score');
  assert.equal(check(write({ score: 0.8 })).pass, false, 'passAt defaults to 1');
  const missing = check('console.log("boom"); process.exit(1)');
  assert.deepEqual([missing.pass, missing.score], [false, 0]);
  assert.match(missing.detail, /no score file[\s\S]*boom/);
  assert.match(check('require("fs").writeFileSync(process.env.EVAL_SCORE_FILE, "{")').detail, /invalid score file/);
  assert.equal(check('setTimeout(() => {}, 5000)', { timeoutSec: 1 }).score, 0);
  assert.ok(!fs.existsSync(path.join(app, 'score.json')), 'the score file lives outside the app');
});

test('validateTaskSet accepts json-score and passAt only on json-score checks', () => {
  const set = (check) => ({ name: 's', fixture: 'f', categories: { c: {} }, tasks: [{ id: 't', category: 'c', prompt: 'p', checks: [{ id: 'v', type: 'command', run: 'x', ...check }] }] });
  assert.deepEqual(validateTaskSet(set({ reporter: 'json-score', passAt: 0.8 })), []);
  assert.match(validateTaskSet(set({ reporter: 'other' })).join(), /reporter must be vitest-json or json-score/);
  assert.match(validateTaskSet(set({ passAt: 0.8 })).join(), /passAt must be a number in 0\.\.1 on a json-score check/);
  assert.match(validateTaskSet(set({ reporter: 'json-score', passAt: 2 })).join(), /passAt/);
});

test('report: per-task json-score means per arm, and a descriptive score-component row for checks in at least 5 tasks', () => {
  const ids = ['t1', 't2', 't3', 't4', 't5'];
  const taskSet = { name: 's', categories: { c: { label: 'C' } }, tasks: ids.map((id) => ({ id, category: 'c', prompt: 'p' })) };
  const run = (id, arm, score) => ({ id: `${id}__${arm}__r1`, task: id, category: 'c', arm, rep: 1, status: 'ok', gatesPass: true, wallMs: 1, cost: { usd: 1 }, checks: [{ id: 'visual', level: 'required', reporter: 'json-score', pass: false, score, components: {} }] });
  const runs = ids.flatMap((id, index) => [run(id, 'A', 0.7 + index * 0.01), run(id, 'B', 0.8 + index * 0.01)]);
  const info = { A: armsInfo.A, B: armsInfo.B, identical: false, watched: [] };
  const summary = aggregate({ config: { taskIds: ids, watch: [], reps: 1 }, taskSet, armsInfo: info, runs, judgments: [] });
  assert.equal(summary.scoreComponents.length, 1);
  assert.equal(summary.scoreComponents[0].id, 'visual');
  const report = renderReport({ summary, config: { name: 'x', reps: 1, arms: { A: {}, B: {} } }, armsInfo: info, taskSet, fixture: { name: 'f' } });
  assert.match(report, /\| t1 \| c \|.*\| visual 0\.70 \/ 0\.80 \|/);
  assert.match(report, /### Score components \(descriptive\)[\s\S]*\| `visual` \| 0\.72 \| 0\.82 \| \+0\.10 \|/);
});

test('mutation score gate: references, untouched fixture and mutant drops, with killed counting by score', () => {
  const manifest = {
    task: 't', scoreGate: { referenceMin: 0.9, untouchedMax: 0.2, mutantMaxDrop: 0.05 },
    references: [{ file: 'r1.patch', source: 's' }, { file: 'r2.patch', source: 's' }],
    knownFailing: [{ file: 'k.patch', source: 's', reason: 'why' }],
    mutants: [{ file: 'm1.patch', wrong: 'w', violates: 'v', expect: 'killed' }, { file: 'm2.patch', wrong: 'w', violates: 'v', expect: 'killed' }]
  };
  assert.deepEqual(validateManifest(manifest, 't', ['r1.patch', 'r2.patch', 'k.patch', 'm1.patch', 'm2.patch']), []);
  assert.match(validateManifest({ ...manifest, scoreGate: { referenceMin: 2 } }, 't', ['r1.patch', 'r2.patch', 'k.patch', 'm1.patch', 'm2.patch']).join(), /scoreGate needs/);
  const results = (scores) => new Map(Object.entries(scores).map(([file, score]) => [file === 'untouched' ? null : file, { pass: score === 1, failed: [], score }]));
  const good = scoreTask({ manifest, results: results({ untouched: 0.1, 'r1.patch': 0.95, 'r2.patch': 0.92, 'k.patch': 0.5, 'm1.patch': 0.87, 'm2.patch': 0.3 }) });
  assert.deepEqual(good.errors, []);
  assert.equal(good.killed, 2, 'm1 at 0.87 is 0.05 below the lowest reference 0.92');
  const bad = scoreTask({ manifest, results: results({ untouched: 0.3, 'r1.patch': 0.85, 'r2.patch': 0.95, 'k.patch': 0.84, 'm1.patch': 0.83, 'm2.patch': 0.3 }) });
  assert.match(bad.errors.join('\n'), /untouched fixture scores 0\.30, above untouchedMax 0\.2/);
  assert.match(bad.errors.join('\n'), /reference r1\.patch scores 0\.85, under referenceMin 0\.9/);
  assert.match(bad.errors.join('\n'), /known-failing k\.patch scores 0\.84/);
  assert.match(bad.errors.join('\n'), /mutant m1\.patch scores 0\.83, less than 0\.05 below the lowest reference \(0\.85\)/);
  // Without a score gate a mutant is killed when any required check fails, as before.
  const plain = scoreTask({ manifest: { ...manifest, scoreGate: undefined }, results: new Map([[null, { pass: false, failed: ['a'] }], ['r1.patch', { pass: true, failed: [] }], ['m1.patch', { pass: false, failed: ['a'] }], ['m2.patch', { pass: false, failed: ['a'] }]]) });
  assert.equal(plain.killed, 2);
});

test('skill telemetry: any root, brace lists and the directory form count; a longer name or another file does not', () => {
  const skills = ['emil-design-eng', 'manual-qa', 'break-ui'];
  const fired = (events) => Object.entries(detectPolicies({ reads: [], commands: [], skills: [], ...events }, { skills }).skills).filter(([, value]) => value.fired).map(([name]) => name);
  assert.deepEqual(fired({ commands: ['S=~/.agents/skills; cat "$S/emil-design-eng/SKILL.md"'] }), ['emil-design-eng']);
  assert.deepEqual(fired({ commands: ['cat ~/.agents/skills/{emil-design-eng, manual-qa}/SKILL.md'] }), ['emil-design-eng', 'manual-qa']);
  assert.deepEqual(fired({ commands: ['cd ~/.claude/skills/break-ui/ && cat SKILL.md'] }), ['break-ui']);
  assert.deepEqual(fired({ reads: ['/home/u/.claude/plugins/cache/x/manual-qa/SKILL.md'] }), ['manual-qa']);
  assert.deepEqual(fired({ commands: ['cat skills/not-manual-qa/SKILL.md', 'ls skills/break-ui/references', 'cat skills/emil-design-eng/README.md skills/x/SKILL.md'] }), []);
  assert.equal(skillFileRead('cat ~/.agents/skills/{a,b}/SKILL.md', 'c'), false);
});

const modeSet = {
  name: 'vue-design', fixture: 'f', categories: { c: {} }, defaultMode: 'figma',
  modes: {
    figma: { serverFiles: 'figma-stub', mcpServers: { figma: { command: 'node', args: ['{serverDir}/server.mjs', '--app', '{appDir}', '--run', '{runDir}'], env: { FIGMA_FILE: '{serverDir}/file.json' } } } },
    files: {}
  },
  tasks: [{ id: 'd1', category: 'c', prompt: 'Build frame https://figma.com/x', files: { 'spec.md': 'docs/spec.md' }, modes: { files: { prompt: 'Build docs/home.png', files: { 'mockups/home.png': 'docs/home.png' } } } }]
};

test('modes: validation, per-arm modes, and prompt/files per mode', () => {
  assert.deepEqual(validateTaskSet(modeSet), []);
  assert.match(validateTaskSet({ ...modeSet, defaultMode: 'nope' }).join(), /defaultMode nope is not one of the modes/);
  assert.match(validateTaskSet({ ...modeSet, tasks: [{ ...modeSet.tasks[0], modes: { other: {} } }] }).join(), /mode other is not one of the task set's modes/);
  for (const server of [{ url: 'https://x' }, { type: 'http', command: 'x' }, { type: 'sse', command: 'x' }]) {
    assert.match(validateTaskSet({ ...modeSet, modes: { figma: { mcpServers: { s: server } } }, defaultMode: 'figma' }).join(), /only local stdio servers/);
  }
  assert.match(validateTaskSet({ ...modeSet, modes: { figma: { serverFiles: '../x' } } }).join(), /serverFiles must be a fixture-relative directory/);
  const resolved = resolveConfig({ b: 'main', bMode: 'files' }, modeSet);
  assert.equal(resolved.arms.A.mode, 'figma');
  assert.equal(resolved.arms.B.mode, 'files');
  assert.throws(() => resolveConfig({ b: 'main', aMode: 'nope' }, modeSet), /--a-mode nope: task set vue-design has modes figma, files/);
  assert.throws(() => resolveConfig({ b: 'main', aMode: 'figma' }, { ...modeSet, modes: undefined, defaultMode: undefined }), /has no modes/);
  const [base] = modeSet.tasks;
  assert.equal(taskForMode(base, 'figma'), base, 'a mode the task does not override leaves it as is');
  assert.deepEqual(taskForMode(base, 'files'), { ...base, prompt: 'Build docs/home.png', files: { 'spec.md': 'docs/spec.md', 'mockups/home.png': 'docs/home.png' } });
  // The mode is an input: same arm in two modes, two keys.
  const fixtureDir = makeFixture();
  const key = (mode) => inputsKey(runInputs({ config: { ...config, arms: { A: { ...config.arms.A, mode } } }, armsInfo, arm: 'A', task: base, taskSet: modeSet, rep: 1, runFixtureHash: 'f', fixtureDir }));
  const figma = key('figma');
  assert.notEqual(figma, key('files'));
  fs.appendFileSync(path.join(fixtureDir, 'figma-stub', 'server.mjs'), '\n// changed');
  assert.notEqual(key('figma'), figma, 'the server files are hashed by content');
});

test('modes: MCP config expands placeholders, copies the server out of the repo and strips credentials', () => {
  const fixtureDir = makeFixture();
  const runDir = temp();
  const appDir = path.join(runDir, 'app');
  assert.equal(writeMcpConfig({ taskSet: modeSet, modeName: 'files', fixtureDir, runDir, appDir }), null);
  const file = writeMcpConfig({ taskSet: modeSet, modeName: 'figma', fixtureDir, runDir, appDir });
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  const serverDir = path.join(runDir, 'mcp', 'figma');
  assert.deepEqual(Object.keys(written), ['mcpServers']);
  assert.deepEqual(written.mcpServers.figma.args, ['-u', 'ANTHROPIC_API_KEY', '-u', 'CLAUDE_CODE_OAUTH_TOKEN', 'node', `${serverDir}/server.mjs`, '--app', appDir, '--run', runDir]);
  assert.equal(written.mcpServers.figma.command, 'env');
  assert.equal(written.mcpServers.figma.env.FIGMA_FILE, `${serverDir}/file.json`);
  assert.equal(written.mcpServers.figma.env.DISABLE_TELEMETRY, '1');
  assert.ok(fs.existsSync(path.join(serverDir, 'server.mjs')), 'serverFiles are copied into the run');
  assert.doesNotMatch(JSON.stringify(written), new RegExp(fixtureDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'nothing under the fixture is named');
  assert.deepEqual(expectedMcpServers(modeSet, 'figma'), ['figma']);
  assert.deepEqual(expectedMcpServers(modeSet, 'files'), []);
});

test('modes: the isolation check wants exactly the mode\'s servers, connected', () => {
  const expected = { skills: [], plugins: [], agents: [] };
  const builtins = { skills: [], plugins: [], agents: [] };
  const app = '/var/tmp/x/app';
  const problems = (servers, mcpServers) => initProblems({ expected, builtins, init: { cwd: app, mcp_servers: servers }, runHome: '/var/tmp/x/home', app, mcpServers }).problems;
  assert.deepEqual(problems([], []), []);
  assert.deepEqual(problems([{ name: 'figma', status: 'connected' }], ['figma']), []);
  assert.match(problems([{ name: 'figma', status: 'connected' }], []).join(), /MCP servers loaded: figma/);
  assert.match(problems([], ['figma']).join(), /MCP server figma of the input mode is missing/);
  assert.match(problems([{ name: 'figma', status: 'failed' }], ['figma']).join(), /MCP server figma is failed, not connected/);
  assert.match(problems([{ name: 'figma', status: 'connected' }, { name: 'other', status: 'connected' }], ['figma']).join(), /MCP servers loaded: other/);
});

test('mcpCalls counts MCP tool calls by tool name, and the report shows them per arm', () => {
  const line = (name) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input: {} }] } });
  const transcript = [line('mcp__figma__get_frame'), line('mcp__figma__get_frame'), line('mcp__figma__get_image'), line('Read'), '"mcp__ not json'].join('\n');
  assert.deepEqual(mcpCalls(transcript), { mcp__figma__get_frame: 2, mcp__figma__get_image: 1 });
  const taskSet = { name: 's', categories: { c: { label: 'C' } }, tasks: [{ id: 't', category: 'c', prompt: 'p' }] };
  const run = (arm, calls) => ({ id: `t__${arm}__r1`, task: 't', category: 'c', arm, rep: 1, status: 'ok', gatesPass: true, wallMs: 1, cost: { usd: 1 }, checks: [], mcpCalls: calls });
  const info = { A: armsInfo.A, B: armsInfo.B, identical: false, watched: [] };
  const summary = aggregate({ config: { taskIds: ['t'], watch: [], reps: 1 }, taskSet, armsInfo: info, runs: [run('A', mcpCalls(transcript)), run('B', {})], judgments: [] });
  const report = renderReport({ summary, config: { name: 'x', reps: 1, arms: { A: { mode: 'figma' }, B: { mode: 'files' } } }, armsInfo: info, taskSet, fixture: { name: 'f' } });
  assert.match(report, /\| A \| 1\/1 \| 2 \| 1 \|/);
  assert.match(report, /\| B \| 0\/1 \| 0 \| 0 \|/);
  assert.match(report, /\| `figma` \|\n\| B \|[^\n]*\| `files` \|/);
});

test('modes smoke: the generated config starts the stdio test server, which answers MCP and sees no credentials', async () => {
  const runDir = temp();
  const taskSet = { modes: { echo: { serverFiles: 'mcp-echo', mcpServers: { echo: { command: process.execPath, args: ['{serverDir}/server.mjs'] } } } } };
  const file = writeMcpConfig({ taskSet, modeName: 'echo', fixtureDir: path.join(here, 'fixtures'), runDir, appDir: path.join(runDir, 'app') });
  const { command, args, env } = JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers.echo;
  const child = spawn(command, args, { env: { ...process.env, ...env, CLAUDE_CODE_OAUTH_TOKEN: 'secret' }, stdio: ['pipe', 'pipe', 'inherit'] });
  const replies = [];
  let buffer = '';
  const done = new Promise((resolve) => child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    replies.push(...lines.filter(Boolean).map((line) => JSON.parse(line)));
    if (replies.length === 3) resolve();
  }));
  for (const [id, method, params] of [[1, 'initialize', {}], [2, 'tools/list', {}], [3, 'tools/call', { name: 'echo', arguments: { text: 'hi' } }]]) child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  await done;
  child.kill();
  assert.equal(replies[0].result.serverInfo.name, 'echo');
  assert.equal(replies[1].result.tools[0].name, 'echo');
  assert.equal(replies[2].result.content[0].text, 'hi|credentials:none');
});

test('the key covers the fixture template, setup scripts and the task\'s own material, not other tasks\' hidden tests', () => {
  const fixtureDir = makeFixture();
  const key = () => inputsKey(runInputs({ config, armsInfo, arm: 'A', task, rep: 1, runFixtureHash: runFixtureHash(fixtureDir), fixtureDir }));
  const before = key();
  const fullBefore = fixtureHash({ dir: fixtureDir });
  fs.writeFileSync(path.join(fixtureDir, 'hidden', 'other', 'b.test.ts'), 'test b, edited');
  fs.mkdirSync(path.join(fixtureDir, 'mutants', 'other'), { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'mutants', 'other', 'm1.patch'), 'patch');
  assert.equal(key(), before, 'another task\'s hidden test and mutants are not inputs');
  assert.notEqual(fixtureHash({ dir: fixtureDir }), fullBefore, 'the full fixture hash (cache, resume guard) still sees them');
  fs.appendFileSync(path.join(fixtureDir, 'scaffold.mjs'), '\n');
  const afterScaffold = key();
  assert.notEqual(afterScaffold, before, 'a setup script is an input');
  fs.appendFileSync(path.join(fixtureDir, 'template', 'src', 'app.ts'), '\n');
  assert.notEqual(key(), afterScaffold, 'the template is an input');
});
