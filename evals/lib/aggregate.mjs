// Pure aggregation of run and judgment records into the summary that the report renders.
// The unit of comparison is the task: an arm's task score is the mean over its reps, and the arms are
// compared on the paired per-task differences d_t = B_t − A_t (see stats.mjs and evals/README.md).
import { checkScore, pluginUse, scoreRun, slashInvocations } from './checks.mjs';
import { bootstrapCi, pairedStats, ratioStats } from './stats.mjs';

/** Differences smaller than this (in metric units) count as "no difference". */
export const EQUIVALENCE = 0.1;
/** Fewer paired tasks than this always gives "cannot conclude". */
export const MIN_TASKS = 5;

const mean = (values) => {
  const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};
const rate = (runs, predicate) => (runs.length ? runs.filter(predicate).length / runs.length : null);
const relative = (b, a) => (a && b !== null && a !== null ? b / a - 1 : null);
const pluginName = (plugin) => (typeof plugin === 'string' ? plugin : plugin?.name ?? plugin?.id ?? '').split('@')[0];

/**
 * Whether a run shows a component firing: a policy or skill name, or `plugin:<name>`. Besides the
 * measured telemetry, a slash invocation counts: the exact prompt sent (`run.prompt`) or a slash
 * command the session log shows expanded (`run.isolation.commands`, recorded after measuring).
 */
export function componentFired(run, name, plugin = null) {
  const telemetry = run.telemetry ?? {};
  const slash = slashInvocations({ prompt: run.prompt ?? '', commandTags: run.isolation?.commands ?? [] });
  if (name.startsWith('plugin:')) {
    const entry = plugin ?? { name: name.slice(7) };
    return Boolean(telemetry.plugins?.[entry.name]?.fired)
      || pluginUse(entry, { invocations: slash, subagents: Object.keys(telemetry.subagents ?? {}), standaloneSkills: Object.keys(telemetry.skills ?? {}) }).length > 0;
  }
  return Boolean(telemetry.policies?.[name]?.fired || telemetry.skills?.[name]?.fired) || slash.some((command) => command === name || command.endsWith(`:${name}`));
}

const armPlugin = (info = {}, name) => (info.plugins ?? []).map((plugin) => (typeof plugin === 'string' ? { name: pluginName(plugin) } : { ...plugin, name: pluginName(plugin) })).find((plugin) => plugin.name === name.slice(7)) ?? null;
const armHas = (info = {}, name) => (name.startsWith('plugin:')
  ? (info.plugins ?? []).some((plugin) => pluginName(plugin) === name.slice(7))
  : (info.policies ?? []).includes(name) || (info.skills ?? []).includes(name));

/** Components a task expects to fire (`expectsComponents`, or the older `expectsPolicies`). */
export const expectedComponents = (task) => task?.expectsComponents ?? task?.expectsPolicies ?? [];

/**
 * Subagent use: calls and runs per `subagent_type`, and how many runs started any. Records made
 * before types were captured count their Task/Agent tool calls as "(type not recorded)".
 */
export function subagentStats(runs) {
  const calls = {};
  const runsByType = {};
  let runsWithAny = 0;
  for (const run of runs) {
    const counts = run.telemetry?.subagents ?? (() => {
      const n = (run.agent?.toolsByName?.Task ?? 0) + (run.agent?.toolsByName?.Agent ?? 0);
      return n ? { '(type not recorded)': n } : {};
    })();
    if (Object.keys(counts).length) runsWithAny += 1;
    for (const [type, n] of Object.entries(counts)) {
      calls[type] = (calls[type] ?? 0) + n;
      runsByType[type] = (runsByType[type] ?? 0) + 1;
    }
  }
  return { runs: runs.length, runsWithAny, calls, runsByType };
}

