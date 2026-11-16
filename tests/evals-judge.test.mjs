import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildJudgePrompt, combineVerdicts, DIMENSIONS, judgeDimensions, judgePair, parseJudgeReply, sanitisePatch } from '../evals/lib/judge.mjs';

const verdictJson = (p1, p2, preference) => JSON.stringify({
  patch1: { correctness: p1, accessibility: p1, fit: p1, platform: p1, scope: p1, notes: 'n1' },
  patch2: { correctness: p2, accessibility: p2, fit: p2, platform: p2, scope: p2, notes: 'n2' },
  preference,
  reason: 'r'
});

const savedPatch = [
  "diff -ruN '--exclude=node_modules' '--exclude=*.log' '--exclude=.eval-ready' '--exclude=.eval-manifest.json' a/src/api.ts b/src/api.ts",
  '--- a/src/api.ts\t2026-11-15 16:42:03.682233059 +0000',
  '+++ b/src/api.ts\t2026-11-15 16:49:04.799446685 +0000',
  '@@ -1,2 +1,2 @@',
  '--- a removed SQL comment\t2026-11-15 kept',
  '+++ b/not-a-header',
  ' context',
  'diff -ruN --exclude=dist a/new.ts b/new.ts',
  '--- a/new.ts\t1970-01-01 00:00:00.000000000 +0000',
  '+++ b/new.ts\t2026-11-15 16:50:00.000000000 +0000',
  'Binary files a/public/hero.webp and b/public/hero.webp differ'
].join('\n');

test('sanitisePatch drops the diff command line and file timestamps but keeps the change', () => {
  assert.equal(sanitisePatch(savedPatch), [
    'diff a/src/api.ts b/src/api.ts',
    '--- a/src/api.ts',
    '+++ b/src/api.ts',
    '@@ -1,2 +1,2 @@',
    '--- a removed SQL comment\t2026-11-15 kept',
    '+++ b/not-a-header',
    ' context',
    'diff a/new.ts b/new.ts',
    '--- a/new.ts',
    '+++ b/new.ts',
    'Binary files a/public/hero.webp and b/public/hero.webp differ'
  ].join('\n'));
});

