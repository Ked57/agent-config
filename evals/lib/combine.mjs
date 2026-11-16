// Pure merge of several finished evals (one task set each) into one eval, so the task-level paired
// statistics run over every task of every fixture together. See `--combine` in evals/README.md.
import crypto from 'node:crypto';
import { runId } from './plan.mjs';

const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const sortedHashes = (hashes = {}) => Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Everything that defines what an arm's agent ran with: ref and commit, toggles, prefix, plugin mode,
 * each plugin's version and commit, and a digest of the installed files (which also covers `WORKTREE`
 * arms, whose commit is null).
 */
export function armIdentity(config, armsInfo, arm) {
  const info = armsInfo?.[arm] ?? {};
  const spec = config.arms?.[arm] ?? {};
  return {
    ref: info.ref ?? spec.ref ?? null,
    sha: info.sha ?? null,
    add: (info.add ?? spec.add ?? []).map((toggle) => `${toggle.path}=${toggle.resolved ?? toggle.source ?? ''}`),
    remove: info.remove ?? spec.remove ?? [],
    prefix: spec.prefix ?? null,
    mode: spec.mode ?? null,
    pluginMode: info.pluginMode ?? config.plugins ?? null,
    plugins: (info.plugins ?? []).map((plugin) => `${plugin.id}@${plugin.version ?? '?'}#${plugin.gitCommitSha ?? '?'}`),
    installed: digest(sortedHashes(info.hashes))
  };
}

const AGENT_KEYS = ['provider', 'model', 'effort', 'singleArm'];

/** Why these evals can't be pooled: different agent settings or different arms. Empty when they can. */
export function combineProblems(inputs) {
  const problems = [];
  if (inputs.length < 2) problems.push('--combine needs at least two results dirs');
  const names = inputs.map((input) => input.taskSet.name);
  const repeated = names.filter((name, index) => names.indexOf(name) !== index);
  if (repeated.length) problems.push(`task set ${[...new Set(repeated)].join(', ')} appears more than once: combine different task sets (add reps to one eval with --resume)`);
  const [first, ...rest] = inputs;
  for (const input of rest) {
    for (const key of AGENT_KEYS) {
      if ((first.config[key] ?? null) !== (input.config[key] ?? null)) problems.push(`${input.dir}: ${key} ${input.config[key]} differs from ${first.dir} (${first.config[key]})`);
    }
    for (const arm of first.config.singleArm ? ['A'] : ['A', 'B']) {
      const want = armIdentity(first.config, first.armsInfo, arm);
      const have = armIdentity(input.config, input.armsInfo, arm);
      for (const key of Object.keys(want)) {
        if (JSON.stringify(want[key]) !== JSON.stringify(have[key])) problems.push(`${input.dir}: arm ${arm} ${key} ${JSON.stringify(have[key])} differs from ${first.dir} (${JSON.stringify(want[key])})`);
      }
    }
  }
  return problems;
}

/**
 * Merges inputs `{ dir, config, taskSet, armsInfo, runs, judgeSets: { <set>: judgments[] } }` into one
 * eval. A task id used by more than one task set becomes `<task set>.<id>`; every task and run keeps
 * `sourceSet`, `sourceTask` and `fixture`, and `renames` lists `{ dir, from, to }` for run ids so the
 * caller can copy run directories. Throws when `combineProblems` finds any.
 */
export function combineEvals(inputs, { name }) {
  const problems = combineProblems(inputs);
  if (problems.length) throw new Error(`Cannot combine:\n- ${problems.join('\n- ')}`);
  const idCount = {};
  for (const input of inputs) for (const task of input.taskSet.tasks) idCount[task.id] = (idCount[task.id] ?? 0) + 1;
  const categories = {};
  const policySignals = {};
  const featurePatterns = {};
  const tasks = [];
  const runs = [];
  const judgeSets = {};
  const renames = [];
  const taskIds = [];
  for (const input of inputs) {
    const set = input.taskSet.name;
    const fixture = input.taskSet.fixture;
    const newTaskId = (id) => (idCount[id] > 1 ? `${set}.${id}` : id);
    const categoryKey = {};
    for (const [key, category] of Object.entries(input.taskSet.categories ?? {})) {
      const clash = categories[key] && JSON.stringify(categories[key]) !== JSON.stringify(category);
      categoryKey[key] = clash ? `${set}.${key}` : key;
      categories[categoryKey[key]] = category;
    }
    Object.assign(policySignals, Object.fromEntries(Object.entries(input.taskSet.policySignals ?? {}).filter(([key]) => !(key in policySignals))));
    Object.assign(featurePatterns, Object.fromEntries(Object.entries(input.taskSet.featurePatterns ?? {}).filter(([key]) => !(key in featurePatterns))));
    for (const task of input.taskSet.tasks) tasks.push({ ...task, id: newTaskId(task.id), category: categoryKey[task.category] ?? task.category, sourceSet: set, sourceTask: task.id, fixture });
    for (const id of input.config.taskIds ?? input.taskSet.tasks.map((task) => task.id)) taskIds.push(newTaskId(id));
    const runIds = {};
    for (const run of input.runs) {
      const task = newTaskId(run.task);
      const id = runId(task, run.arm, run.rep);
      runIds[run.id] = id;
      renames.push({ dir: input.dir, from: run.id, to: id });
      runs.push({ ...run, id, task, category: categoryKey[run.category] ?? run.category, sourceSet: set, sourceTask: run.task, sourceRun: run.id, fixture });
    }
    for (const [judgeSet, judgments] of Object.entries(input.judgeSets ?? {})) {
      judgeSets[judgeSet] ??= [];
      for (const judgment of judgments) {
        const task = newTaskId(judgment.task);
        judgeSets[judgeSet].push({ ...judgment, id: `${task}${judgment.id.slice(judgment.task.length)}`, task, runs: (judgment.runs ?? []).map((id) => runIds[id] ?? id), sourceSet: set, fixture });
      }
    }
  }
  const first = inputs[0];
  const config = {
    ...first.config,
    name,
    taskIds,
    reps: Math.max(...inputs.map((input) => input.config.reps ?? 1)),
    fixtureHash: null,
    combined: {
      inputs: inputs.map((input) => ({ dir: input.dir, taskSet: input.taskSet.name, fixture: input.taskSet.fixture, fixtureHash: input.config.fixtureHash ?? null, runs: input.runs.length, name: input.config.name }))
    }
  };
  delete config.sandbox;
  const taskSet = { name, fixture: [...new Set(inputs.map((input) => input.taskSet.fixture))].join('+'), categories, policySignals, featurePatterns, tasks };
  return { config, taskSet, armsInfo: { ...first.armsInfo, combinedFrom: inputs.map((input) => input.dir) }, runs, judgeSets, renames };
}