export function armStats(runs) {
  const checkStats = {};
  for (const run of runs) {
    for (const check of run.checks ?? []) {
      checkStats[check.id] ??= { label: check.label, level: check.level, pass: 0, n: 0, score: 0 };
      if (check.reporter === 'json-score') checkStats[check.id].jsonScore = true;
      checkStats[check.id].n += 1;
      checkStats[check.id].score += checkScore(check);
      if (check.pass) checkStats[check.id].pass += 1;
    }
  }
  for (const entry of Object.values(checkStats)) entry.score /= entry.n;
  const required = runs.flatMap((run) => (run.checks ?? []).filter((check) => check.level === 'required'));
  const features = {};
  for (const run of runs) for (const name of Object.keys(run.features ?? {})) features[name] = (features[name] ?? 0) + 1;
  const gateNames = [...new Set(runs.flatMap((run) => Object.keys(run.gates ?? {})))];
  // Hidden test cases, summed over Vitest-scored checks and reps: the number people read first.
  const counted = runs.flatMap((run) => (run.checks ?? []).filter((check) => typeof check?.total === 'number'));
  const firedRate = (kind) => Object.fromEntries([...new Set(runs.flatMap((run) => Object.keys(run.telemetry?.[kind] ?? {})))]
    .map((name) => [name, rate(runs, (run) => run.telemetry?.[kind]?.[name]?.fired)]));
  return {
    n: runs.length,
    reused: runs.filter((run) => run.reusedFrom).length,
    errors: runs.filter((run) => run.status !== 'ok').length,
    score: mean(runs.map((run) => scoreRun(run).score)),
    allPass: rate(runs, (run) => scoreRun(run).allPass),
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
    policiesFired: firedRate('policies'),
    skillsFired: firedRate('skills'),
    pluginsFired: firedRate('plugins'),
    hiddenTests: counted.length ? { passed: counted.reduce((sum, check) => sum + (check.passed ?? 0), 0), total: counted.reduce((sum, check) => sum + check.total, 0) } : null,
    subagents: subagentStats(runs),
    mcp: { runs: runs.length, runsWithAny: runs.filter((run) => Object.keys(run.mcpCalls ?? {}).length).length, calls: runs.reduce((calls, run) => {
      for (const [tool, count] of Object.entries(run.mcpCalls ?? {})) calls[tool] = (calls[tool] ?? 0) + count;
      return calls;
    }, {}) },
    signalHits: Object.fromEntries([...new Set(runs.flatMap((run) => Object.keys(run.telemetry?.policies ?? {})))]
      .filter((name) => runs.some((run) => run.telemetry.policies[name]?.signalHits !== null && run.telemetry.policies[name]?.signalHits !== undefined))
      .map((name) => [name, mean(runs.map((run) => run.telemetry.policies[name]?.signalHits))]))
  };
}

/**
 * Re-derives a judgment's preference from its per-call record with the current tie rule (every
 * verdict must name the same side), so judgments saved under the older rule (one vote plus a tie
 * counted as a win) report consistently. Uses the per-call `calls`, else the `votes` tally; records
 * with neither are returned unchanged.
 */
export function applyTieRule(judgment) {
  let preference;
  if (Array.isArray(judgment.calls) && judgment.calls.length) {
    const sides = judgment.calls.map((call) => (call.preference === 'tie' ? 'tie' : call.order[call.preference === '1' ? 0 : 1]));
    preference = sides.every((side) => side === sides[0]) ? sides[0] : 'tie';
  } else if (judgment.votes && Object.values(judgment.votes).some((count) => count > 0)) {
    const total = Object.values(judgment.votes).reduce((sum, count) => sum + count, 0);
    preference = (judgment.sides ?? []).find((side) => judgment.votes[side] === total) ?? 'tie';
  } else return judgment;
  return preference === judgment.preference ? judgment : { ...judgment, preference, preferenceAsRecorded: judgment.preference };
}

/** Judge dimensions present in a set of judgments, in first-seen order (fixtures may pick their own). */
export const judgedDimensions = (judgments) => [...new Set(judgments.flatMap((judgment) => Object.values(judgment.scores ?? {}).flatMap((scores) => Object.keys(scores ?? {}))))]
  .filter((dimension) => dimension !== 'overall');

function judgeStats(judgments) {
  const ab = judgments.filter((judgment) => judgment.kind === 'AB');
  const dims = (side) => Object.fromEntries([...judgedDimensions(ab), 'overall'].map((dimension) => [dimension, mean(ab.map((judgment) => judgment.scores[side]?.[dimension]))]));
  return {
    pairs: ab.length,
    A: dims('A'),
    B: dims('B'),
    preference: { A: ab.filter((j) => j.preference === 'A').length, B: ab.filter((j) => j.preference === 'B').length, tie: ab.filter((j) => j.preference === 'tie').length }
  };
}

