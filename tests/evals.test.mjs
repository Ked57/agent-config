import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { aggregate } from '../evals/lib/aggregate.mjs';
import { compareInventories } from '../evals/lib/arms.mjs';
import { countFeatures, detectPolicies, evaluateChecks, newDependencies, parseUnifiedDiff, stripComments } from '../evals/lib/checks.mjs';
import { DEFAULTS, globToRegExp, judgeSetId, parseArgs, parseToggle, resolveConfig, validateTaskSet } from '../evals/lib/config.mjs';
import { runCommandCheck } from '../evals/lib/measure.mjs';
import { buildJudgePrompt, combineVerdicts, judgePair, parseJudgeReply } from '../evals/lib/judge.mjs';
import { budgetAllows, buildRunQueue, planJudgePairs } from '../evals/lib/plan.mjs';
import { parseTranscript } from '../evals/lib/providers/claude.mjs';
import { renderReport } from '../evals/lib/report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shippedTaskSet = JSON.parse(fs.readFileSync(path.join(root, 'evals/tasks/vue-primevue.json'), 'utf8'));
const shippedFixture = JSON.parse(fs.readFileSync(path.join(root, 'evals/fixtures/vue-primevue/fixture.json'), 'utf8'));

const miniTaskSet = {
  name: 'mini',
  fixture: 'vue-primevue',
  categories: { web: { label: 'Web' }, control: { label: 'Control', control: true } },
  smoke: ['t-web'],
  tasks: [
    { id: 't-web', category: 'web', prompt: 'Do web', expectsPolicies: ['modern-web'], checks: [{ id: 'c', type: 'pattern', in: 'added', pattern: 'x', expect: 'present' }] },
    { id: 't-ctl', category: 'control', prompt: 'Do logic', expectsPolicies: [] }
  ]
};

test('parseArgs handles strings, numbers, lists, inline values and booleans', () => {
  const options = parseArgs(['--b', 'feat/x', '--reps=2', '--only', 'a,b', '--only', 'c', '--b-add', 'policy/x.md=main', '--smoke', '--no-judge', '--max-usd', '12.5']);
  assert.deepEqual(options, { b: 'feat/x', reps: 2, only: ['a', 'b', 'c'], bAdd: ['policy/x.md=main'], smoke: true, judge: false, maxUsd: 12.5 });
  assert.throws(() => parseArgs(['--bogus']), /Unknown option/);
  assert.throws(() => parseArgs(['--b']), /Missing value/);
  assert.throws(() => parseArgs(['--reps', 'many']), /non-negative number/);
});

