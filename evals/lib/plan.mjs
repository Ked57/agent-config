// Pure planning: run queue order, judge pairs, budget decisions.

export function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 2 ** 32;
  };
}

export const shuffle = (items, random) => items.map((item) => [random(), item]).sort((a, b) => a[0] - b[0]).map(([, item]) => item);

export const runId = (task, arm, rep) => `${task}__${arm}__r${rep}`;

/**
 * Interleaves the matrix rep by rep (all tasks at rep 1 before rep 2) with task and arm order
 * shuffled per rep, so a budget stop leaves balanced arms and order effects are spread out.
 */
export function buildRunQueue({ taskIds, reps, seed, arms = ['A', 'B'] }) {
  const random = seededRandom(seed);
  const queue = [];
  for (let rep = 1; rep <= reps; rep += 1) {
    for (const task of shuffle(taskIds, random)) {
      for (const arm of shuffle(arms, random)) queue.push({ id: runId(task, arm, rep), task, arm, rep });
    }
  }
  return queue;
}

/**
 * A/B pairs for every (task, rep) with both arms completed, plus up to `controls` A#i-vs-A#j pairs
 * per task to measure the judge's noise floor (skipped when the arms are identical, because then
 * every A/B pair already is a control).
 */
export function planJudgePairs({ runs, controls, armsIdentical }) {
  const ok = runs.filter((run) => run.status === 'ok');
  const byKey = new Map(ok.map((run) => [runId(run.task, run.arm, run.rep), run]));
  const pairs = [];
  const tasks = [...new Set(ok.map((run) => run.task))].sort();
  for (const task of tasks) {
    const reps = [...new Set(ok.filter((run) => run.task === task).map((run) => run.rep))].sort((a, b) => a - b);
    for (const rep of reps) {
      const a = byKey.get(runId(task, 'A', rep));
      const b = byKey.get(runId(task, 'B', rep));
      if (a && b) pairs.push({ id: `${task}__AB__r${rep}`, kind: 'AB', task, reps: [rep, rep], left: a, right: b, sides: ['A', 'B'] });
    }
    if (armsIdentical) continue;
    const aReps = reps.filter((rep) => byKey.has(runId(task, 'A', rep)));
    for (let index = 0; index + 1 < aReps.length && index / 2 < controls; index += 2) {
      const [r1, r2] = [aReps[index], aReps[index + 1]];
      pairs.push({ id: `${task}__AA__r${r1}-r${r2}`, kind: 'AA', task, reps: [r1, r2], left: byKey.get(runId(task, 'A', r1)), right: byKey.get(runId(task, 'A', r2)), sides: ['A#1', 'A#2'] });
    }
  }
  return pairs;
}

/** Whether another unit of work may start given spend so far. `runsDone` counts completed runs. */
export function budgetAllows({ maxUsd, maxRuns }, { spentUsd, runsDone, runsInFlight = 0 }, kind = 'run') {
  if (maxUsd !== null && maxUsd !== undefined && spentUsd >= maxUsd) return { ok: false, reason: `budget cap $${maxUsd} reached ($${spentUsd.toFixed(2)} spent)` };
  if (kind === 'run' && maxRuns !== null && maxRuns !== undefined && runsDone + runsInFlight >= maxRuns) return { ok: false, reason: `run cap ${maxRuns} reached` };
  return { ok: true };
}

/** Flags that define an eval and are frozen in its config.json: passing one with --resume would be silently ignored. */
const FIXED_ON_RESUME = { a: '--a', b: '--b', aAdd: '--a-add', aRemove: '--a-remove', bAdd: '--b-add', bRemove: '--b-remove', tasks: '--tasks', only: '--only', smoke: '--smoke', reps: '--reps', provider: '--provider', model: '--model', effort: '--effort', timeoutMin: '--timeout-min', singleArm: '--single-arm', env: '--env', name: '--name', out: '--out' };

export const fixedFlagsOnResume = (raw) => Object.entries(FIXED_ON_RESUME).filter(([key]) => raw[key] !== undefined).map(([, flag]) => flag);

/** Installed files whose content hash differs between an arm's build-time inventory and now. */
export function changedArmFiles(built = {}, current = {}) {
  return [...new Set([...Object.keys(built), ...Object.keys(current)])].sort().filter((file) => built[file] !== current[file]);
}

/** Checks whose pass/fail differs between two result lists (added and removed checks included). */
export function flippedChecks(before = [], after = []) {
  const was = Object.fromEntries(before.filter(Boolean).map((check) => [check.id, check.pass]));
  const now = Object.fromEntries(after.filter(Boolean).map((check) => [check.id, check.pass]));
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].sort()
    .filter((id) => was[id] !== now[id])
    .map((id) => ({ check: id, from: was[id] ?? null, to: now[id] ?? null }));
}