/**
 * Judge noise from same-arm control pairs (A#1 vs A#2), or from A/B pairs when the arms are
 * identical: mean |overall difference| with a seeded bootstrap CI over pairs. Descriptive only.
 */
export function noiseFloor(judgments, armsIdentical, seed = 1) {
  const pairs = armsIdentical ? judgments.filter((j) => j.kind === 'AB') : judgments.filter((j) => j.kind === 'AA');
  const diffs = pairs.map((judgment) => {
    const [left, right] = judgment.sides;
    return judgment.scores[right].overall - judgment.scores[left].overall;
  });
  const absolute = diffs.map(Math.abs);
  return {
    source: armsIdentical ? 'A/B pairs (arms identical)' : 'A#1 vs A#2 control pairs',
    pairs: pairs.length,
    decisiveRate: pairs.length ? pairs.filter((j) => j.preference !== 'tie').length / pairs.length : null,
    meanAbsDiff: mean(absolute),
    meanAbsDiffCi: bootstrapCi(absolute, mean, { seed }),
    maxAbsDiff: diffs.length ? Math.max(...absolute) : null,
    splitRate: pairs.length ? pairs.filter((j) => !j.unanimous).length / pairs.length : null
  };
}

const fmtCi = (ci, digits = 2) => (ci ? `[${fmtSigned(ci[0], digits)}, ${fmtSigned(ci[1], digits)}]` : '–');

/**
 * The decision rule, applied to one metric's paired stats (`pairedStats` plus `ceiling`/`floor`
 * task counts). Uses the paired-t CI; the bootstrap CI is reported next to it.
 */
export function decide(stats, { equivalence = EQUIVALENCE, minTasks = MIN_TASKS } = {}) {
  const { tasks, mean: m, sd, ci, mde, tasksNeeded } = stats;
  const need = () => `MDE ${fmt(mde)} at ${tasks} task(s); about ${tasksNeeded['0.10'] ?? '–'} tasks needed for an MDE of 0.10, ${tasksNeeded['0.20'] ?? '–'} for 0.20`;
  const bounded = (stats.ceiling ?? 0) + (stats.floor ?? 0);
  const atBounds = bounded ? `; metric at ceiling/floor on ${bounded} of ${tasks} tasks` : '';
  if (tasks < minTasks) return { code: 'cannot conclude', text: `cannot conclude: ${tasks} paired task(s), at least ${minTasks} needed${sd ? `; ${need()}` : ''}${atBounds}` };
  if (sd === 0 && m === 0) {
    return { code: 'no difference', text: `no difference observed; metric at ceiling/floor on ${bounded} of ${tasks} tasks (ceiling ${stats.ceiling ?? 0}, floor ${stats.floor ?? 0})` };
  }
  if (ci[0] > 0) return { code: 'B better', text: `B better (95% CI ${fmtCi(ci)} excludes 0)` };
  if (ci[1] < 0) return { code: 'A better', text: `A better (95% CI ${fmtCi(ci)} excludes 0)` };
  if (ci[0] >= -equivalence && ci[1] <= equivalence) return { code: 'no difference', text: `no difference larger than ±${fmt(equivalence)} (95% CI ${fmtCi(ci)})` };
  return { code: 'cannot conclude', text: `cannot conclude: 95% CI ${fmtCi(ci)} spans 0 and ±${fmt(equivalence)}; ${need()}` };
}

/**
 * Paired task-level comparison of one metric. `value(run)` gives a run's value (null to skip it);
 * an arm's task value is the mean over its reps; tasks without both arms are left out.
 */