test('parseToggle accepts policy and skill paths only', () => {
  assert.deepEqual(parseToggle('policy/modern-web.md=feat/x'), { path: 'policy/modern-web.md', source: 'feat/x' });
  assert.deepEqual(parseToggle('skills/manual-qa/'), { path: 'skills/manual-qa', source: null });
  assert.throws(() => parseToggle('bin/agent-config.mjs'), /policy\/ or skills\//);
  assert.throws(() => parseToggle('policy/../../etc'), /Invalid toggle/);
});

test('resolveConfig applies the smoke preset and validates task ids', () => {
  const smoke = resolveConfig({ b: 'main', smoke: true }, miniTaskSet);
  assert.deepEqual(smoke.taskIds, ['t-web']);
  assert.equal(smoke.reps, 1);
  assert.equal(smoke.arms.A.ref, 'main');
  assert.equal(smoke.name, 'main-vs-main-smoke');
  assert.equal(resolveConfig({ b: 'main', smoke: true, reps: 3 }, miniTaskSet).reps, 3);
  assert.equal(resolveConfig({ b: 'x', judgeCommand: 'llm' }, miniTaskSet).judgeProvider, 'command');
  assert.deepEqual(resolveConfig({ b: 'x', env: ['A=1=2'] }, miniTaskSet).env, { A: '1=2' });
  assert.throws(() => resolveConfig({}, miniTaskSet), /--b <ref> is required/);
  assert.throws(() => resolveConfig({ b: 'x', only: ['nope'] }, miniTaskSet), /Unknown task id/);
});

test('the shipped task set and fixture are valid', () => {
  assert.deepEqual(validateTaskSet(shippedTaskSet), []);
  assert.equal(shippedTaskSet.tasks.length, 16);
  assert.equal(shippedFixture.name, shippedTaskSet.fixture);
  for (const key of ['lint', 'typecheck', 'test', 'build']) assert.ok(shippedFixture.gates[key], `missing gate ${key}`);
  const categories = new Set(shippedTaskSet.tasks.map((task) => task.category));
  assert.deepEqual([...categories].sort(), Object.keys(shippedTaskSet.categories).sort());
});

test('validateTaskSet reports structural problems', () => {
  const broken = {
    name: 'b',
    fixture: 'f',
    categories: { web: {} },
    smoke: ['missing'],
    featurePatterns: { bad: '(' },
    tasks: [
      { id: 'a', category: 'web', prompt: 'p', checks: [{ id: 'x', type: 'pattern', in: 'final', pattern: 'y', expect: 'present' }] },
      { id: 'a', category: 'nope', prompt: '' }
    ]
  };
  const errors = validateTaskSet(broken).join('\n');
  assert.match(errors, /featurePatterns.bad: invalid regex/);
  assert.match(errors, /final checks need files/);
  assert.match(errors, /duplicate id/);
  assert.match(errors, /unknown category nope/);
  assert.match(errors, /prompt is required/);
  assert.match(errors, /smoke: unknown task id missing/);
});

test('globToRegExp supports ** and *', () => {
  assert.ok(globToRegExp('src/**/*.test.ts').test('src/utils/a.test.ts'));
  assert.ok(globToRegExp('src/**/*.test.ts').test('src/a.test.ts'));
  assert.ok(globToRegExp('src/views/**').test('src/views/deep/A.vue'));
  assert.ok(!globToRegExp('src/*.ts').test('src/utils/a.ts'));
  assert.ok(!globToRegExp('src/a.ts').test('src/aXts'));
});

const samplePatch = `diff -ruN a/src/App.vue b/src/App.vue
--- a/src/App.vue\t2026-11-15
+++ b/src/App.vue\t2026-11-15
@@ -1,2 +1,3 @@
 <template>
-  <main />
+  <main class="@container" />
+  <dialog closedby="any"></dialog>
diff -ruN a/src/utils/q.test.ts b/src/utils/q.test.ts
--- a/src/utils/q.test.ts\t1970-01-01
+++ b/src/utils/q.test.ts\t2026-11-15
@@ -0,0 +1 @@
+it('works', () => {})
Binary files a/public/hero.png and b/public/hero.png differ
`;

test('parseUnifiedDiff and evaluateChecks cover added, final and changed checks', () => {
  const diff = parseUnifiedDiff(samplePatch);
  assert.deepEqual(diff.changedFiles, ['src/App.vue', 'src/utils/q.test.ts', 'public/hero.png']);
  assert.equal(diff.addedLines, 3);
  assert.equal(diff.removedLines, 1);
  const finals = [{ path: 'src/stores/users.ts', content: 'export const countsByRole = 1' }];
  const results = evaluateChecks([
    { id: 'dialog', type: 'pattern', in: 'added', pattern: '<dialog\\b', expect: 'absent' },
    { id: 'cq', type: 'pattern', in: 'added', files: ['src/**'], pattern: '@container', expect: 'present', level: 'info' },
    { id: 'final', type: 'pattern', in: 'final', files: ['src/stores/*.ts'], pattern: 'countsByRole', expect: 'present' },
    { id: 'tests', type: 'changed', files: ['src/**/*.test.ts'], expect: 'any' },
    { id: 'views', type: 'changed', files: ['src/views/**'], expect: 'none' }
  ], diff, () => finals);
  assert.deepEqual(results.map((r) => [r.id, r.pass, r.level]), [['dialog', false, 'required'], ['cq', true, 'info'], ['final', true, 'required'], ['tests', true, 'required'], ['views', true, 'required']]);
  assert.deepEqual(countFeatures({ dialog: '<dialog', cq: '@container', none: 'zzz' }, diff.added), { dialog: 1, cq: 1 });
});

test('stripComments blanks comments but keeps URLs, protocol-relative strings and globs', () => {
  assert.deepEqual(stripComments([
    'const a = 1 // useConfirm',
    "const url = 'https://example.test/x' + \"//cdn\"",
    "include: ['src/**/*.test.ts'],",
    '<p>a</p> <!-- <dialog> --> <b>b</b>',
    'x(); /* one',
    '  two */ y()',
    ' * jsdoc body',
    ' */'
  ]), ['const a = 1 ', "const url = 'https://example.test/x' + \"//cdn\"", "include: ['src/**/*.test.ts'],", '<p>a</p>  <b>b</b>', 'x(); ', ' y()', '', '']);
});

test('pattern checks ignore comments unless the check opts in', () => {
  const diff = parseUnifiedDiff([
    '--- a/src/a.ts\t2026',
    '+++ b/src/a.ts\t2026',
    '@@ -1,3 +1,5 @@',
    ' /**',
    '+ * mentions window.confirm( in a doc block opened by a context line',
    ' */',
    '+// TODO useConfirm',
    '+run()',
    '@@ -9,1 +11,2 @@',
    '+const real = useToast()'
  ].join('\n'));
  assert.deepEqual(diff.code, ['', '', 'run()', 'const real = useToast()']);
  assert.equal(diff.added.length, 4);
  const finals = [{ path: 'src/a.ts', content: '// adminCount is gone\nexport const countsByRole = 1\n' }];
  const results = evaluateChecks([
    { id: 'comment', type: 'pattern', in: 'added', pattern: 'useConfirm', expect: 'present' },
    { id: 'raw', type: 'pattern', in: 'added', pattern: 'useConfirm', expect: 'present', comments: true },
    { id: 'absent', type: 'pattern', in: 'added', pattern: 'window\\.confirm\\(', expect: 'absent' },
    { id: 'code', type: 'pattern', in: 'added', pattern: 'useToast', expect: 'present' },
    { id: 'final-absent', type: 'pattern', in: 'final', files: ['src/*.ts'], pattern: 'adminCount', expect: 'absent' },
    { id: 'final-raw', type: 'pattern', in: 'final', files: ['src/*.ts'], pattern: 'adminCount', expect: 'absent', comments: true }
  ], diff, () => finals);
  assert.deepEqual(results.map((r) => [r.id, r.pass]), [['comment', false], ['raw', true], ['absent', true], ['code', true], ['final-absent', true], ['final-raw', false]]);
});

test('detectPolicies finds reads, shell reads, command signals and skills', () => {
  const events = {
    reads: ['/h/.agents/policy/routing.md', '/h/.agents/policy/vue-primevue.md'],
    commands: ['P=~/.agents/policy; cat $P/modern-web.md', 'DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.0 search "x" && npx -y modern-web-guidance@1.0.0 retrieve "y"'],
    skills: ['manual-qa']
  };
  const result = detectPolicies(events, {
    policies: ['routing', 'vue-primevue', 'modern-web', 'react'],
    skills: ['manual-qa', 'agent-browser'],
    signals: { 'modern-web': { commandPattern: 'modern-web-guidance@\\S+\\s+(search|retrieve)' } }
  });
  assert.deepEqual(result.policies.routing, { read: true, signalHits: null, fired: true });
  assert.deepEqual(result.policies['modern-web'], { read: true, signalHits: 2, fired: true });
  assert.equal(result.policies.react.fired, false);
  assert.equal(result.skills['manual-qa'].fired, true);
  assert.equal(result.skills['agent-browser'].fired, false);
  const signalOnly = detectPolicies({ reads: ['/h/.agents/policy/modern-web.md'], commands: [], skills: [] }, { policies: ['modern-web'], signals: { 'modern-web': { commandPattern: 'nope' } } });
  assert.deepEqual(signalOnly.policies['modern-web'], { read: true, signalHits: 0, fired: false });
});

test('newDependencies lists added npm packages', () => {
  assert.deepEqual(newDependencies({ dependencies: { vue: '1' } }, { dependencies: { vue: '1', zod: '3' }, devDependencies: { vitest: '1' } }), ['vitest', 'zod']);
});

const verdictJson = (p1, p2, preference) => JSON.stringify({
  patch1: { correctness: p1, accessibility: p1, fit: p1, platform: p1, scope: p1, notes: 'n1' },
  patch2: { correctness: p2, accessibility: p2, fit: p2, platform: p2, scope: p2, notes: 'n2' },
  preference,
  reason: 'r'
});

test('parseJudgeReply tolerates fences and prose but validates the shape', () => {
  assert.equal(parseJudgeReply(`Here you go:\n\`\`\`json\n${verdictJson(4, 3, '1')}\n\`\`\``).ok, true);
  assert.equal(parseJudgeReply(verdictJson(4, 3, 'TIE')).value.preference, 'tie');
  assert.match(parseJudgeReply('no json').error, /no JSON/);
  assert.match(parseJudgeReply('{"patch1": {"correctness": 4,}').error, /invalid JSON/);
  assert.match(parseJudgeReply(verdictJson(6, 3, '1')).error, /integer 1-5/);
  assert.match(parseJudgeReply(verdictJson(4, 3, 'A')).error, /preference/);
});

test('combineVerdicts maps presentation order back to sides and treats splits as ties', () => {
  const v = (text) => parseJudgeReply(text).value;
  const agree = combineVerdicts([{ order: ['A', 'B'], value: v(verdictJson(3, 5, '2')) }, { order: ['B', 'A'], value: v(verdictJson(5, 3, '1')) }], ['A', 'B']);
  assert.equal(agree.preference, 'B');
  assert.equal(agree.unanimous, true);
  assert.equal(agree.scores.A.overall, 3);
  assert.equal(agree.scores.B.overall, 5);
  const split = combineVerdicts([{ order: ['A', 'B'], value: v(verdictJson(4, 3, '1')) }, { order: ['B', 'A'], value: v(verdictJson(4, 3, '1')) }], ['A', 'B']);
  assert.equal(split.preference, 'tie');
  assert.equal(split.unanimous, false);
  assert.equal(split.scores.A.overall, 3.5);
});

test('judgePair retries malformed replies, alternates order and sums cost', async () => {
  const replies = ['garbage', verdictJson(2, 4, '2'), verdictJson(4, 2, '1')];
  const orders = [];
  const result = await judgePair({
    sides: ['A', 'B'],
    repeats: 2,
    random: () => 0.9,
    buildPrompt: (order) => { orders.push(order.join('')); return order.join(''); },
    ask: async () => ({ text: replies.shift(), costUsd: 0.1 })
  });
  assert.deepEqual(orders, ['AB', 'BA']);
  assert.equal(result.preference, 'B');
  assert.equal(result.repeats, 2);
  assert.ok(Math.abs(result.costUsd - 0.3) < 1e-9);
  await assert.rejects(judgePair({ sides: ['A', 'B'], repeats: 1, retries: 1, buildPrompt: () => '', ask: async () => ({ text: 'bad' }) }), /malformed after 2 attempts/);
  assert.match(buildJudgePrompt({ context: 'CTX', task: 'TASK', patch1: 'P1', patch2: 'P2' }), /CTX[\s\S]*TASK[\s\S]*P1[\s\S]*P2/);
});

test('parseTranscript normalises Claude stream-json', () => {
  const lines = [
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5' },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/h/.agents/policy/routing.md' } }, { type: 'tool_use', name: 'Bash', input: { command: 'ls' } }, { type: 'text', text: 'hi' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'manual-qa' } }] } },
    { type: 'result', subtype: 'success', is_error: false, num_turns: 3, duration_ms: 1200, total_cost_usd: 0.42, result: 'done', usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 } }
  ].map((line) => JSON.stringify(line)).join('\n');
  const parsed = parseTranscript(`${lines}\nnot json\n`);
  assert.equal(parsed.model, 'claude-opus-5-5');
  assert.equal(parsed.toolCalls, 3);
  assert.deepEqual(parsed.toolsByName, { Read: 1, Bash: 1, Skill: 1 });
  assert.deepEqual(parsed.events, { reads: ['/h/.agents/policy/routing.md'], commands: ['ls'], skills: ['manual-qa'] });
  assert.deepEqual(parsed.usage, { inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 });
  assert.equal(parsed.costUsd, 0.42);
  assert.equal(parsed.turns, 3);
});

