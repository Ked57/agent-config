import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { aggregate, componentFired, decide } from '../evals/lib/aggregate.mjs';
import { commandTags, detectPolicies, parseVitestJson, scoreRun, slashInvocations } from '../evals/lib/checks.mjs';
import { runCommandCheck } from '../evals/lib/measure.mjs';
import { bootstrapCi, mde, pairedStats, ratioStats, tasksNeeded, tQuantile } from '../evals/lib/stats.mjs';

const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('tQuantile matches published Student t tables, including small df', () => {
  const table = [
    [0.975, 1, 12.7062], [0.975, 2, 4.3027], [0.975, 3, 3.1824], [0.975, 4, 2.7764], [0.975, 9, 2.2622],
    [0.975, 14, 2.1448], [0.975, 29, 2.0452], [0.975, 120, 1.9799], [0.8, 1, 1.3764], [0.8, 4, 0.9410],
    [0.8, 9, 0.8834], [0.8, 29, 0.8542], [0.995, 3, 5.8409], [0.95, 10, 1.8125]
  ];
  for (const [p, df, expected] of table) close(tQuantile(p, df), expected, 5e-4, `t(${p}, ${df})`);
  close(tQuantile(0.975, 1e9), 1.95996, 1e-4, 'normal limit');
  close(tQuantile(0.025, 4), -2.7764, 5e-4, 'lower tail');
  assert.equal(tQuantile(0.5, 3), 0);
  assert.throws(() => tQuantile(1, 3), RangeError);
});

test('pairedStats: paired-t CI, MDE and tasks needed', () => {
  const stats = pairedStats([0.1, 0.2, -0.1, 0.3, 0.05]);
  close(stats.mean, 0.11, 1e-12, 'mean');
  close(stats.sd, 0.151658, 1e-5, 'sd');
  const half = (2.7764 * 0.151658) / Math.sqrt(5);
  close(stats.ci[0], 0.11 - half, 1e-3, 'ci low');
  close(stats.ci[1], 0.11 + half, 1e-3, 'ci high');
  // MDE = (t_.975 + t_.8) × SD / √T.
  close(stats.mde, ((2.7764 + 0.941) * 0.151658) / Math.sqrt(5), 1e-3, 'mde');
  assert.ok(stats.bootstrapCi[0] < stats.mean && stats.bootstrapCi[1] > stats.mean);
  assert.deepEqual(pairedStats([0.1, 0.2, -0.1, 0.3, 0.05]).bootstrapCi, stats.bootstrapCi, 'seeded bootstrap is reproducible');
  // With many tasks the multiplier tends to 1.96 + 0.84 = 2.80.
  close(mde(1, 100000) * Math.sqrt(100000), 2.8016, 1e-3, 'large-T multiplier');
  assert.equal(mde(0.2, 1), null);
  assert.ok(mde(0.2, tasksNeeded(0.2, 0.1)) <= 0.1);
  assert.ok(mde(0.2, tasksNeeded(0.2, 0.1) - 1) > 0.1);
  assert.equal(tasksNeeded(0, 0.1), 5);
  assert.equal(tasksNeeded(0.01, 0.2), 5, 'never fewer than the 5-task minimum');
  assert.equal(pairedStats([0.3]).ci, null);
});

test('bootstrapCi and ratioStats resample tasks', () => {
  assert.equal(bootstrapCi([1], (xs) => xs[0]), null);
  const ratio = ratioStats([{ a: 1, b: 1.5 }, { a: 2, b: 2.6 }, { a: 1, b: 1.4 }, { a: 3, b: 4.5 }, { a: 1, b: 1.3 }]);
  close(ratio.mean, 11.3 / 8 - 1, 1e-12, 'ratio of means');
  assert.ok(ratio.bootstrapCi[0] > 0.2 && ratio.bootstrapCi[1] < 0.6, JSON.stringify(ratio.bootstrapCi));
});