export function compareTasks({ runs, taskIds, value, seed, bounds = null, metric }) {
  const perTask = [];
  for (const task of taskIds) {
    const armMean = (arm) => mean(runs.filter((run) => run.task === task && run.arm === arm).map(value));
    const [A, B] = [armMean('A'), armMean('B')];
    if (A === null || B === null) continue;
    perTask.push({ task, A, B, d: B - A });
  }
  const stats = pairedStats(perTask.map((row) => row.d), { seed });
  const ceiling = bounds ? perTask.filter((row) => row.A === bounds[1] && row.B === bounds[1]).length : null;
  const floor = bounds ? perTask.filter((row) => row.A === bounds[0] && row.B === bounds[0]).length : null;
  const result = { metric, ...stats, meanA: mean(perTask.map((row) => row.A)), meanB: mean(perTask.map((row) => row.B)), ceiling, floor, perTask };
  return { ...result, verdict: decide(result) };
}

/** Cost-type comparison: ratio of task means B/A − 1 with a task-bootstrap CI. Never part of the quality verdict. */
export function compareCost({ runs, taskIds, value, seed, metric }) {
  const pairs = [];
  for (const task of taskIds) {
    const armMean = (arm) => mean(runs.filter((run) => run.task === task && run.arm === arm).map(value));
    const [a, b] = [armMean('A'), armMean('B')];
    if (a !== null && b !== null) pairs.push({ task, a, b });
  }
  const stats = ratioStats(pairs, { seed });
  const ci = stats.bootstrapCi;
  const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;
  let verdict;
  if (!ci || stats.tasks < MIN_TASKS) verdict = { code: 'cannot conclude', text: `cannot conclude (fewer than ${MIN_TASKS} paired tasks)${stats.mean !== null ? `: B ${pct(stats.mean)}` : ''}${ci ? ` (task-bootstrap 95% CI ${pct(ci[0])} to ${pct(ci[1])})` : ''}` };
  else if (ci[0] > 0) verdict = { code: 'B costs more', text: `B ${pct(stats.mean)} (task-bootstrap 95% CI ${pct(ci[0])} to ${pct(ci[1])})` };
  else if (ci[1] < 0) verdict = { code: 'B costs less', text: `B ${pct(stats.mean)} (task-bootstrap 95% CI ${pct(ci[0])} to ${pct(ci[1])})` };
  else verdict = { code: 'no difference', text: `no difference detected: B ${pct(stats.mean)} (task-bootstrap 95% CI ${pct(ci[0])} to ${pct(ci[1])})` };
  return { metric, ...stats, ci, mde: null, perTask: pairs, verdict };
}

