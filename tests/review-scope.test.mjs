import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolver = path.join(root, 'skills/code-review/scripts/review-scope.mjs');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'review-scope-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-b', 'main');
  for (const file of ['committed.txt', 'staged.txt', 'unstaged.txt']) fs.writeFileSync(path.join(directory, file), 'before\n');
  git('add', '.'); git('commit', '-m', 'Baseline'); git('checkout', '-b', 'feature');
  fs.writeFileSync(path.join(directory, 'committed.txt'), 'branch commit\n');
  git('add', '.'); git('commit', '-m', 'Feature');
  const run = (...args) => spawnSync(process.execPath, [resolver, ...args], { cwd: directory, encoding: 'utf8' });
  return { directory, git, run };
}
const resolved = (result) => {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('review scope includes staged, unstaged and untracked work without mixing a committed range', (t) => {
  const { directory, git, run } = fixture(t);
  fs.writeFileSync(path.join(directory, 'staged.txt'), 'staged edit\n'); git('add', 'staged.txt');
  fs.writeFileSync(path.join(directory, 'unstaged.txt'), 'unstaged edit\n');
  fs.writeFileSync(path.join(directory, 'new file.txt'), 'untracked\n');
  const worktree = resolved(run());
  assert.equal(worktree.scope, 'worktree');
  assert.deepEqual(worktree.files, ['new file.txt', 'staged.txt', 'unstaged.txt']);
  assert.deepEqual(worktree.untracked, ['new file.txt']);
  const diff = worktree.diffs.map((args) => git(...args)).join('\n');
  assert.match(diff, /staged edit/); assert.match(diff, /unstaged edit/);
  assert.doesNotMatch(diff, /branch commit/);
  fs.writeFileSync(path.join(directory, 'staged.txt'), 'before\n');
  assert.ok(resolved(run()).files.includes('staged.txt'), 'staged and unstaged edits that cancel must both remain in scope');
  assert.deepEqual(resolved(run('--scope', 'staged')).files, ['staged.txt']);
  assert.deepEqual(resolved(run('--scope', 'unstaged')).files, ['staged.txt', 'unstaged.txt']);
  const range = resolved(run('--base', 'main'));
  assert.equal(range.scope, 'range');
  assert.deepEqual(range.files, ['committed.txt']);
  assert.match(range.diffs.map((args) => git(...args)).join('\n'), /branch commit/);
  assert.doesNotMatch(range.diffs.map((args) => git(...args)).join('\n'), /staged edit/);
});

test('clean review defaults to the base branch and rejects missing or empty ranges', (t) => {
  const { run } = fixture(t);
  const range = resolved(run());
  assert.equal(range.scope, 'range');
  assert.equal(range.baseRef, 'main');
  assert.deepEqual(range.files, ['committed.txt']);
  assert.notEqual(run('--base', 'missing-ref').status, 0);
  assert.match(run('--base', 'HEAD').stderr, /No changes/);
  assert.match(run('--scope', 'invalid').stderr, /scope/);
});