test('buildRunQueue is deterministic and interleaves reps', () => {
  const queue = buildRunQueue({ taskIds: ['a', 'b'], reps: 2, seed: 7 });
  assert.deepEqual(queue, buildRunQueue({ taskIds: ['a', 'b'], reps: 2, seed: 7 }));
  assert.equal(queue.length, 8);
  assert.deepEqual(queue.slice(0, 4).map((job) => job.rep), [1, 1, 1, 1]);
  assert.deepEqual(new Set(queue.map((job) => job.id)).size, 8);
});

test('budgetAllows stops on spend and run caps', () => {
  assert.equal(budgetAllows({ maxUsd: 5, maxRuns: null }, { spentUsd: 5, runsDone: 0 }).ok, false);
  assert.equal(budgetAllows({ maxUsd: null, maxRuns: 3 }, { spentUsd: 0, runsDone: 2, runsInFlight: 1 }).ok, false);
  assert.equal(budgetAllows({ maxUsd: null, maxRuns: 3 }, { spentUsd: 0, runsDone: 3 }, 'judge').ok, true);
  assert.equal(budgetAllows({ maxUsd: 10, maxRuns: 10 }, { spentUsd: 1, runsDone: 1 }).ok, true);
});

const makeRun = (task, arm, rep, overrides = {}) => ({
  id: `${task}__${arm}__r${rep}`,
  task,
  arm,
  rep,
  status: 'ok',
  wallMs: 60000,
  agent: { turns: 10, toolCalls: 12 },
  cost: { usd: arm === 'B' ? 1.5 : 1, inputTokens: 10, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
  gates: { build: { ok: true } },
  gatesPass: true,
  checks: [{ id: 'c', label: 'C', level: 'required', pass: true }],
  deps: { added: [] },
  diff: { addedLines: 5 },
  features: {},
  telemetry: { policies: { 'modern-web': { read: arm === 'B', signalHits: arm === 'B' ? 1 : 0, fired: arm === 'B' } }, skills: {} },
  ...overrides
});

test('planJudgePairs builds A/B pairs and A#1-vs-A#2 controls', () => {
  const runs = [makeRun('t-web', 'A', 1), makeRun('t-web', 'B', 1), makeRun('t-web', 'A', 2), makeRun('t-web', 'B', 2), makeRun('t-ctl', 'A', 1), makeRun('t-ctl', 'B', 1, { status: 'error' })];
  const pairs = planJudgePairs({ runs, controls: 1, armsIdentical: false });
  assert.deepEqual(pairs.map((pair) => pair.id), ['t-web__AB__r1', 't-web__AB__r2', 't-web__AA__r1-r2']);
  assert.deepEqual(pairs[2].sides, ['A#1', 'A#2']);
  assert.equal(planJudgePairs({ runs, controls: 1, armsIdentical: true }).length, 2);
});

const judgment = (task, rep, kind, a, b, preference) => {
  const sides = kind === 'AB' ? ['A', 'B'] : ['A#1', 'A#2'];
  const dims = (score) => ({ correctness: score, accessibility: score, fit: score, platform: score, scope: score, overall: score });
  return { id: `${task}__${kind}__r${rep}`, kind, task, reps: [rep, rep], sides, scores: { [sides[0]]: dims(a), [sides[1]]: dims(b) }, preference, unanimous: true, votes: {}, notes: { [sides[0]]: [], [sides[1]]: [] }, reasons: ['because'], costUsd: 0.1 };
};

test('aggregate measures overhead, false triggers, noise floor and the task-level verdict', () => {
  const runs = [];
  for (let rep = 1; rep <= 6; rep += 1) {
    runs.push(makeRun('t-web', 'A', rep), makeRun('t-web', 'B', rep));
  }
  runs.push(makeRun('t-ctl', 'A', 1, { checks: [] }), makeRun('t-ctl', 'B', 1, { checks: [] }));
  const judgments = [];
  for (let rep = 1; rep <= 6; rep += 1) judgments.push(judgment('t-web', rep, 'AB', 3, 4.5, 'B'));
  judgments.push(judgment('t-web', 1, 'AA', 3.5, 3.6, 'tie'));
  const config = { taskIds: ['t-web', 't-ctl'], watch: [] };
  const armsInfo = { identical: false, watched: ['modern-web'], A: { policies: ['routing'] }, B: { policies: ['routing', 'modern-web'] } };
  const opusJudgments = judgments.map((j) => ({ ...j, preference: j.kind === 'AB' && j.reps[0] <= 2 ? 'A' : j.preference, scores: { ...j.scores }, costUsd: 0.5 }));
  const summary = aggregate({ config, taskSet: miniTaskSet, armsInfo, runs, judgments, activeJudgeSet: 'claude-sonnet-5-5', otherJudgeSets: { 'claude-opus-5-5': opusJudgments } });
  assert.ok(Math.abs(summary.overhead.costUsd - 0.5) < 1e-9);
  assert.ok(Math.abs(summary.cost.mean - 0.5) < 1e-9);
  assert.equal(summary.spend.runsUsd, 17.5);
  assert.ok(Math.abs(summary.spend.judgeUsd - 0.7) < 1e-9);
  assert.ok(Math.abs(summary.spend.otherJudgeSetsUsd['claude-opus-5-5'] - 3.5) < 1e-9);
  const [comparison] = summary.judgeComparisons;
  assert.equal(comparison.pairs, 7);
  assert.equal(comparison.decisiveFlips, 2);
  assert.ok(Math.abs(comparison.preferenceAgreement - 5 / 7) < 1e-9);
  assert.equal(comparison.meanAbsScoreDelta, 0);
  assert.equal(summary.telemetry.perPolicy['modern-web'].falseTriggers.B.controlFired, 1);
  assert.equal(summary.telemetry.perPolicy['modern-web'].falseTriggers.A, undefined);
  assert.equal(summary.telemetry.perPolicy['modern-web'].misses.B.missed.length, 0);
  assert.deepEqual(summary.telemetry.perPolicy['modern-web'].fired.B.tasks, ['t-ctl', 't-web']);
  assert.equal(summary.noise.pairs, 1);
  assert.ok(Math.abs(summary.noise.meanAbsDiff - 0.1) < 1e-9);
  // Two tasks, one without required checks: one paired task, so the rule cannot conclude.
  assert.equal(summary.primary.tasks, 1);
  assert.deepEqual(summary.sample.unscoredTasks, ['t-ctl']);
  assert.equal(summary.recommendation.verdict, 'cannot conclude');
  assert.match(summary.headline[0], /^Quality: cannot conclude: 1 paired task\(s\), at least 5 needed/);
  assert.match(summary.headline[0], /judge \(secondary\) favours neither/);
  assert.match(summary.headline[1], /^Cost per run \(USD\): /);
  for (const key of ['primary', 'allPass', 'judge', 'cost']) for (const field of ['mean', 'ci', 'bootstrapCi', 'mde', 'tasks', 'verdict']) assert.ok(field in summary[key], `${key}.${field}`);

  const identical = aggregate({ config, taskSet: miniTaskSet, armsInfo: { ...armsInfo, identical: true, watched: [] }, runs, judgments: judgments.filter((j) => j.kind === 'AB') });
  assert.equal(identical.noise.source, 'A/B pairs (arms identical)');

  const report = renderReport({
    summary,
    config: { ...config, name: 'demo', provider: 'claude', model: 'm', effort: 'medium', reps: 6, concurrency: 2, judge: true, judgeProvider: 'claude', judgeModel: 'j', judgeReps: 2, judgeControls: 1 },
    armsInfo: { ...armsInfo, changedFiles: ['.agents/policy/modern-web.md'], A: { ...armsInfo.A, ref: 'main', sha: 'abc1234def', skills: [] }, B: { ...armsInfo.B, ref: 'feat/x', sha: 'def5678abc', skills: [], add: [], remove: [] } },
    taskSet: miniTaskSet,
    fixture: { name: 'vue-primevue' },
    spend: { runsUsd: 20, judgeUsd: 1 }
  });
  for (const heading of ['## Verdict', '## Setup', '## Task-level comparison', '## Per-task results', '## Per-category means (descriptive)', '## Cost', '## Component telemetry', '## Judge (secondary)', '## Notable diffs']) assert.ok(report.includes(heading), heading);
  assert.ok(report.indexOf('## Verdict') < report.indexOf('## Setup'));
  assert.match(report, /\*\*Quality:\*\* cannot conclude/);
  assert.match(report, /\| t-web \| web \|/);
  assert.match(report, /\| modern-web \| B \| 7\/7 \| t-ctl, t-web \| 1\/1 \|/);
  assert.match(report, /total \$21\.70/);
  assert.match(report, /Judge `claude-sonnet-5-5` \(7 judgments, \$0\.100 each\)/);
  assert.match(report, /## Judge comparison/);
  assert.match(report, /decisive flips \(one judge prefers A, the other B\): 2\/6/);
});

test('compareInventories ignores routing when naming watched policies', () => {
  const a = { hashes: { '.agents/policy/routing.md': '1', '.agents/policy/react.md': '2' } };
  const b = { hashes: { '.agents/policy/routing.md': '9', '.agents/policy/react.md': '2', '.agents/policy/modern-web.md': '3', '.claude/skills/new/SKILL.md': '4' } };
  assert.deepEqual(compareInventories(a, b), { identical: false, changedFiles: ['.agents/policy/modern-web.md', '.agents/policy/routing.md', '.claude/skills/new/SKILL.md'], watched: ['modern-web', 'new'] });
  assert.equal(compareInventories(a, a).identical, true);
});

test('the ts-backend task set and fixture are valid and every hidden test file exists', () => {
  const taskSet = JSON.parse(fs.readFileSync(path.join(root, 'evals/tasks/ts-backend.json'), 'utf8'));
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'evals/fixtures/ts-backend/fixture.json'), 'utf8'));
  assert.deepEqual(validateTaskSet(taskSet), []);
  assert.equal(taskSet.fixture, fixture.name);
  assert.equal(taskSet.tasks.filter((task) => taskSet.categories[task.category].control).length, 2);
  for (const task of taskSet.tasks) {
    for (const check of task.checks.filter((c) => c.type === 'command')) {
      for (const from of Object.keys(check.copy)) assert.ok(fs.existsSync(path.join(root, 'evals/fixtures/ts-backend', from)), `${task.id}: missing ${from}`);
    }
  }
  const readme = taskSet.tasks.find((task) => task.id === 'N2-readme').checks.find((check) => check.id === 'readme-endpoints');
  const endpoints = ['GET /api/health', 'POST /api/auth/token', 'GET /api/me', 'GET /api/projects/{id}/tasks', 'PATCH /api/tasks/:id', 'POST /api/webhooks/billing'];
  assert.ok(new RegExp(readme.pattern, 'm').test(endpoints.join('\n...\n')));
  assert.ok(!new RegExp(readme.pattern, 'm').test(endpoints.slice(1).join('\n')));
});