// One run whose single required check has the given score.
const run = (task, arm, rep, score, extra = {}) => ({
  id: `${task}__${arm}__r${rep}`, task, arm, rep, status: 'ok', gatesPass: true, wallMs: 60000,
  agent: { turns: 10 }, cost: { usd: arm === 'B' ? 1.2 : 1 },
  checks: [{ id: 'hidden', level: 'required', pass: score === 1, score }], ...extra
});
const taskSetOf = (ids) => ({ name: 'synthetic', categories: { c: { label: 'C' } }, tasks: ids.map((id) => ({ id, category: 'c', prompt: 'p' })) });
const summarise = (runs, { identical = false, judgments = [] } = {}) => {
  const taskIds = [...new Set(runs.map((r) => r.task))];
  return aggregate({ config: { taskIds, watch: [], reps: 1, seed: 7 }, taskSet: taskSetOf(taskIds), armsInfo: { identical, watched: [], A: {}, B: {} }, runs, judgments });
};
const design = (diffs, { base = 0.5, reps = 1, noise = () => 0 } = {}) => diffs.flatMap((d, index) => Array.from({ length: reps }, (_, r) => [
  run(`t${index}`, 'A', r + 1, base + noise(index, r, 'A')),
  run(`t${index}`, 'B', r + 1, base + d + noise(index, r, 'B'))
]).flat());

test('verdict: B better, A better, no difference, cannot conclude, fewer than 5 tasks', () => {
  assert.equal(summarise(design([0.3, 0.25, 0.35, 0.3, 0.28, 0.32])).primary.verdict.code, 'B better');
  assert.equal(summarise(design([-0.3, -0.25, -0.35, -0.3, -0.28, -0.32])).primary.verdict.code, 'A better');
  const none = summarise(design([0.01, -0.02, 0.0, 0.02, -0.01, 0.01, 0.0, -0.01]));
  assert.equal(none.primary.verdict.code, 'no difference');
  assert.match(none.primary.verdict.text, /no difference larger than ±0\.10/);
  const wide = summarise(design([0.4, -0.3, 0.2, -0.1, 0.3, -0.35]));
  assert.equal(wide.primary.verdict.code, 'cannot conclude');
  assert.match(wide.primary.verdict.text, /MDE \d\.\d\d at 6 task\(s\); about \d+ tasks needed for an MDE of 0\.10/);
  const few = summarise(design([0.5, 0.5, 0.5, 0.5]));
  assert.equal(few.primary.verdict.code, 'cannot conclude');
  assert.match(few.primary.verdict.text, /4 paired task\(s\), at least 5 needed/);
  // A single rep per task still yields a verdict: the rule works at --reps 1.
  assert.equal(summarise(design([0.3, 0.25, 0.35, 0.3, 0.28])).primary.verdict.code, 'B better');
});

test('verdict at the ceiling says so and counts the tasks', () => {
  const runs = design([0, 0, 0, 0, 0, 0], { base: 1 });
  runs.push(run('t6', 'A', 1, 0), run('t6', 'B', 1, 0));
  const summary = summarise(runs);
  assert.equal(summary.primary.verdict.code, 'no difference');
  assert.match(summary.primary.verdict.text, /no difference observed; metric at ceiling\/floor on 7 of 7 tasks \(ceiling 6, floor 1\)/);
  assert.equal(summary.primary.ceiling, 6);
  assert.equal(summary.allPass.ceiling, 6);
  // Constant non-zero differences are still a difference.
  assert.equal(decide({ tasks: 6, mean: 0.2, sd: 0, ci: [0.2, 0.2], mde: 0, tasksNeeded: {} }).code, 'B better');
});

test('reps are not independent: more reps of the same tasks do not shrink the CI like more tasks do', () => {
  const diffs = [0.3, -0.1, 0.2, 0.0, 0.25, -0.05];
  const oneRep = summarise(design(diffs)).primary;
  const fiveReps = summarise(design(diffs, { reps: 5 })).primary;
  const width = (c) => c.ci[1] - c.ci[0];
  assert.equal(fiveReps.tasks, 6);
  close(width(fiveReps), width(oneRep), 1e-12, 'identical reps leave the CI unchanged');
  const moreTasks = summarise(design([...diffs, ...diffs, ...diffs, ...diffs, ...diffs])).primary;
  assert.equal(moreTasks.tasks, 30);
  assert.ok(width(moreTasks) < width(oneRep) / 2, 'five times the tasks at least halves the CI');
});

test('A/A: same statistics, and a "better" verdict between identical arms is flagged as a false positive', () => {
  const summary = summarise(design([0.3, 0.25, 0.35, 0.3, 0.28]), { identical: true });
  assert.equal(summary.primary.verdict.code, 'B better');
  assert.match(summary.scoringWarnings.join('\n'), /A\/A eval: the primary metric says "B better" between identical arms\. That is a false positive/);
  const quiet = summarise(design([0, 0, 0, 0, 0], { base: 1 }), { identical: true });
  assert.deepEqual(quiet.scoringWarnings, []);
});

