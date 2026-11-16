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

test('armCacheKey changes when any build input changes', async () => {
  const { armCacheKey } = await import('../evals/lib/arms.mjs');
  const base = { sha: 'a'.repeat(40), srcDigest: 'd1', add: [{ path: 'skills/x', source: 'main', resolved: 'main:skills/x' }], remove: ['skills/y', 'plugin:pstack'], pluginMode: 'install', version: 1 };
  const key = armCacheKey(base);
  assert.equal(armCacheKey({ ...base }), key);
  assert.equal(armCacheKey({ ...base, remove: ['plugin:pstack', 'skills/y'] }), key, 'removal order does not matter');
  for (const change of [{ sha: 'b'.repeat(40) }, { sha: null }, { srcDigest: 'd2' }, { add: [] }, { add: [{ ...base.add[0], resolved: 'feat:skills/x' }] }, { remove: ['skills/y'] }, { remove: ['skills/y', 'plugin:taste-skill'] }, { pluginMode: 'skip' }, { version: 2 }]) {
    assert.notEqual(armCacheKey({ ...base, ...change }), key, JSON.stringify(change));
  }
});

test('cacheDecision reuses a fresh entry, rebuilds an old one or on request, and is off at 0 hours', async () => {
  const { cacheDecision } = await import('../evals/lib/arms.mjs');
  const now = Date.parse('2026-11-16T12:00:00Z');
  const entry = { builtAt: '2026-11-16T00:00:00Z' };
  assert.equal(cacheDecision({ entry, nowMs: now, maxAgeHours: 24 }).action, 'reuse');
  assert.deepEqual(cacheDecision({ entry, nowMs: now, maxAgeHours: 6 }), { action: 'build', fallback: entry, ageHours: 12 });
  assert.equal(cacheDecision({ entry, nowMs: now, maxAgeHours: 24, rebuild: true }).action, 'build');
  assert.equal(cacheDecision({ entry: null, nowMs: now, maxAgeHours: 24 }).action, 'build');
  assert.equal(cacheDecision({ entry, nowMs: now, maxAgeHours: 0 }).action, 'off');
  assert.equal(cacheDecision({ entry: { builtAt: '2026-11-17T00:00:00Z' }, nowMs: now, maxAgeHours: 24 }).action, 'build', 'an entry from the future is not trusted');
});

test('isNetworkFailure retries rate limits, DNS and timeouts, not a broken ref', async () => {
  const { isNetworkFailure } = await import('../evals/lib/arms.mjs');
  for (const text of ['remote: HTTP 429 Too Many Requests', 'API rate limit exceeded for 1.2.3.4', 'fatal: unable to access https://github.com/x/y/: Could not resolve host: github.com', 'ssh: connect to host github.com port 22: Connection timed out', 'agent-config sync failed for main:  (spawnSync node ETIMEDOUT)']) assert.equal(isNetworkFailure(text), true, text);
  for (const text of ['agent-config sync failed for main: SyntaxError: Unexpected token', 'Live agent config changed during an arm build', '', undefined]) assert.equal(isNetworkFailure(text), false, String(text));
});

