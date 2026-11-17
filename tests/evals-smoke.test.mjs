import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { baselineFrom, judgeSmoke, smokeRow } from '../evals/lib/smoke.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arm = { policies: ['routing', 'typescript'], skills: ['manual-qa'], plugins: [{ name: 'taste-skill', skills: ['design-taste-frontend'] }] };
const run = (overrides = {}) => ({
  task: 'T1', status: 'ok', cost: { usd: 1 }, agent: { turns: 10 }, gatesPass: true, gates: { lint: { ok: true } },
  checks: [{ id: 'hidden', level: 'required', score: 1, pass: true }, { id: 'info', level: 'info', pass: false }],
  telemetry: { policies: { routing: { fired: true }, typescript: { fired: false } }, skills: { 'manual-qa': { fired: true } }, plugins: { 'taste-skill': { fired: false, skills: [] } } },
  ...overrides
});
const spec = { costTolerance: 0.3, tasks: [{ id: 'T1', set: 's', fires: ['routing'], notFires: ['typescript'] }] };

test('smokeRow lists fired components, required check scores and failed gates', () => {
  const row = smokeRow(run({ gatesPass: false, gates: { lint: { ok: false }, test: { ok: true } } }), arm);
  assert.deepEqual(row.fired, ['manual-qa', 'routing']);
  assert.deepEqual(row.installed, ['manual-qa', 'plugin:taste-skill', 'routing', 'typescript']);
  assert.deepEqual(row.checks, { hidden: 1 });
  assert.deepEqual(row.failedGates, ['lint']);
});

test('judgeSmoke fails on missed or forbidden firing and broken gates, and only warns on cost drift', () => {
  const baseline = { tasks: { T1: { usd: 1, turns: 10, fired: ['manual-qa', 'routing'], checks: { hidden: 1 } } } };
  const ok = judgeSmoke({ spec, baseline, rows: [smokeRow(run(), arm)] });
  assert.equal(ok.failed, false);
  assert.deepEqual(ok.results[0].warnings, []);

  const drift = judgeSmoke({ spec, baseline, rows: [smokeRow(run({ cost: { usd: 1.5 }, checks: [{ id: 'hidden', level: 'required', score: 0.5 }] }), arm)] });
  assert.equal(drift.failed, false);
  assert.match(drift.results[0].warnings.join('\n'), /cost \+50%/);
  assert.match(drift.results[0].warnings.join('\n'), /check hidden 0.5 \(baseline 1\)/);

  const telemetry = { policies: { routing: { fired: false }, typescript: { fired: true } }, skills: { 'manual-qa': { fired: false } }, plugins: {} };
  const bad = judgeSmoke({ spec, baseline, rows: [smokeRow(run({ telemetry, gatesPass: false, gates: { lint: { ok: false } } }), arm)] });
  assert.equal(bad.failed, true);
  assert.deepEqual(bad.results[0].failures, ['gates failed: lint', 'expected routing to fire; it did not', 'typescript fired; it should not']);
  assert.match(bad.results[0].warnings.join('\n'), /no longer fired: manual-qa/);

  const missing = judgeSmoke({ spec, baseline, rows: [] });
  assert.deepEqual(missing.results[0].failures, ['no run record']);
});

test('baselineFrom keeps cost, turns, firing and checks per task', () => {
  const baseline = baselineFrom({ spec, rows: [smokeRow(run(), arm)], meta: { model: 'm' } });
  assert.deepEqual(baseline, { model: 'm', totalUsd: 1, tasks: { T1: { set: 's', usd: 1, turns: 10, fired: ['manual-qa', 'routing'], gatesPass: true, checks: { hidden: 1 } } } });
});

test('smoke spec names real tasks and the baseline covers every smoke task', () => {
  const smoke = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'smoke.json'), 'utf8'));
  for (const task of smoke.tasks) {
    const set = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'tasks', `${task.set}.json`), 'utf8'));
    assert.ok(set.tasks.some((entry) => entry.id === task.id), `${task.set}/${task.id} not found`);
    assert.deepEqual((task.fires ?? []).filter((name) => (task.notFires ?? []).includes(name)), [], `${task.id}: fires and notFires overlap`);
  }
  const baselineFile = path.join(ROOT, 'evals', 'smoke-baseline.json');
  if (!fs.existsSync(baselineFile)) return;
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  assert.deepEqual(Object.keys(baseline.tasks).sort(), smoke.tasks.map((task) => task.id).sort());
});