test('the judge is secondary: it breaks a tie but never upgrades the headline', () => {
  const judgment = (task, a, b) => ({ id: `${task}__AB__r1`, kind: 'AB', task, reps: [1, 1], sides: ['A', 'B'], runs: [`${task}__A__r1`, `${task}__B__r1`], scores: { A: { correctness: a, overall: a }, B: { correctness: b, overall: b } }, preference: b > a ? 'B' : 'tie', unanimous: true, notes: { A: [], B: [] }, reasons: [] });
  const diffs = [0.01, -0.01, 0, 0.02, -0.02, 0];
  const judgments = diffs.map((_, index) => judgment(`t${index}`, 3, 4 + (index % 2) * 0.2));
  const summary = summarise(design(diffs), { judgments });
  assert.equal(summary.primary.verdict.code, 'no difference');
  assert.equal(summary.judge.verdict.code, 'B better');
  assert.match(summary.headline[0], /^Quality: no difference larger than ±0\.10.*; judge \(secondary\) favours B\./);
  assert.equal(summary.recommendation.verdict, 'no difference');
  const better = summarise(design([-0.3, -0.25, -0.35, -0.3, -0.28, -0.32]), { judgments });
  assert.match(better.headline[0], /^Quality: A better/);
  assert.doesNotMatch(better.headline[0], /judge/);
});

test('scoreRun: mean required-check score, 0 on gate failure or error, null without required checks', () => {
  const checks = [{ level: 'required', pass: false, score: 0.75 }, { level: 'required', pass: true }, { level: 'info', pass: false, score: 0 }];
  assert.deepEqual(scoreRun({ status: 'ok', gatesPass: true, checks }), { score: 0.875, allPass: false });
  assert.deepEqual(scoreRun({ status: 'ok', gatesPass: false, checks }), { score: 0, allPass: false });
  assert.deepEqual(scoreRun({ status: 'error', gatesPass: true, checks }), { score: 0, allPass: false });
  assert.deepEqual(scoreRun({ status: 'ok', gatesPass: true, checks: [{ level: 'info', pass: true }] }), { score: null, allPass: true });
  // Old records without check scores: derived from pass.
  assert.deepEqual(scoreRun({ status: 'ok', gatesPass: true, checks: [{ level: 'required', pass: true }, { level: 'required', pass: false }] }), { score: 0.5, allPass: false });
});

test('isolation runs are excluded from every figure and counted in a warning', () => {
  const runs = design([0.3, 0.25, 0.35, 0.3, 0.28]);
  runs.push(run('t9', 'A', 1, 1, { status: 'isolation' }), run('t9', 'B', 1, 0));
  const summary = summarise(runs);
  assert.equal(summary.runs, 11);
  assert.deepEqual(summary.sample.excludedRuns, ['t9__A__r1']);
  assert.equal(summary.primary.tasks, 5);
  assert.match(summary.scoringWarnings.join('\n'), /1 run\(s\) failed the isolation check/);
});

// Captured from `vitest run <file> --reporter=json --outputFile=...` (Vitest 5.1), trimmed.
const VITEST_MIXED = JSON.stringify({ numTotalTests: 4, numPassedTests: 2, numFailedTests: 1, numPendingTests: 1, success: false, testResults: [{ name: '/x/src/mixed.test.ts', status: 'failed', message: '', assertionResults: [
  { ancestorTitles: ['pagination'], fullName: 'pagination returns a cursor', status: 'passed', title: 'returns a cursor', failureMessages: [] },
  { ancestorTitles: ['pagination'], fullName: 'pagination caps limit', status: 'failed', title: 'caps limit', failureMessages: ['AssertionError: expected 2 to be 3'] },
  { ancestorTitles: ['pagination'], fullName: 'pagination skipped one', status: 'skipped', title: 'skipped one', failureMessages: [] },
  { ancestorTitles: [], fullName: 'top level passes', status: 'passed', title: 'top level passes', failureMessages: [] }
] }] });
const VITEST_BROKEN = JSON.stringify({ numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, success: false, testResults: [{ assertionResults: [], status: 'failed', message: "Cannot find module './missing-module' imported from /x/src/broken.test.ts", name: '/x/src/broken.test.ts' }] });
const VITEST_OK = JSON.stringify({ numTotalTests: 2, numPassedTests: 2, success: true, testResults: [{ name: '/x/src/ok.test.ts', status: 'passed', message: '', assertionResults: [{ fullName: 'a', status: 'passed' }, { fullName: 'b', status: 'passed' }] }] });

