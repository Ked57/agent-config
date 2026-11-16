import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadTaskSets, taskMutants } from '../evals/mutants.mjs';
import { declaredKillRate, MIN_KILL_RATE, normalisePatch, scoreTask, validateManifest } from '../evals/lib/mutants.mjs';

// Structural half of the mutation gate, fast enough for `npm run verify`. The behavioural half
// (applying each patch and running the hidden checks) is `npm run eval:mutants`.
const withHiddenTests = (task) => (task.checks ?? []).some((check) => check.type === 'command' && Object.keys(check.copy ?? {}).some((from) => from.startsWith('hidden/')));

for (const { taskSet, fixture } of loadTaskSets()) {
  for (const task of taskSet.tasks) {
    const found = taskMutants(fixture, task);
    if (!found && !withHiddenTests(task)) continue;
    test(`mutation gate manifest: ${taskSet.name}/${task.id}`, () => {
      assert.ok(found, `${task.id} has hidden tests but no mutants/${task.id}/manifest.json`);
      assert.deepEqual(validateManifest(found.manifest, task.id, found.files), []);
      const minimum = taskSet.categories?.[task.category]?.control ? 3 : 5;
      assert.ok(found.manifest.mutants.length >= minimum, `${task.id}: ${found.manifest.mutants.length} mutants, need at least ${minimum}`);
      assert.ok(declaredKillRate(found.manifest) >= MIN_KILL_RATE, `${task.id}: declared kill rate under ${MIN_KILL_RATE * 100}%`);
      for (const file of found.files.filter((name) => name.endsWith('.patch'))) {
        const check = spawnSync('git', ['apply', '--check', `${found.dir}/${file}`], { cwd: fixture.templateDir, encoding: 'utf8' });
        assert.equal(check.status, 0, `${task.id}/${file} does not apply to the template: ${check.stderr}`);
      }
    });
  }
}

test('normalisePatch drops timestamps and exclude lists and marks created and deleted files', () => {
  const raw = [
    'diff -ruN --exclude=node_modules --exclude=dist a/src/new.ts b/src/new.ts',
    '--- a/src/new.ts\t1970-01-01 00:00:00.000000000 +0000',
    '+++ b/src/new.ts\t2026-11-16 00:07:24.393315712 +0000',
    '@@ -0,0 +1 @@',
    '+x',
    'diff -ruN --exclude=node_modules a/src/old.ts b/src/old.ts',
    '--- a/src/old.ts\t2026-11-16 00:07:24.393315712 +0000',
    '+++ b/src/old.ts\t1970-01-01 00:00:00.000000000 +0000',
    '@@ -1 +0,0 @@',
    '-y',
    ''
  ].join('\n');
  assert.equal(normalisePatch(raw), [
    'diff -ruN a/src/new.ts b/src/new.ts',
    '--- /dev/null',
    '+++ b/src/new.ts',
    '@@ -0,0 +1 @@',
    '+x',
    'diff -ruN a/src/old.ts b/src/old.ts',
    '--- a/src/old.ts',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-y',
    ''
  ].join('\n'));
});

const manifest = {
  task: 'T1',
  references: [{ file: 'reference.patch', source: 'run' }],
  knownFailing: [{ file: 'known.patch', source: 'run', reason: 'r' }],
  mutants: [
    { file: 'm1.patch', wrong: 'w', violates: 'v', expect: 'killed' },
    { file: 'm2.patch', wrong: 'w', violates: 'v', expect: 'killed' },
    { file: 'm3.patch', wrong: 'w', violates: 'v', expect: 'killed' },
    { file: 'm4.patch', wrong: 'w', violates: 'v', expect: 'killed' },
    { file: 'm5.patch', wrong: 'w', violates: 'v', expect: 'survives', why: 'y' }
  ]
};
const fail = (...failed) => ({ pass: false, failed });
const pass = { pass: true, failed: [] };

test('validateManifest names missing files, unlisted patches and incomplete entries', () => {
  const files = ['manifest.json', 'reference.patch', 'known.patch', 'm1.patch', 'm2.patch', 'm3.patch', 'm4.patch', 'm5.patch'];
  assert.deepEqual(validateManifest(manifest, 'T1', files), []);
  const problems = validateManifest({ ...manifest, mutants: [{ file: 'm1.patch', expect: 'survives' }] }, 'T2', [...files, 'stray.patch']);
  assert.ok(problems.some((problem) => problem.includes('expected T2')));
  assert.ok(problems.some((problem) => problem.includes('needs wrong and violates')));
  assert.ok(problems.some((problem) => problem.includes('needs why')));
  assert.ok(problems.some((problem) => problem.includes('stray.patch is not listed')));
  assert.ok(problems.some((problem) => problem.includes('m2.patch is not listed')));
});

test('scoreTask passes a task whose references pass and whose mutants die as declared', () => {
  const results = new Map([[null, fail('acceptance')], ['reference.patch', pass], ['known.patch', fail('acceptance')], ['m1.patch', fail('acceptance')], ['m2.patch', fail('acceptance')], ['m3.patch', fail('acceptance')], ['m4.patch', fail('acceptance')], ['m5.patch', pass]]);
  const score = scoreTask({ manifest, results });
  assert.deepEqual(score.errors, []);
  assert.equal(score.killRate, 0.8);
});

test('scoreTask reports every broken rule', () => {
  const results = new Map([[null, pass], ['reference.patch', fail('acceptance')], ['known.patch', pass], ['m1.patch', pass], ['m2.patch', fail('acceptance')], ['m3.patch', fail('acceptance')], ['m4.patch', fail('acceptance')], ['m5.patch', fail('acceptance')]]);
  const { errors, unexpectedKills } = scoreTask({ manifest, results });
  assert.ok(errors.some((error) => error.includes('untouched fixture passes')));
  assert.ok(errors.some((error) => error.includes('reference reference.patch fails acceptance')));
  assert.ok(errors.some((error) => error.includes('known-failing known.patch now passes')));
  assert.ok(errors.some((error) => error.includes('m1.patch survives')));
  assert.deepEqual(unexpectedKills, ['m5.patch']);
});

test('scoreTask fails a kill rate under 80% and a behaviour-preserving task whose hidden check fails untouched', () => {
  const results = new Map([[null, fail('behaviour', 'service-added')], ['reference.patch', pass], ['known.patch', fail('x')], ['m1.patch', pass], ['m2.patch', fail('x')], ['m3.patch', fail('x')], ['m4.patch', pass], ['m5.patch', pass]]);
  const loose = { ...manifest, mutants: manifest.mutants.map((mutant) => ({ ...mutant, expect: 'survives', why: 'y' })) };
  const { errors } = scoreTask({ manifest: loose, results, baselinePasses: true, commandCheckIds: ['behaviour'] });
  assert.ok(errors.some((error) => error.includes('kill rate 40%')));
  assert.ok(errors.some((error) => error.includes('fails hidden check(s) behaviour although')));
});