export function aggregate({ config, taskSet, armsInfo, runs: allRuns, judgments, activeJudgeSet = null, otherJudgeSets = {} }) {
  const tasksById = Object.fromEntries(taskSet.tasks.map((task) => [task.id, task]));
  const scoringWarnings = [];
  // Runs that failed the isolation check saw config the arm did not install: excluded from everything.
  const isolated = allRuns.filter((run) => run.status === 'isolation');
  const runs = allRuns.filter((run) => run.status !== 'isolation');
  if (isolated.length) scoringWarnings.push(`${isolated.length} run(s) failed the isolation check and are excluded from every figure: ${isolated.map((run) => `${run.id} (${(run.isolation?.problems ?? []).join('; ') || run.error || 'no detail'})`).join('; ')}.`);
  for (const plugin of armsInfo.A?.plugins ?? []) {
    const other = (armsInfo.B?.plugins ?? []).find((entry) => pluginName(entry) === pluginName(plugin));
    const label = (entry) => `${entry.version ?? '?'}${entry.gitCommitSha ? ` (${entry.gitCommitSha.slice(0, 7)})` : ''}`;
    if (other && typeof plugin === 'object' && (plugin.version !== other.version || (plugin.gitCommitSha ?? null) !== (other.gitCommitSha ?? null))) {
      scoringWarnings.push(`Plugin ${pluginName(plugin)} differs between arms: A ${label(plugin)}, B ${label(other)}. Any difference may come from the plugin version, not the change under test.`);
    }
  }
  const excludedIds = new Set(isolated.map((run) => run.id));
  const usable = (set) => set.filter((judgment) => !(judgment.runs ?? []).some((id) => excludedIds.has(id))).map(applyTieRule);
  judgments = usable(judgments);
  otherJudgeSets = Object.fromEntries(Object.entries(otherJudgeSets).map(([id, set]) => [id, usable(set)]));
  const retied = judgments.filter((judgment) => judgment.preferenceAsRecorded).length;
  if (retied) scoringWarnings.push(`${retied} judgment(s) were saved under the older tie rule (one vote plus a tie counted as a win) and are reported as ties.`);

  const taskIds = config.taskIds.filter((id) => runs.some((run) => run.task === id));
  const armRuns = (arm, filter = () => true) => runs.filter((run) => run.arm === arm && filter(run));
  const section = (filter, judgmentFilter) => ({
    A: armStats(armRuns('A', filter)),
    B: armStats(armRuns('B', filter)),
    judge: judgeStats(judgments.filter(judgmentFilter))
  });
  const seed = config.seed ?? 1;
  const unscoredTasks = taskIds.filter((id) => runs.filter((run) => run.task === id).every((run) => scoreRun(run).score === null));

  const twoArms = !config.singleArm;
  // Judge scores as per-arm rows so the same task-level machinery applies to them.
  const judgeRuns = judgments.filter((judgment) => judgment.kind === 'AB').map((judgment) => [
    { task: judgment.task, arm: 'A', overall: judgment.scores.A?.overall },
    { task: judgment.task, arm: 'B', overall: judgment.scores.B?.overall }
  ]).flat();
  const primary = twoArms ? compareTasks({ runs, taskIds, seed, bounds: [0, 1], metric: 'run score (mean required-check score)', value: (run) => scoreRun(run).score }) : null;
  const allPass = twoArms ? compareTasks({ runs, taskIds, seed, bounds: [0, 1], metric: 'all-pass rate', value: (run) => (scoreRun(run).score === null ? null : Number(scoreRun(run).allPass)) }) : null;
  const judge = twoArms && judgeRuns.length ? compareTasks({ runs: judgeRuns, taskIds, seed, bounds: [1, 5], metric: 'judge overall (1-5)', value: (row) => row.overall ?? null }) : null;
  const cost = twoArms ? {
    ...compareCost({ runs, taskIds, seed, metric: 'cost per run (USD)', value: (run) => run.cost?.usd ?? null }),
    wallMin: compareCost({ runs, taskIds, seed, metric: 'wall time per run (min)', value: (run) => (typeof run.wallMs === 'number' ? run.wallMs / 60000 : null) }),
    turns: compareCost({ runs, taskIds, seed, metric: 'turns per run', value: (run) => run.agent?.turns ?? null })
  } : null;

  // Continuous (json-score) checks that recur across tasks get a descriptive paired comparison each.
  const scoreCheckTasks = {};
  for (const run of runs) for (const check of run.checks ?? []) if (check?.reporter === 'json-score') (scoreCheckTasks[check.id] ??= new Set()).add(run.task);
  const scoreComponents = twoArms ? Object.entries(scoreCheckTasks).filter(([, tasks]) => tasks.size >= MIN_TASKS).map(([id]) => ({
    id,
    ...compareTasks({ runs, taskIds, seed, bounds: [0, 1], metric: `check ${id} score`, value: (run) => run.checks?.find((check) => check?.id === id)?.score ?? null })
  })) : [];

  const perTask = taskIds.map((id) => {
    const row = { id, category: tasksById[id]?.category, ...section((run) => run.task === id, (j) => j.task === id) };
    const paired = primary?.perTask.find((entry) => entry.task === id);
    return { ...row, scoreA: paired?.A ?? row.A.score, scoreB: paired?.B ?? row.B.score, d: paired?.d ?? null, unscored: unscoredTasks.includes(id) };
  });
  const perCategory = Object.entries(taskSet.categories)
    .map(([key, category]) => ({ key, label: category.label ?? key, control: Boolean(category.control), ...section((run) => tasksById[run.task]?.category === key, (j) => tasksById[j.task]?.category === key) }))
    .filter((category) => category.A.n + category.B.n > 0);
  const overall = section(() => true, () => true);

  const overhead = Object.fromEntries(['costUsd', 'outputTokens', 'inputTokens', 'wallMin', 'turns', 'toolCalls']
    .map((key) => [key, relative(overall.B[key], overall.A[key])]));
  const nonControl = section((run) => !taskSet.categories[tasksById[run.task]?.category]?.control, () => false);
  const overheadNonControl = relative(nonControl.B.costUsd, nonControl.A.costUsd);

  // Routing telemetry for watched components (changed between arms or requested with --watch):
  // policies and skills by name, plugins as `plugin:<name>`.
  const watched = [...new Set([...(armsInfo.watched ?? []), ...(config.watch ?? [])])].sort();
  const telemetry = { watched, perPolicy: {} };
  for (const name of watched) {
    const entry = { fired: {}, falseTriggers: {}, misses: {} };
    for (const arm of ['A', 'B']) {
      if (!armHas(armsInfo[arm], name)) continue;
      const plugin = name.startsWith('plugin:') ? armPlugin(armsInfo[arm], name) : null;
      const firedIn = (run) => componentFired(run, name, plugin);
      const expects = (run) => expectedComponents(tasksById[run.task]).includes(name);
      const notExpected = armRuns(arm, (run) => !expects(run));
      const expected = armRuns(arm, expects);
      const controls = notExpected.filter((run) => taskSet.categories[tasksById[run.task]?.category]?.control);
      const fired = armRuns(arm, (run) => firedIn(run));
      entry.fired[arm] = { runs: armRuns(arm).length, fired: fired.map((run) => run.id), tasks: [...new Set(fired.map((run) => run.task))].sort() };
      entry.falseTriggers[arm] = {
        controlRuns: controls.length,
        controlFired: controls.filter((run) => firedIn(run)).length,
        unexpectedRuns: notExpected.length,
        unexpectedFired: notExpected.filter((run) => firedIn(run)).map((run) => run.id)
      };
      entry.misses[arm] = {
        expectedRuns: expected.length,
        missed: expected.filter((run) => !firedIn(run)).map((run) => run.id)
      };
    }
    telemetry.perPolicy[name] = entry;
  }

  const noise = noiseFloor(judgments, armsInfo.identical, seed);
  const notable = notableDiffs({ perTask, judgments: judgments.filter((j) => j.kind === 'AB'), runs });
  if (twoArms && armsInfo.identical) {
    for (const [label, comparison] of [['primary', primary], ['all-pass', allPass], ['judge', judge]]) {
      if (comparison && ['A better', 'B better'].includes(comparison.verdict.code)) scoringWarnings.push(`A/A eval: the ${label} metric says "${comparison.verdict.code}" between identical arms. That is a false positive (expected about 5% of the time per metric).`);
    }
  }
  if (unscoredTasks.length) scoringWarnings.push(`${unscoredTasks.length} task(s) have no required checks and are left out of the primary metric: ${unscoredTasks.join(', ')}.`);
  const headline = twoArms ? headlineLines({ primary, judge, cost }) : null;
  const recommendation = twoArms
    ? { verdict: primary.verdict.code, reasons: headline }
    : { verdict: 'single-arm validation', reasons: ['Only arm A ran: this report validates tasks, checks and gates, not a change. Comparison, judge and cost-overhead sections are empty by design.'] };

  const sum = (items, pick) => items.reduce((total, item) => total + (pick(item) ?? 0), 0);
  // Reused runs were paid for by the eval that made them: their recorded cost stays in the cost
  // comparison but not in this eval's spend.
  const newRuns = allRuns.filter((run) => !run.reusedFrom);
  const reusedRuns = allRuns.filter((run) => run.reusedFrom);
  const spend = {
    runsUsd: sum(newRuns, (run) => run.cost?.usd),
    runsUsdByArm: { A: sum(newRuns.filter((run) => run.arm === 'A'), (run) => run.cost?.usd), B: sum(newRuns.filter((run) => run.arm === 'B'), (run) => run.cost?.usd) },
    reusedRuns: reusedRuns.length,
    reusedUsdByArm: { A: sum(reusedRuns.filter((run) => run.arm === 'A'), (run) => run.cost?.usd), B: sum(reusedRuns.filter((run) => run.arm === 'B'), (run) => run.cost?.usd) },
    judgeSet: activeJudgeSet,
    judgeUsd: sum(judgments, (judgment) => judgment.costUsd),
    judgeUsdPerJudgment: judgments.length ? sum(judgments, (judgment) => judgment.costUsd) / judgments.length : null,
    otherJudgeSetsUsd: Object.fromEntries(Object.entries(otherJudgeSets).map(([id, set]) => [id, sum(set, (judgment) => judgment.costUsd)]))
  };
  spend.totalUsd = spend.runsUsd + spend.judgeUsd + Object.values(spend.otherJudgeSetsUsd).reduce((total, value) => total + value, 0);
  const reuse = Object.fromEntries(['A', 'B'].map((arm) => {
    const armAll = allRuns.filter((run) => run.arm === arm);
    const sources = {};
    for (const run of armAll.filter((entry) => entry.reusedFrom)) {
      const source = (sources[run.reusedFrom.dir] ??= { dir: run.reusedFrom.dir, runs: 0, madeAt: run.reusedFrom.madeAt ?? null });
      source.runs += 1;
      if (run.reusedFrom.madeAt && (!source.madeAt || run.reusedFrom.madeAt < source.madeAt)) source.madeAt = run.reusedFrom.madeAt;
    }
    // Runs reused with --reuse-allow-plugin-drift, grouped by plugin and version change.
    const pluginDrift = {};
    for (const run of armAll) {
      for (const plugin of run.reusedFrom?.pluginDrift ?? []) {
        const key = `${plugin.id}\0${plugin.from.version}\0${plugin.to.version}`;
        (pluginDrift[key] ??= { ...plugin, runs: 0 }).runs += 1;
      }
    }
    return [arm, { runs: armAll.length, reused: armAll.length - armAll.filter((run) => !run.reusedFrom).length, sources: Object.values(sources), pluginDrift: Object.values(pluginDrift) }];
  }));
  const driftRuns = reusedRuns.filter((run) => run.reusedFrom.pluginDrift?.length).length;
  if (reusedRuns.length) scoringWarnings.push(`${reusedRuns.length} run(s) were reused from earlier evals (see Setup), not made in the same time window as this eval's new runs: drift on the provider's side between then and now is not controlled. Their inputs, plugin versions and commits included, are identical by inputsKey${driftRuns ? `, except ${driftRuns} reused with plugin drift (below)` : ''}.`);
  for (const arm of ['A', 'B']) {
    for (const plugin of reuse[arm].pluginDrift) scoringWarnings.push(`${plugin.runs} reused run(s) were made with ${plugin.id.split('@')[0]} ${plugin.from.version}; this eval's arm ${arm} has ${plugin.to.version}; the plugin did not fire in those runs.`);
  }
  const judgeComparisons = Object.entries(otherJudgeSets).map(([id, set]) => ({ id, ...compareJudgeSets(judgments, set, armsInfo.identical) }));
  const runtimeSmoke = Object.fromEntries(['A', 'B'].map((arm) => {
    const checked = runs.filter((run) => run.arm === arm && (run.browser || run.http));
    return [arm, checked.length ? { runs: checked.length, pass: checked.filter((run) => (run.browser?.ok ?? true) && (run.http?.ok ?? true)).length } : null];
  }));
  const sample = {
    tasks: taskIds.length,
    pairedTasks: primary?.tasks ?? 0,
    reps: config.reps ?? null,
    runs: runs.length,
    excludedRuns: isolated.map((run) => run.id),
    unscoredTasks
  };
  return { generatedAt: new Date().toISOString(), runs: runs.length, judgments: judgments.length, sample, headline, primary, allPass, judge, cost, spend, scoringWarnings, judgeComparisons, runtimeSmoke, reuse, scoreComponents, perTask, perCategory, overall, overhead, overheadNonControl, telemetry, noise, notable, recommendation };
}

