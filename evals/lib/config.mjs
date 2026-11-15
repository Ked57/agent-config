// Pure configuration helpers: CLI parsing, presets, task-set validation, globs.

export const DEFAULTS = Object.freeze({
  a: 'main',
  b: null,
  tasks: 'vue-primevue',
  reps: 3,
  concurrency: 3,
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'medium',
  timeoutMin: 45,
  judge: true,
  judgeProvider: 'claude',
  judgeModel: 'claude-opus-5-5',
  judgeEffort: 'medium',
  judgeCommand: null,
  judgeReps: 2,
  judgeControls: 1,
  browser: false,
  maxUsd: null,
  maxRuns: null
});

const LIST_FLAGS = new Set(['a-add', 'a-remove', 'b-add', 'b-remove', 'env', 'watch', 'only']);
const BOOLEAN_FLAGS = new Set(['smoke', 'browser', 'no-judge', 'dry-run', 'report-only', 'help']);
const NUMBER_FLAGS = new Set(['reps', 'concurrency', 'timeout-min', 'judge-reps', 'judge-controls', 'max-usd', 'max-runs']);
const STRING_FLAGS = new Set(['a', 'b', 'tasks', 'provider', 'model', 'effort', 'judge-provider', 'judge-model', 'judge-effort', 'judge-command', 'out', 'resume', 'name']);

const camel = (flag) => flag.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

