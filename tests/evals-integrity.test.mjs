import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { liveConfigSnapshot } from '../evals/lib/arms.mjs';
import { ancestorAgentConfig, freePort } from '../evals/lib/env.mjs';
import { changedArmFiles, fixedFlagsOnResume, flippedChecks } from '../evals/lib/plan.mjs';
import { renderReport } from '../evals/lib/report.mjs';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-evals-integrity-'));

test('liveConfigSnapshot sees an in-place edit below a watched directory', () => {
  const home = temp();
  const skill = path.join(home, '.agents', 'skills', 'demo', 'SKILL.md');
  fs.mkdirSync(path.dirname(skill), { recursive: true });
  fs.writeFileSync(skill, 'one');
  const before = liveConfigSnapshot(home);
  fs.writeFileSync(skill, 'longer');
  assert.notDeepEqual(liveConfigSnapshot(home), before);
  fs.rmSync(home, { recursive: true, force: true });
});

test('liveConfigSnapshot sees a plugin or marketplace install without walking the plugin caches', () => {
  const home = temp();
  const marketplaces = path.join(home, '.claude', 'plugins', 'marketplaces');
  fs.mkdirSync(path.join(marketplaces, 'big', 'deep', 'tree'), { recursive: true });
  fs.mkdirSync(path.join(home, '.cursor', 'plugins', 'local'), { recursive: true });
  fs.mkdirSync(path.join(home, '.codex', 'plugins'), { recursive: true });
  const before = liveConfigSnapshot(home);
  assert.ok(!Object.keys(before).some((key) => key.includes('deep')), 'caches are not walked');
  fs.mkdirSync(path.join(marketplaces, 'cursor-plugins'));
  assert.notDeepEqual(liveConfigSnapshot(home), before);
  for (const added of [path.join(home, '.cursor', 'plugins', 'local', 'pstack'), path.join(home, '.codex', 'plugins', 'taste-skill')]) {
    const snapshot = liveConfigSnapshot(home);
    fs.mkdirSync(added);
    assert.notDeepEqual(liveConfigSnapshot(home), snapshot, added);
  }
  const snapshot = liveConfigSnapshot(home);
  fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), '{}');
  assert.notDeepEqual(liveConfigSnapshot(home), snapshot);
  fs.rmSync(home, { recursive: true, force: true });
});

test('ancestorAgentConfig lists agent config above a working copy, nearest first', () => {
  const root = temp();
  const app = path.join(root, 'eval', 'runs', 'run', 'app');
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(root, 'eval'), { recursive: true });
  fs.writeFileSync(path.join(root, 'eval', 'AGENTS.md'), '');
  const found = ancestorAgentConfig(app).filter((file) => file.startsWith(root));
  assert.deepEqual(found, [path.join(root, 'eval', 'AGENTS.md'), path.join(root, '.claude')]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('freePort returns a usable port', async () => {
  const port = await freePort();
  assert.ok(Number.isInteger(port) && port > 0);
});

test('resume helpers name frozen flags, changed arm files and flipped checks', () => {
  assert.deepEqual(fixedFlagsOnResume({ resume: 'dir', b: 'x', model: 'm', maxUsd: 5 }), ['--b', '--model']);
  assert.deepEqual(fixedFlagsOnResume({ resume: 'dir', judgeModel: 'm', reportOnly: true }), []);
  assert.deepEqual(changedArmFiles({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' }), ['b', 'c']);
  assert.deepEqual(
    flippedChecks([{ id: 'x', pass: true }, { id: 'y', pass: false }], [{ id: 'x', pass: false }, { id: 'y', pass: false }, { id: 'z', pass: true }]),
    [{ check: 'x', from: true, to: false }, { check: 'z', from: null, to: true }]
  );
  assert.deepEqual(flippedChecks([{ id: 'h', pass: false, score: 0.5 }], [{ id: 'h', pass: false, score: 0.75 }]), [{ check: 'h', from: false, to: false, scoreFrom: 0.5, scoreTo: 0.75 }]);
  assert.deepEqual(flippedChecks([{ id: 'h', pass: true, score: 1 }], [{ id: 'h', pass: true, score: 1 }]), []);
});

test('semaphore lets at most `limit` holders in and hands the slot on', async () => {
  const { semaphore } = await import('../evals/lib/plan.mjs');
  const gate = semaphore(2);
  let peak = 0;
  const order = [];
  await Promise.all([1, 2, 3, 4, 5].map(async (id) => {
    const release = await gate.acquire();
    peak = Math.max(peak, gate.active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push(id);
    release();
    release(); // a second release is a no-op
  }));
  assert.equal(peak, 2);
  assert.equal(gate.active, 0);
  assert.deepEqual([...order].sort(), [1, 2, 3, 4, 5]);
});