test('validateTaskSet checks command checks', () => {
  const base = { name: 'x', fixture: 'f', categories: { c: {} } };
  const ok = { ...base, tasks: [{ id: 't', category: 'c', prompt: 'p', checks: [{ id: 'h', type: 'command', run: 'vitest run x', copy: { 'hidden/x.ts': 'src/x.ts' } }] }] };
  assert.deepEqual(validateTaskSet(ok), []);
  const bad = { ...base, tasks: [{ id: 't', category: 'c', prompt: 'p', checks: [{ id: 'h', type: 'command', run: '', expect: 'maybe', copy: { '../escape.ts': 'src/x.ts' } }] }] };
  const errors = validateTaskSet(bad).join('\n');
  assert.match(errors, /run is required/);
  assert.match(errors, /expect must be pass or fail/);
  assert.match(errors, /copy must map/);
});

test('judgeSetId separates judges by model, effort and command', () => {
  assert.equal(judgeSetId({ judgeProvider: 'claude', judgeModel: 'claude-sonnet-5-5', judgeEffort: 'medium' }), 'claude-sonnet-5-5');
  assert.equal(judgeSetId({ judgeProvider: 'claude', judgeModel: 'claude-opus-5-5', judgeEffort: 'high' }), 'claude-opus-5-5-high');
  const a = judgeSetId({ judgeProvider: 'command', judgeCommand: 'llm -m a' });
  assert.match(a, /^command-[0-9a-f]{8}$/);
  assert.notEqual(a, judgeSetId({ judgeProvider: 'command', judgeCommand: 'llm -m b' }));
  assert.equal(DEFAULTS.judgeModel, 'claude-sonnet-5-5');
  assert.equal(DEFAULTS.model, 'claude-opus-5-5');
});