/** Parses argv into raw options (only flags the user passed). Throws on unknown or malformed flags. */
export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const [flag, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${flag}`);
      index += 1;
      return value;
    };
    if (BOOLEAN_FLAGS.has(flag)) {
      if (flag === 'no-judge') options.judge = false;
      else options[camel(flag)] = true;
    } else if (NUMBER_FLAGS.has(flag)) {
      const value = Number(takeValue());
      if (!Number.isFinite(value) || value < 0) throw new Error(`--${flag} must be a non-negative number`);
      options[camel(flag)] = value;
    } else if (LIST_FLAGS.has(flag)) {
      const key = camel(flag);
      const value = takeValue();
      const values = flag === 'only' ? value.split(',').map((item) => item.trim()).filter(Boolean) : [value];
      options[key] = [...(options[key] ?? []), ...values];
    } else if (STRING_FLAGS.has(flag)) {
      options[camel(flag)] = takeValue();
    } else {
      throw new Error(`Unknown option: --${flag}`);
    }
  }
  return options;
}

/** Parses `--x-add <path>[=<source>]`. Source is `<ref>` (same path from that ref), `<ref>:<path>`, or a filesystem path. */
export function parseToggle(spec) {
  const [target, source] = spec.split(/=(.*)/s, 2);
  if (!target || target.startsWith('/') || target.split('/').includes('..')) throw new Error(`Invalid toggle path: ${spec}`);
  if (!/^(policy|skills)\//.test(target)) throw new Error(`Toggles must target policy/ or skills/: ${spec}`);
  return { path: target.replace(/\/$/, ''), source: source || null };
}

const parseEnv = (pairs = []) => Object.fromEntries(pairs.map((pair) => {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(pair);
  if (!match) throw new Error(`--env expects KEY=VALUE, got: ${pair}`);
  return [match[1], match[2]];
}));

/**
 * Merges defaults, raw options and the task set into the effective run config.
 * The smoke preset selects the task set's `smoke` list and one rep unless overridden.
 */
export function resolveConfig(raw, taskSet) {
  if (!raw.b && !raw.reportOnly) throw new Error('--b <ref> is required (use --b main for an A/A control run)');
  const config = { ...DEFAULTS, ...raw };
  config.env = parseEnv(raw.env);
  config.arms = {
    A: { ref: config.a, add: (raw.aAdd ?? []).map(parseToggle), remove: raw.aRemove ?? [] },
    B: { ref: config.b, add: (raw.bAdd ?? []).map(parseToggle), remove: raw.bRemove ?? [] }
  };
  const known = new Set(taskSet.tasks.map((task) => task.id));
  let taskIds = taskSet.tasks.map((task) => task.id);
  if (raw.smoke) {
    taskIds = taskSet.smoke ?? taskIds.slice(0, 4);
    if (raw.reps === undefined) config.reps = 1;
  }
  if (raw.only) {
    for (const id of raw.only) if (!known.has(id)) throw new Error(`Unknown task id in --only: ${id}`);
    taskIds = raw.only;
  }
  config.taskIds = taskIds;
  config.watch = raw.watch ?? [];
  if (config.reps < 1) throw new Error('--reps must be at least 1');
  if (config.concurrency < 1) throw new Error('--concurrency must be at least 1');
  if (config.judgeReps < 1) throw new Error('--judge-reps must be at least 1');
  if (config.judgeCommand) config.judgeProvider = 'command';
  config.name = raw.name ?? `${slug(config.a)}-vs-${slug(config.b ?? '')}${raw.smoke ? '-smoke' : ''}`;
  delete config.a;
  delete config.b;
  delete config.aAdd;
  delete config.aRemove;
  delete config.bAdd;
  delete config.bRemove;
  return config;
}

export const slug = (value) => String(value).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

const CHECK_TYPES = new Set(['pattern', 'changed']);

/** Returns a list of human-readable problems with a task set; empty when valid. */
export function validateTaskSet(taskSet) {
  const errors = [];
  if (!taskSet || typeof taskSet !== 'object') return ['task set must be an object'];
  if (typeof taskSet.name !== 'string') errors.push('name must be a string');
  if (typeof taskSet.fixture !== 'string') errors.push('fixture must be a string');
  const categories = taskSet.categories ?? {};
  if (!Array.isArray(taskSet.tasks) || taskSet.tasks.length === 0) errors.push('tasks must be a non-empty array');
  const regexOk = (pattern, where) => {
    try {
      new RegExp(pattern, 'm');
    } catch (error) {
      errors.push(`${where}: invalid regex (${error.message})`);
    }
  };
  for (const [name, pattern] of Object.entries(taskSet.featurePatterns ?? {})) regexOk(pattern, `featurePatterns.${name}`);
  for (const [name, signal] of Object.entries(taskSet.policySignals ?? {})) {
    if (typeof signal?.commandPattern !== 'string') errors.push(`policySignals.${name}.commandPattern must be a string`);
    else regexOk(signal.commandPattern, `policySignals.${name}`);
  }
  const ids = new Set();
  for (const [index, task] of (taskSet.tasks ?? []).entries()) {
    const where = `tasks[${index}]${task?.id ? ` (${task.id})` : ''}`;
    if (typeof task?.id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(task.id)) errors.push(`${where}: id must match [A-Za-z0-9._-]+`);
    else if (ids.has(task.id)) errors.push(`${where}: duplicate id`);
    else ids.add(task.id);
    if (typeof task?.prompt !== 'string' || !task.prompt.trim()) errors.push(`${where}: prompt is required`);
    if (!(task?.category in categories)) errors.push(`${where}: unknown category ${task?.category}`);
    if (task?.expectsPolicies !== undefined && !(Array.isArray(task.expectsPolicies) && task.expectsPolicies.every((p) => typeof p === 'string'))) {
      errors.push(`${where}: expectsPolicies must be a string array`);
    }
    const checkIds = new Set();
    for (const [checkIndex, check] of (task?.checks ?? []).entries()) {
      const cwhere = `${where}.checks[${checkIndex}]`;
      if (typeof check?.id !== 'string' || checkIds.has(check.id)) errors.push(`${cwhere}: id must be a unique string`);
      checkIds.add(check?.id);
      if (!CHECK_TYPES.has(check?.type)) errors.push(`${cwhere}: type must be pattern or changed`);
      if (check?.level !== undefined && !['required', 'info'].includes(check.level)) errors.push(`${cwhere}: level must be required or info`);
      if (check?.type === 'pattern') {
        if (!['added', 'final'].includes(check.in)) errors.push(`${cwhere}: in must be added or final`);
        if (!['present', 'absent'].includes(check.expect)) errors.push(`${cwhere}: expect must be present or absent`);
        if (check.in === 'final' && !(Array.isArray(check.files) && check.files.length)) errors.push(`${cwhere}: final checks need files`);
        if (typeof check.pattern !== 'string') errors.push(`${cwhere}: pattern is required`);
        else regexOk(check.pattern, cwhere);
      }
      if (check?.type === 'changed') {
        if (!(Array.isArray(check.files) && check.files.length)) errors.push(`${cwhere}: files is required`);
        if (!['any', 'none'].includes(check.expect)) errors.push(`${cwhere}: expect must be any or none`);
      }
    }
  }
  for (const id of taskSet.smoke ?? []) if (!ids.has(id)) errors.push(`smoke: unknown task id ${id}`);
  return errors;
}

/** Converts a glob (`**`, `*`, `?`) over forward-slash paths into an anchored RegExp. */
export function globToRegExp(glob) {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      const slash = glob[index + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      index += slash ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

export const matchesAny = (file, globs) => globs.some((glob) => globToRegExp(glob).test(file));