test('buildJudgePrompt shows the judge neither harness markers nor timestamps', () => {
  const prompt = buildJudgePrompt({ context: 'CTX', task: 'TASK', patch1: savedPatch, patch2: savedPatch });
  assert.doesNotMatch(prompt, /eval-ready|eval-manifest|--exclude|16:49:04|1970-01-01/);
  assert.match(prompt, /## Patch 1\n\n```diff\ndiff a\/src\/api\.ts b\/src\/api\.ts\n--- a\/src\/api\.ts\n\+\+\+ b\/src\/api\.ts\n/);
});

test('combineVerdicts: both orders must agree, so one vote plus one tie is a tie', () => {
  const v = (text) => parseJudgeReply(text).value;
  const result = combineVerdicts([{ order: ['A', 'B'], value: v(verdictJson(4, 3, '1')) }, { order: ['B', 'A'], value: v(verdictJson(4, 4, 'tie')) }], ['A', 'B']);
  assert.equal(result.preference, 'tie');
  assert.equal(result.unanimous, false);
  assert.deepEqual(result.votes, { A: 1, B: 0, tie: 1 });
  const agree = combineVerdicts([{ order: ['A', 'B'], value: v(verdictJson(4, 3, '1')) }, { order: ['B', 'A'], value: v(verdictJson(3, 4, '2')) }], ['A', 'B']);
  assert.equal(agree.preference, 'A');
  const three = combineVerdicts([{ order: ['A', 'B'], value: v(verdictJson(4, 3, '1')) }, { order: ['B', 'A'], value: v(verdictJson(3, 4, '2')) }, { order: ['A', 'B'], value: v(verdictJson(4, 4, 'tie')) }], ['A', 'B']);
  assert.equal(three.preference, 'tie');
});

test('combineVerdicts: with --judge-reps 1 a single verdict stands', () => {
  const v = (text) => parseJudgeReply(text).value;
  assert.equal(combineVerdicts([{ order: ['B', 'A'], value: v(verdictJson(4, 3, '1')) }], ['A', 'B']).preference, 'B');
  assert.equal(combineVerdicts([{ order: ['B', 'A'], value: v(verdictJson(4, 4, 'tie')) }], ['A', 'B']).preference, 'tie');
});

test('judge dimensions are configurable per fixture and drive prompt, parsing and overall', async () => {
  const dims = ['correctness', 'tests', 'fit', 'scope', 'maintainability'];
  const prompt = buildJudgePrompt({ context: 'CTX', task: 'TASK', patch1: 'P1', patch2: 'P2', dimensions: dims });
  for (const dimension of dims) assert.match(prompt, new RegExp(`^- ${dimension}: `, 'm'));
  assert.doesNotMatch(prompt, /accessibility|platform|Baseline|modern/i);
  assert.match(prompt, /"patch1":\{"correctness":n,"tests":n,"fit":n,"scope":n,"maintainability":n,"notes"/);
  assert.match(buildJudgePrompt({ context: '', task: 'T', patch1: '', patch2: '' }), /^- accessibility: /m);
  assert.deepEqual(judgeDimensions(undefined), DIMENSIONS);
  assert.throws(() => judgeDimensions(['correctness', 'vibes']), /unknown: vibes/);
  const reply = (a, b, preference) => JSON.stringify({ patch1: Object.fromEntries(dims.map((d) => [d, a])), patch2: { ...Object.fromEntries(dims.map((d) => [d, b])), tests: 1 }, preference });
  assert.match(parseJudgeReply(reply(4, 3, '1')).error, /accessibility/);
  const result = await judgePair({ sides: ['A', 'B'], repeats: 1, dimensions: dims, random: () => 0.9, buildPrompt: () => '', ask: async () => ({ text: reply(4, 5, '2'), costUsd: 0 }) });
  assert.equal(result.preference, 'B');
  assert.deepEqual(Object.keys(result.scores.A), [...dims, 'overall']);
  assert.equal(result.scores.B.overall, (5 * 4 + 1) / 5);
  assert.deepEqual(result.dimensions, dims);
});

test('the shipped fixtures pick valid judge dimensions and carry no modern-web wording', () => {
  for (const name of ['vue-primevue', 'ts-backend']) {
    const fixture = JSON.parse(fs.readFileSync(new URL(`../evals/fixtures/${name}/fixture.json`, import.meta.url), 'utf8'));
    assert.ok(judgeDimensions(fixture.judgeDimensions).length >= 3);
    assert.doesNotMatch(fixture.judgeContext, /Baseline|Widely Available|modern/i);
  }
  const backend = JSON.parse(fs.readFileSync(new URL('../evals/fixtures/ts-backend/fixture.json', import.meta.url), 'utf8'));
  assert.ok(!backend.judgeDimensions.includes('accessibility') && !backend.judgeDimensions.includes('platform'));
});

test('judgePair records each verdict with its presentation order and balances the two orders', async () => {
  for (const first of [0.1, 0.9]) {
    const replies = [verdictJson(2, 4, '2'), verdictJson(5, 3, 'tie')];
    const result = await judgePair({ sides: ['A', 'B'], repeats: 2, random: () => first, buildPrompt: (order) => order.join(''), ask: async () => ({ text: replies.shift(), costUsd: 0 }) });
    const expectedFirst = first < 0.5 ? ['B', 'A'] : ['A', 'B'];
    assert.deepEqual(result.calls, [
      { order: expectedFirst, preference: '2', overall: [2, 4] },
      { order: [...expectedFirst].reverse(), preference: 'tie', overall: [5, 3] }
    ]);
  }
});