/**
 * The two headline lines: quality (primary metric; the judge only breaks a "no difference" or
 * "cannot conclude", and never upgrades it to "better") and cost.
 */
export function headlineLines({ primary, judge, cost }) {
  const tiebreak = judge && ['no difference', 'cannot conclude'].includes(primary.verdict.code)
    ? `; judge (secondary) favours ${judge.verdict.code === 'B better' ? 'B' : judge.verdict.code === 'A better' ? 'A' : 'neither'}`
    : '';
  const quality = `Quality: ${primary.verdict.text}${tiebreak}. Mean B−A ${fmtSigned(primary.mean)} on the ${primary.metric}, paired-t 95% CI ${fmtCi(primary.ci)}, bootstrap ${fmtCi(primary.bootstrapCi)}, MDE ${fmt(primary.mde)}, over ${primary.tasks} paired task(s).`;
  return [quality, `Cost per run (USD): ${cost.verdict.text}, over ${cost.tasks} paired task(s).`];
}

const pearson = (xs, ys) => {
  if (xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
};

/**
 * How far a second judge agrees with the active one on the same pairs: preference agreement,
 * decisive flips (one prefers A, the other B), score deltas, correlation of B−A margins, cost and
 * each judge's own noise floor.
 */
export function compareJudgeSets(primary, other, armsIdentical) {
  const byId = new Map(other.map((judgment) => [judgment.id, judgment]));
  const common = primary.filter((judgment) => byId.has(judgment.id));
  const margin = (judgment) => judgment.scores[judgment.sides[1]].overall - judgment.scores[judgment.sides[0]].overall;
  const decisiveBoth = common.filter((judgment) => judgment.preference !== 'tie' && byId.get(judgment.id).preference !== 'tie');
  const summarise = (set) => ({
    judgments: set.length,
    costUsd: set.reduce((total, judgment) => total + (judgment.costUsd ?? 0), 0),
    costPerJudgment: set.length ? set.reduce((total, judgment) => total + (judgment.costUsd ?? 0), 0) / set.length : null,
    decisiveRate: set.length ? set.filter((judgment) => judgment.preference !== 'tie').length / set.length : null,
    splitRate: set.length ? set.filter((judgment) => !judgment.unanimous).length / set.length : null,
    noise: noiseFloor(set, armsIdentical)
  });
  return {
    pairs: common.length,
    preferenceAgreement: common.length ? common.filter((judgment) => judgment.preference === byId.get(judgment.id).preference).length / common.length : null,
    decisiveBoth: decisiveBoth.length,
    decisiveFlips: decisiveBoth.filter((judgment) => judgment.preference !== byId.get(judgment.id).preference).length,
    meanAbsScoreDelta: mean(common.flatMap((judgment) => judgment.sides.map((side) => Math.abs(judgment.scores[side].overall - byId.get(judgment.id).scores[side].overall)))),
    marginCorrelation: pearson(common.map(margin), common.map((judgment) => margin(byId.get(judgment.id)))),
    active: summarise(common),
    other: summarise(common.map((judgment) => byId.get(judgment.id)))
  };
}

export function notableDiffs({ perTask, judgments, runs }) {
  const notes = [];
  for (const task of perTask) {
    for (const [id, a] of Object.entries(task.A.checks)) {
      const b = task.B.checks[id];
      if (!b || !a.n || !b.n) continue;
      const delta = b.score - a.score;
      if (Math.abs(delta) >= 0.5) notes.push({ kind: 'check', task: task.id, text: `${a.label} (${a.level}): A ${a.pass}/${a.n} passed (score ${fmt(a.score)}), B ${b.pass}/${b.n} (score ${fmt(b.score)})` });
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
  for (const run of runs.filter((r) => r.http && !r.http.ok)) notes.push({ kind: 'http', task: run.task, text: `${run.id} HTTP smoke failed: ${run.http.error ?? Object.entries(run.http.requests).filter(([, v]) => !v.ok).map(([name, v]) => `${name} got ${v.status}, expected ${v.expected}`).join('; ')}` });
  for (const run of runs.filter((r) => r.browser && !r.browser.ok)) notes.push({ kind: 'browser', task: run.task, text: `${run.id} browser smoke failed: ${run.browser.error ?? Object.entries(run.browser.routes).filter(([, v]) => v.errors.length || !v.textLength).map(([route, v]) => `${route} ${v.errors[0] ?? 'empty'}`).join('; ')}` });
  for (const run of runs.filter((r) => r.status !== 'ok')) notes.push({ kind: 'error', task: run.task, text: `${run.id} did not complete (${run.error ?? `exit ${run.exitCode}`})` });
  return notes;
}

export const fmt = (value, digits = 2) => (value === null || value === undefined || Number.isNaN(value) ? '–' : Number(value).toFixed(digits));
export const fmtSigned = (value, digits = 2) => (value === null || value === undefined ? '–' : `${value >= 0 ? '+' : ''}${Number(value).toFixed(digits)}`);