test('runCommandCheck copies hidden files, runs the command and cleans up', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-fixture-'));
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-app-'));
  fs.mkdirSync(path.join(fixtureDir, 'hidden'));
  fs.writeFileSync(path.join(fixtureDir, 'hidden', 'probe.txt'), 'secret');
  const fixture = { dir: fixtureDir };
  const passing = runCommandCheck({ id: 'p', type: 'command', copy: { 'hidden/probe.txt': 'src/__hidden__/probe.txt' }, run: 'grep -q secret src/__hidden__/probe.txt' }, { fixture, app });
  assert.deepEqual([passing.pass, passing.level], [true, 'required']);
  assert.ok(!fs.existsSync(path.join(app, 'src', '__hidden__')), 'hidden files must be removed');
  const failing = runCommandCheck({ id: 'f', type: 'command', run: 'echo boom; exit 3', level: 'info' }, { fixture, app });
  assert.deepEqual([failing.pass, failing.level], [false, 'info']);
  assert.match(failing.detail, /boom/);
  assert.equal(runCommandCheck({ id: 'x', type: 'command', run: 'exit 1', expect: 'fail' }, { fixture, app }).pass, true);
});

test('single-arm mode needs no --b, skips judging and queues only arm A', () => {
  const config = resolveConfig({ singleArm: true, judge: true }, miniTaskSet);
  assert.equal(config.arms.B.ref, 'main');
  assert.equal(config.judge, false);
  assert.equal(config.name, 'main-single');
  const queue = buildRunQueue({ taskIds: ['a', 'b'], reps: 2, seed: 3, arms: ['A'] });
  assert.equal(queue.length, 4);
  assert.ok(queue.every((job) => job.arm === 'A'));
  const summary = aggregate({ config: { taskIds: ['t-web'], watch: [], singleArm: true }, taskSet: miniTaskSet, armsInfo: { identical: true, watched: [], A: { policies: [] }, B: { policies: [] } }, runs: [makeRun('t-web', 'A', 1)], judgments: [] });
  assert.equal(summary.recommendation.verdict, 'single-arm validation');
});

test('the quality task sets are valid and share one lint probe across both backend fixtures', () => {
  for (const name of ['quality-fresh', 'quality-legacy']) {
    const taskSet = JSON.parse(fs.readFileSync(path.join(root, 'evals/tasks', `${name}.json`), 'utf8'));
    assert.deepEqual(validateTaskSet(taskSet), [], name);
  }
  for (const file of ['probe.mjs', 'probe.ts', 'probe.test.ts', 'seed/ids.mock.ts', 'seed/ids.test.ts']) {
    const fresh = fs.readFileSync(path.join(root, 'evals/fixtures/ts-backend/hidden/quality', file), 'utf8');
    const legacy = fs.readFileSync(path.join(root, 'evals/fixtures/ts-backend-legacy/hidden/quality', file), 'utf8');
    assert.equal(legacy, fresh, `${file} differs between the ts-backend and ts-backend-legacy probes`);
  }
});
