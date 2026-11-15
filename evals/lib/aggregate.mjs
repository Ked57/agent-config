// Pure aggregation of run and judgment records into the summary that the report renders.
import { DIMENSIONS } from './judge.mjs';

const mean = (values) => {
  const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};
const rate = (runs, predicate) => (runs.length ? runs.filter(predicate).length / runs.length : null);
const relative = (b, a) => (a && b !== null && a !== null ? b / a - 1 : null);

/** Two-sided exact sign test for `wins` successes out of `n` decisive trials (p = 0.5). */
export function signTest(wins, n) {
  if (n === 0) return 1;
  const k = Math.min(wins, n - wins);
  let tail = 0;
  let coefficient = 1;
  for (let i = 0; i <= k; i += 1) {
    tail += coefficient;
    coefficient = (coefficient * (n - i)) / (i + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

export function armStats(runs) {
  const checkStats = {};
  for (const run of runs) {
    for (const check of run.checks ?? []) {
      checkStats[check.id] ??= { label: check.label, level: check.level, pass: 0, n: 0 };
      checkStats[check.id].n += 1;
      if (check.pass) checkStats[check.id].pass += 1;
    }
  }
  const required = runs.flatMap((run) => (run.checks ?? []).filter((check) => check.level === 'required'));
  const features = {};
  for (const run of runs) for (const name of Object.keys(run.features ?? {})) features[name] = (features[name] ?? 0) + 1;
  const gateNames = [...new Set(runs.flatMap((run) => Object.keys(run.gates ?? {})))];
  return {
    n: runs.length,
    errors: runs.filter((run) => run.status !== 'ok').length,
    gatesPass: rate(runs, (run) => run.gatesPass),
    gates: Object.fromEntries(gateNames.map((gate) => [gate, rate(runs, (run) => run.gates?.[gate]?.ok)])),
    requiredChecksPass: required.length ? required.filter((check) => check.pass).length / required.length : null,
    checks: checkStats,
    newDepRuns: runs.filter((run) => run.deps?.added?.length).length,
    newDeps: [...new Set(runs.flatMap((run) => run.deps?.added ?? []))].sort(),
    costUsd: mean(runs.map((run) => run.cost?.usd)),
    outputTokens: mean(runs.map((run) => run.cost?.outputTokens)),
    inputTokens: mean(runs.map((run) => (run.cost ? (run.cost.inputTokens ?? 0) + (run.cost.cacheReadTokens ?? 0) + (run.cost.cacheWriteTokens ?? 0) : null))),
    wallMin: mean(runs.map((run) => run.wallMs / 60000)),
    turns: mean(runs.map((run) => run.agent?.turns)),
    toolCalls: mean(runs.map((run) => run.agent?.toolCalls)),
    addedLines: mean(runs.map((run) => run.diff?.addedLines)),
    features,
    policiesFired: Object.fromEntries([...new Set(runs.flatMap((run) => Object.keys(run.telemetry?.policies ?? {})))]
      .map((name) => [name, rate(runs, (run) => run.telemetry.policies[name]?.fired)])),
    skillsFired: Object.fromEntries([...new Set(runs.flatMap((run) => Object.keys(run.telemetry?.skills ?? {})))]
      .map((name) => [name, rate(runs, (run) => run.telemetry.skills[name]?.fired)])),
    signalHits: Object.fromEntries([...new Set(runs.flatMap((run) => Object.keys(run.telemetry?.policies ?? {})))]
      .filter((name) => runs.some((run) => run.telemetry.policies[name]?.signalHits !== null && run.telemetry.policies[name]?.signalHits !== undefined))
      .map((name) => [name, mean(runs.map((run) => run.telemetry.policies[name]?.signalHits))]))
  };
}

function judgeStats(judgments) {
  const ab = judgments.filter((judgment) => judgment.kind === 'AB');
  const dims = (side) => {
    const values = Object.fromEntries([...DIMENSIONS, 'overall'].map((dimension) => [dimension, mean(ab.map((judgment) => judgment.scores[side]?.[dimension]))]));
    return values;
  };
  return {
    pairs: ab.length,
    A: dims('A'),
    B: dims('B'),
    preference: { A: ab.filter((j) => j.preference === 'A').length, B: ab.filter((j) => j.preference === 'B').length, tie: ab.filter((j) => j.preference === 'tie').length }
  };
}

/** Noise floor from same-arm control pairs (A#1 vs A#2), or from A/B pairs when the arms are identical. */
export function noiseFloor(judgments, armsIdentical) {
  const pairs = armsIdentical ? judgments.filter((j) => j.kind === 'AB') : judgments.filter((j) => j.kind === 'AA');
  const diffs = pairs.map((judgment) => {
    const [left, right] = judgment.sides;
    return judgment.scores[right].overall - judgment.scores[left].overall;
  });
  return {
    source: armsIdentical ? 'A/B pairs (arms identical)' : 'A#1 vs A#2 control pairs',
    pairs: pairs.length,
    decisiveRate: pairs.length ? pairs.filter((j) => j.preference !== 'tie').length / pairs.length : null,
    meanAbsDiff: mean(diffs.map(Math.abs)),
    maxAbsDiff: diffs.length ? Math.max(...diffs.map(Math.abs)) : null,
    splitRate: pairs.length ? pairs.filter((j) => !j.unanimous).length / pairs.length : null
  };
}

export function aggregate({ config, taskSet, armsInfo, runs, judgments }) {
  const tasksById = Object.fromEntries(taskSet.tasks.map((task) => [task.id, task]));
  const taskIds = config.taskIds.filter((id) => runs.some((run) => run.task === id));
  const armRuns = (arm, filter = () => true) => runs.filter((run) => run.arm === arm && filter(run));
  const section = (filter, judgmentFilter) => ({
    A: armStats(armRuns('A', filter)),
    B: armStats(armRuns('B', filter)),
    judge: judgeStats(judgments.filter(judgmentFilter))
  });

  const perTask = taskIds.map((id) => ({ id, category: tasksById[id].category, ...section((run) => run.task === id, (j) => j.task === id) }));
  const perCategory = Object.entries(taskSet.categories)
    .map(([key, category]) => ({ key, label: category.label ?? key, control: Boolean(category.control), ...section((run) => tasksById[run.task]?.category === key, (j) => tasksById[j.task]?.category === key) }))
    .filter((category) => category.A.n + category.B.n > 0);
  const overall = section(() => true, () => true);

  const overhead = Object.fromEntries(['costUsd', 'outputTokens', 'inputTokens', 'wallMin', 'turns', 'toolCalls']
    .map((key) => [key, relative(overall.B[key], overall.A[key])]));
  const nonControl = section((run) => !taskSet.categories[tasksById[run.task]?.category]?.control, () => false);
  const overheadNonControl = relative(nonControl.B.costUsd, nonControl.A.costUsd);

  // Routing telemetry for watched policies (changed between arms or requested with --watch).
  const watched = [...new Set([...(armsInfo.watched ?? []), ...(config.watch ?? [])])].sort();
  const telemetry = { watched, perPolicy: {} };
  for (const name of watched) {
    const entry = { falseTriggers: {}, misses: {} };
    for (const arm of ['A', 'B']) {
      if (!armsInfo[arm]?.policies?.includes(name)) continue;
      const notExpected = armRuns(arm, (run) => !(tasksById[run.task]?.expectsPolicies ?? []).includes(name));
      const expected = armRuns(arm, (run) => (tasksById[run.task]?.expectsPolicies ?? []).includes(name));
      const controls = notExpected.filter((run) => taskSet.categories[tasksById[run.task]?.category]?.control);
      entry.falseTriggers[arm] = {
        controlRuns: controls.length,
        controlFired: controls.filter((run) => run.telemetry?.policies?.[name]?.fired).length,
        unexpectedRuns: notExpected.length,
        unexpectedFired: notExpected.filter((run) => run.telemetry?.policies?.[name]?.fired).map((run) => run.id)
      };
      entry.misses[arm] = {
        expectedRuns: expected.length,
        missed: expected.filter((run) => !run.telemetry?.policies?.[name]?.fired).map((run) => run.id)
      };
    }
    telemetry.perPolicy[name] = entry;
  }

  const noise = noiseFloor(judgments, armsInfo.identical);
  const ab = judgments.filter((j) => j.kind === 'AB');
  const bWins = ab.filter((j) => j.preference === 'B').length;
  const aWins = ab.filter((j) => j.preference === 'A').length;
  const meanDiff = mean(ab.map((j) => j.scores.B.overall - j.scores.A.overall));
  const comparison = {
    pairs: ab.length,
    bWins,
    aWins,
    ties: ab.length - bWins - aWins,
    meanDiff,
    signTestP: signTest(bWins, bWins + aWins),
    beyondNoise: meanDiff !== null && noise.meanAbsDiff !== null ? Math.abs(meanDiff) > noise.meanAbsDiff : null
  };

  const notable = notableDiffs({ perTask, judgments: ab, runs });
  const recommendation = recommend({ armsInfo, comparison, noise, overall, overhead, telemetry });
  return { generatedAt: new Date().toISOString(), runs: runs.length, judgments: judgments.length, perTask, perCategory, overall, overhead, overheadNonControl, telemetry, noise, comparison, notable, recommendation };
}

export function notableDiffs({ perTask, judgments, runs }) {
  const notes = [];
  for (const task of perTask) {
    for (const [id, a] of Object.entries(task.A.checks)) {
      const b = task.B.checks[id];
      if (!b || !a.n || !b.n) continue;
      const delta = b.pass / b.n - a.pass / a.n;
      if (Math.abs(delta) >= 0.5) notes.push({ kind: 'check', task: task.id, text: `${a.label} (${a.level}): A ${a.pass}/${a.n}, B ${b.pass}/${b.n}` });
    }
    for (const arm of ['A', 'B']) {
      if (task[arm].newDeps.length) notes.push({ kind: 'deps', task: task.id, text: `Arm ${arm} added dependencies: ${task[arm].newDeps.join(', ')}` });
      for (const [gate, value] of Object.entries(task[arm].gates)) if (value !== null && value < 1) notes.push({ kind: 'gate', task: task.id, text: `Arm ${arm} ${gate} pass rate ${Math.round(value * 100)}%` });
    }
  }
  const ranked = judgments
    .map((j) => ({ j, diff: j.scores.B.overall - j.scores.A.overall }))
    .sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff))
    .slice(0, 6)
    .filter(({ diff }) => Math.abs(diff) >= 0.4);
  for (const { j, diff } of ranked) {
    notes.push({ kind: 'judge', task: j.task, text: `rep ${j.reps.join('/')}: B ${diff > 0 ? '+' : ''}${diff.toFixed(2)} vs A, preferred ${j.preference}. ${j.reasons[0] ?? ''}`.trim(), notesA: j.notes.A[0], notesB: j.notes.B[0] });
  }
  for (const run of runs.filter((r) => r.browser && !r.browser.ok)) notes.push({ kind: 'browser', task: run.task, text: `${run.id} browser smoke failed: ${run.browser.error ?? Object.entries(run.browser.routes).filter(([, v]) => v.errors.length || !v.textLength).map(([route, v]) => `${route} ${v.errors[0] ?? 'empty'}`).join('; ')}` });
  for (const run of runs.filter((r) => r.status !== 'ok')) notes.push({ kind: 'error', task: run.task, text: `${run.id} did not complete (${run.error ?? `exit ${run.exitCode}`})` });
  return notes;
}

/** Heuristic recommendation. Quality differences count only when beyond the noise floor and sign-test p < 0.1. */
export function recommend({ armsInfo, comparison, noise, overall, overhead, telemetry }) {
  const reasons = [];
  if (armsInfo.identical) {
    return { verdict: 'A/A control', reasons: ['Arms are identical; every difference in this report is run-to-run or judge noise.'] };
  }
  const significant = comparison.beyondNoise && comparison.signTestP < 0.1 && comparison.pairs >= 4;
  const better = significant && comparison.meanDiff > 0;
  const worse = significant && comparison.meanDiff < 0;
  const regressions = [];
  if ((overall.B.gatesPass ?? 1) < (overall.A.gatesPass ?? 1) - 0.05) regressions.push('lower gate pass rate');
  if ((overall.B.requiredChecksPass ?? 1) < (overall.A.requiredChecksPass ?? 1) - 0.1) regressions.push('lower required-check pass rate');
  if (overall.B.newDepRuns > overall.A.newDepRuns) regressions.push('more runs adding dependencies');
  for (const [name, entry] of Object.entries(telemetry.perPolicy)) {
    const fired = entry.falseTriggers.B?.unexpectedFired?.length ?? 0;
    if (fired) regressions.push(`${name} fired on ${fired} run(s) that did not expect it`);
  }
  const cost = overhead.costUsd;
  if (comparison.pairs) reasons.push(`Judge: B ${comparison.bWins} wins, A ${comparison.aWins}, ${comparison.ties} ties; mean overall B−A ${fmtSigned(comparison.meanDiff)} vs noise floor ±${fmt(noise.meanAbsDiff)} (sign test p=${fmt(comparison.signTestP)}).`);
  if (cost !== null) reasons.push(`Cost per run ${fmtSigned(cost * 100, 0)}% for B.`);
  if (regressions.length) reasons.push(`Regressions: ${regressions.join('; ')}.`);
  let verdict;
  if (worse) verdict = "don't adopt";
  else if (better && !regressions.length) verdict = 'adopt';
  else if (better) verdict = 'adopt with changes';
  else if (cost !== null && cost > 0.1) verdict = "don't adopt (no measurable benefit)";
  else if (regressions.length) verdict = 'adopt with changes';
  else verdict = 'neutral';
  return { verdict, reasons, heuristic: true };
}

export const fmt = (value, digits = 2) => (value === null || value === undefined || Number.isNaN(value) ? '–' : Number(value).toFixed(digits));
export const fmtSigned = (value, digits = 2) => (value === null || value === undefined ? '–' : `${value >= 0 ? '+' : ''}${Number(value).toFixed(digits)}`);