test('a cached arm home is restored with its home path rewritten and checked against its inventory', async () => {
  const { filesNamingHome, inventory, restoreArmCache, storeArmCache } = await import('../evals/lib/arms.mjs');
  const root = temp();
  const built = path.join(root, 'sandbox', 'arms', 'A', 'home');
  const plugin = path.join(built, '.claude', 'plugins', 'cache', 'm', 'p', '1.0.0');
  fs.mkdirSync(path.join(plugin, 'skills', 's'), { recursive: true });
  fs.writeFileSync(path.join(plugin, 'skills', 's', 'SKILL.md'), '---\nname: s\n---\nbody\n');
  fs.writeFileSync(path.join(built, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'p@m': [{ scope: 'user', version: '1.0.0', installPath: plugin }] } }));
  fs.writeFileSync(path.join(built, '.claude', 'CLAUDE.md'), `@${built}/.agents/AGENTS.md\n`);
  fs.mkdirSync(path.join(built, '.agents'));
  fs.writeFileSync(path.join(built, '.agents', 'AGENTS.md'), 'policy\n');
  fs.mkdirSync(path.join(built, '.codex'));
  fs.writeFileSync(path.join(built, '.codex', 'AGENTS.md'), `${built}\n`);
  const meta = { ref: 'main', home: built, homePathFiles: filesNamingHome(built), ...inventory(built) };
  const cacheRoot = path.join(root, 'cache', 'arms');
  const builtAt = storeArmCache({ cacheRoot, key: 'k1', built: meta });
  const entry = JSON.parse(fs.readFileSync(path.join(cacheRoot, 'k1', 'entry.json'), 'utf8'));
  assert.equal(entry.builtAt, builtAt);
  assert.equal(entry.homePath, built);
  assert.equal(fs.existsSync(path.join(cacheRoot, 'k1', 'home', '.codex')), false, 'only what a run reads is cached');

  const home = path.join(root, 'sandbox2', 'arms', 'A', 'home');
  const restored = restoreArmCache({ cacheDir: path.join(cacheRoot, 'k1'), entry, home });
  assert.equal(restored.home, home);
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), `@${home}/.agents/AGENTS.md\n`);
  assert.match(fs.readFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'), new RegExp(`"installPath":"${home}/.claude/plugins/cache/m/p/1.0.0"`));
  assert.deepEqual(restored.plugins.map((p) => p.id), ['p@m']);

  fs.writeFileSync(path.join(cacheRoot, 'k1', 'home', '.agents', 'AGENTS.md'), 'tampered\n');
  assert.throws(() => restoreArmCache({ cacheDir: path.join(cacheRoot, 'k1'), entry, home }), /does not match its inventory \(\.agents\/AGENTS\.md\)/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('redoRuns moves records, run dirs and their judgments aside and keeps their spend', async () => {
  const { readDiscarded, recordDiscarded, redoRuns } = await import('../evals/lib/discard.mjs');
  const outDir = temp();
  const write = (relative, value) => {
    fs.mkdirSync(path.dirname(path.join(outDir, relative)), { recursive: true });
    fs.writeFileSync(path.join(outDir, relative), JSON.stringify(value));
  };
  write('results/runs/T__A__r1.json', { id: 'T__A__r1', cost: { usd: 1.27 } });
  write('results/runs/T__B__r1.json', { id: 'T__B__r1', cost: { usd: 2 } });
  write('results/runs/U__A__r1.json', { id: 'U__A__r1', cost: { usd: 3 }, reusedFrom: { dir: '/x' } });
  write('runs/T__A__r1/diff.patch', 'patch');
  write('results/judge/set1/T__A1-B1.json', { runs: ['T__A__r1', 'T__B__r1'] });
  write('results/judge/set1/V__A1-B1.json', { runs: ['V__A__r1', 'V__B__r1'] });
  recordDiscarded(outDir, { id: 'W__A__r1', kind: 'usage-limit', usd: 0.5 });

  assert.throws(() => redoRuns({ outDir, ids: ['T__A__r1', 'nope'] }), /no recorded run nope/);
  assert.equal(fs.existsSync(path.join(outDir, 'results/runs/T__A__r1.json')), true, 'nothing moves when an id is unknown');

  const at = '2026-11-16T22:00:00.000Z';
  const result = redoRuns({ outDir, ids: ['T__A__r1', 'U__A__r1'], at });
  const dir = path.join(outDir, 'discarded', '2026-11-16T22-00-00-000Z');
  assert.equal(result.dir, dir);
  assert.deepEqual(result.runs, [{ id: 'T__A__r1', usd: 1.27, judgments: ['set1/T__A1-B1.json'] }, { id: 'U__A__r1', usd: 0, judgments: [] }]);
  for (const moved of ['results/runs/T__A__r1.json', 'runs/T__A__r1/diff.patch', 'results/judge/set1/T__A1-B1.json', 'results/runs/U__A__r1.json']) {
    assert.equal(fs.existsSync(path.join(outDir, moved)), false, moved);
    assert.equal(fs.existsSync(path.join(dir, moved)), true, moved);
  }
  assert.equal(fs.existsSync(path.join(outDir, 'results/runs/T__B__r1.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'results/judge/set1/V__A1-B1.json')), true);
  const discarded = readDiscarded(outDir);
  assert.equal(discarded.usd.toFixed(2), '1.77', 'the earlier discard, plus the redone run this eval paid for (not the reused one)');
  assert.deepEqual(discarded.runs.map((run) => [run.id, run.kind]), [['W__A__r1', 'usage-limit'], ['T__A__r1', 'redo'], ['U__A__r1', 'redo']]);
  fs.rmSync(outDir, { recursive: true, force: true });
});