test('parseVitestJson counts run test cases and spots files that failed to load', () => {
  assert.deepEqual(parseVitestJson(VITEST_MIXED), { passed: 2, total: 3, failed: ['pagination caps limit'], loadFailed: [] });
  assert.deepEqual(parseVitestJson(VITEST_BROKEN), { passed: 0, total: 0, failed: [], loadFailed: [{ file: 'src/broken.test.ts', message: "Cannot find module './missing-module' imported from /x/src/broken.test.ts" }] });
  assert.equal(parseVitestJson(VITEST_OK).passed, 2);
  assert.equal(parseVitestJson('not json'), null);
  assert.equal(parseVitestJson('{"a":1}'), null);
});

test('runCommandCheck with the vitest-json reporter scores passed/total, 0 on load failure and timeout', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-vitest-test-'));
  const app = path.join(scratch, 'app');
  fs.mkdirSync(app);
  const fixture = { dir: scratch };
  // Stands in for vitest: writes a saved report to --outputFile and exits like vitest would.
  const fake = path.join(scratch, 'fake-vitest.mjs');
  fs.writeFileSync(fake, `import fs from 'node:fs';
const [sample, code, sleep] = process.argv.slice(2);
const out = process.argv.find((arg) => arg.startsWith('--outputFile='))?.slice(13);
if (!process.argv.includes('--reporter=json')) process.exit(9);
if (sleep) await new Promise((resolve) => setTimeout(resolve, Number(sleep)));
if (out && sample !== 'none') fs.writeFileSync(out, fs.readFileSync(sample, 'utf8'));
process.exit(Number(code));
`);
  const sample = (name, text) => {
    const file = path.join(scratch, `${name}.json`);
    fs.writeFileSync(file, text);
    return file;
  };
  const check = (args, extra = {}) => runCommandCheck({ id: 'h', type: 'command', reporter: 'vitest-json', run: `node ${fake} ${args}`, ...extra }, { fixture, app });
  const mixed = check(`${sample('mixed', VITEST_MIXED)} 1`);
  assert.deepEqual([mixed.pass, mixed.passed, mixed.total], [false, 2, 3]);
  close(mixed.score, 2 / 3, 1e-12, 'mixed score');
  assert.match(mixed.detail, /failed: pagination caps limit/);
  const broken = check(`${sample('broken', VITEST_BROKEN)} 1`);
  assert.deepEqual([broken.pass, broken.score], [false, 0]);
  assert.match(broken.detail, /failed to load src\/broken\.test\.ts/);
  const ok = check(`${sample('ok', VITEST_OK)} 0`);
  assert.deepEqual([ok.pass, ok.score, ok.passed, ok.total], [true, 1, 2, 2]);
  const missing = check('none 1');
  assert.deepEqual([missing.pass, missing.score], [false, 0]);
  assert.match(missing.detail, /no Vitest JSON report/);
  const slow = check(`${sample('ok2', VITEST_OK)} 0 5000`, { timeoutSec: 0.5 });
  assert.deepEqual([slow.pass, slow.score], [false, 0]);
  assert.match(slow.detail, /timed out/);
  // Without a reporter: 1 or 0.
  assert.equal(runCommandCheck({ id: 'p', type: 'command', run: 'true' }, { fixture, app }).score, 1);
  assert.equal(runCommandCheck({ id: 'f', type: 'command', run: 'false' }, { fixture, app }).score, 0);
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('detectPolicies reports plugins from Skill calls, a slash prompt and expanded command tags', () => {
  const events = { reads: [], commands: [], skills: ['mattpocock-skills:tdd'] };
  const result = detectPolicies(events, { skills: ['tdd', 'poteto-mode', 'grilling'], plugins: ['mattpocock-skills', 'pstack', 'taste-skill'], prompt: '/pstack:poteto-mode fix the bug', commandTags: ['/taste-skill:design-taste-frontend'] });
  assert.deepEqual(result.plugins['mattpocock-skills'], { fired: true, skills: ['mattpocock-skills:tdd'] });
  assert.deepEqual(result.plugins.pstack, { fired: true, skills: ['pstack:poteto-mode'] });
  assert.deepEqual(result.plugins['taste-skill'], { fired: true, skills: ['taste-skill:design-taste-frontend'] });
  assert.equal(result.skills.tdd.fired, true);
  assert.equal(result.skills['poteto-mode'].fired, true);
  assert.equal(result.skills.grilling.fired, false);
  assert.equal(detectPolicies(events, { plugins: ['pstack'], prompt: 'please use /pstack:poteto-mode' }).plugins.pstack.fired, false, 'only a leading slash command counts');
  assert.deepEqual(commandTags('{"content":"<command-name>/pstack:poteto-mode</command-name>\\n<command-args>x</command-args>"}'), ['/pstack:poteto-mode']);
  assert.deepEqual(slashInvocations({ prompt: '  /manual-qa now' }), ['manual-qa']);
});

test('componentFired also reads the run prompt and the session log commands recorded after measuring', () => {
  const base = { telemetry: { policies: {}, skills: {}, plugins: {} } };
  assert.equal(componentFired({ ...base, prompt: '/pstack:poteto-mode do it' }, 'plugin:pstack'), true);
  assert.equal(componentFired({ ...base, isolation: { commands: ['mattpocock-skills:tdd'] } }, 'tdd'), true);
  assert.equal(componentFired({ telemetry: { plugins: { pstack: { fired: true } } } }, 'plugin:pstack'), true);
  assert.equal(componentFired(base, 'plugin:pstack'), false);
});

test('telemetry accepts expectsComponents and reports plugin firing per arm', () => {
  const taskSet = { name: 's', categories: { c: {}, ctl: { control: true } }, tasks: [{ id: 'a', category: 'c', prompt: 'p', expectsComponents: ['plugin:pstack'] }, { id: 'b', category: 'ctl', prompt: 'p' }] };
  const fired = (task, arm, on) => ({ ...run(task, arm, 1, 1), telemetry: { policies: {}, skills: {}, plugins: { pstack: { fired: on } } } });
  const runs = [fired('a', 'A', false), fired('a', 'B', true), fired('b', 'A', false), fired('b', 'B', true)];
  const summary = aggregate({ config: { taskIds: ['a', 'b'], watch: [] }, taskSet, armsInfo: { identical: false, watched: ['plugin:pstack'], A: { plugins: [] }, B: { plugins: [{ name: 'pstack', id: 'pstack@cursor-plugins' }] } }, runs, judgments: [] });
  const entry = summary.telemetry.perPolicy['plugin:pstack'];
  assert.equal(entry.fired.A, undefined, 'arm A does not have the plugin');
  assert.deepEqual(entry.fired.B, { runs: 2, fired: ['a__B__r1', 'b__B__r1'], tasks: ['a', 'b'] });
  assert.equal(entry.misses.B.missed.length, 0);
  assert.equal(entry.falseTriggers.B.controlFired, 1);
});

test('applyTieRule re-derives saved preferences with the both-orders-agree rule', async () => {
  const { applyTieRule } = await import('../evals/lib/aggregate.mjs');
  const saved = { preference: 'A', calls: [{ order: ['A', 'B'], preference: '1' }, { order: ['B', 'A'], preference: 'tie' }] };
  assert.deepEqual(applyTieRule(saved), { ...saved, preference: 'tie', preferenceAsRecorded: 'A' });
  const agreed = { preference: 'B', calls: [{ order: ['A', 'B'], preference: '2' }, { order: ['B', 'A'], preference: '1' }] };
  assert.equal(applyTieRule(agreed), agreed);
  const legacy = { preference: 'A' };
  assert.equal(applyTieRule(legacy), legacy);
});

test('applyTieRule falls back to the votes tally of older records', async () => {
  const { applyTieRule } = await import('../evals/lib/aggregate.mjs');
  assert.equal(applyTieRule({ sides: ['A', 'B'], preference: 'B', votes: { A: 0, B: 1, tie: 1 } }).preference, 'tie');
  assert.equal(applyTieRule({ sides: ['A#1', 'A#2'], preference: 'A#1', votes: { 'A#1': 2, 'A#2': 0, tie: 0 } }).preference, 'A#1');
});
