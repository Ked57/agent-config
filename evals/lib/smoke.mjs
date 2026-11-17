// Pure part of `npm run eval:smoke`: turns finished smoke runs into per-task rows, judges them against
// the routing expectations in evals/smoke.json and the stored baseline, and builds a new baseline.
import { componentFired } from './aggregate.mjs';
import { checkScore } from './checks.mjs';

const pluginName = (plugin) => (typeof plugin === 'string' ? plugin : plugin?.name ?? plugin?.id ?? '').split('@')[0];

/** Every component an arm can fire: policy and skill names, and `plugin:<name>`. */
export function armComponents(arm = {}) {
  const plugins = (arm.plugins ?? []).map((plugin) => (typeof plugin === 'string' ? { name: pluginName(plugin) } : { ...plugin, name: pluginName(plugin) }));
  return [
    ...(arm.policies ?? []).map((name) => ({ name })),
    ...(arm.skills ?? []).map((name) => ({ name })),
    ...plugins.map((plugin) => ({ name: `plugin:${plugin.name}`, plugin }))
  ];
}

/** One smoke row per run record: what fired, what it cost, and whether its gates and checks held. */
export function smokeRow(run, arm) {
  const components = armComponents(arm);
  return {
    id: run.task,
    status: run.status,
    error: run.error ?? null,
    usd: run.cost?.usd ?? null,
    turns: run.agent?.turns ?? null,
    reused: Boolean(run.reusedFrom),
    installed: components.map((component) => component.name).sort(),
    fired: components.filter((component) => componentFired(run, component.name, component.plugin ?? null)).map((component) => component.name).sort(),
    gatesPass: Boolean(run.gatesPass),
    failedGates: Object.entries(run.gates ?? {}).filter(([, gate]) => !gate.ok).map(([name]) => name),
    checks: Object.fromEntries((run.checks ?? []).filter((check) => check.level === 'required').map((check) => [check.id, Math.round(checkScore(check) * 1000) / 1000]))
  };
}

const pct = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;

/**
 * Judges rows against the spec and baseline. Failures (exit non-zero): a task that did not run or
 * errored, a failed fixture gate, an expected component that did not fire, a forbidden one that did.
 * Warnings only: cost or turns outside the tolerance, a required check below its baseline score,
 * firing that differs from the baseline in components the spec does not mention.
 */
export function judgeSmoke({ spec, baseline, rows }) {
  const tolerance = spec.costTolerance ?? 0.3;
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  const results = [];
  for (const task of spec.tasks) {
    const row = byId[task.id];
    const failures = [];
    const warnings = [];
    const base = baseline?.tasks?.[task.id] ?? null;
    if (!row) {
      results.push({ id: task.id, covers: task.covers, row: null, failures: ['no run record'], warnings });
      continue;
    }
    if (row.status !== 'ok') failures.push(`run ${row.status}${row.error ? ` (${row.error})` : ''}`);
    if (!row.gatesPass) failures.push(`gates failed: ${row.failedGates.join(', ') || 'unknown'}`);
    for (const name of task.fires ?? []) {
      if (!row.installed.includes(name)) failures.push(`expected ${name}, which is not installed`);
      else if (!row.fired.includes(name)) failures.push(`expected ${name} to fire; it did not`);
    }
    for (const name of task.notFires ?? []) if (row.fired.includes(name)) failures.push(`${name} fired; it should not`);
    if (base) {
      for (const [metric, value, before] of [['cost', row.usd, base.usd], ['turns', row.turns, base.turns]]) {
        if (typeof value !== 'number' || typeof before !== 'number' || before <= 0) continue;
        const change = value / before - 1;
        if (Math.abs(change) > tolerance) warnings.push(`${metric} ${pct(change)} vs baseline (${metric === 'cost' ? `$${value.toFixed(2)} vs $${before.toFixed(2)}` : `${value} vs ${before}`})`);
      }
      for (const [id, score] of Object.entries(row.checks)) {
        const before = base.checks?.[id];
        if (typeof before === 'number' && score < before - 1e-9) warnings.push(`check ${id} ${score} (baseline ${before})`);
      }
      const named = new Set([...(task.fires ?? []), ...(task.notFires ?? [])]);
      const started = row.fired.filter((name) => !named.has(name) && !(base.fired ?? []).includes(name));
      const stopped = (base.fired ?? []).filter((name) => !named.has(name) && !row.fired.includes(name));
      if (started.length) warnings.push(`newly fired: ${started.join(', ')}`);
      if (stopped.length) warnings.push(`no longer fired: ${stopped.join(', ')}`);
    } else {
      warnings.push('no baseline entry');
    }
    results.push({ id: task.id, covers: task.covers, row, failures, warnings });
  }
  const total = (rows) => rows.reduce((sum, row) => sum + (row?.usd ?? 0), 0);
  const ran = results.map((result) => result.row).filter(Boolean);
  return {
    results,
    failed: results.some((result) => result.failures.length),
    usd: total(ran),
    spentUsd: total(ran.filter((row) => !row.reused)),
    baselineUsd: baseline ? Object.values(baseline.tasks ?? {}).reduce((sum, task) => sum + (task.usd ?? 0), 0) : null
  };
}

/** The baseline file's content for these rows. */
export function baselineFrom({ spec, rows, meta }) {
  const tasks = {};
  for (const task of spec.tasks) {
    const row = rows.find((entry) => entry.id === task.id);
    if (!row) continue;
    tasks[task.id] = { set: task.set, usd: row.usd === null ? null : Math.round(row.usd * 10000) / 10000, turns: row.turns, fired: row.fired, gatesPass: row.gatesPass, checks: row.checks };
  }
  return { ...meta, totalUsd: Math.round(Object.values(tasks).reduce((sum, task) => sum + (task.usd ?? 0), 0) * 100) / 100, tasks };
}

/** Markdown table of a judged smoke run. */
export function renderSmoke(judged) {
  const lines = ['| Task | Covers | Result | $ | Turns | Fired | Notes |', '|---|---|---|---|---|---|---|'];
  for (const result of judged.results) {
    const row = result.row;
    const verdict = result.failures.length ? 'FAIL' : result.warnings.length ? 'warn' : 'ok';
    const notes = [...result.failures, ...result.warnings].join('; ');
    lines.push(`| ${result.id} | ${result.covers ?? ''} | ${verdict} | ${row?.usd?.toFixed(2) ?? '–'}${row?.reused ? ' (reused)' : ''} | ${row?.turns ?? '–'} | ${row?.fired.join(', ') ?? '–'} | ${notes} |`);
  }
  lines.push('', `Total $${judged.usd.toFixed(2)} (spent now $${judged.spentUsd.toFixed(2)}; baseline $${judged.baselineUsd?.toFixed(2) ?? '–'}).`);
  return lines.join('\n');
}
