// Pure configuration helpers: CLI parsing, presets, task-set validation, globs.

export const DEFAULTS = Object.freeze({
  a: 'main',
  b: null,
  tasks: 'vue-primevue',
  reps: 3,
  // One run at a time unless asked: parallel agents share the machine, ports and the provider's rate limits.
  concurrency: 1,
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'medium',
  timeoutMin: 45,
  judge: true,
  judgeProvider: 'claude',
  // Sonnet judges at a fraction of Opus cost; see evals/README.md for the measured agreement.
  judgeModel: 'claude-sonnet-5-5',
  judgeEffort: 'medium',
  judgeCommand: null,
  judgeReps: 2,
  judgeControls: 1,
  browser: false,
  http: false,
  maxUsd: null,
  maxRuns: null,
  // Non-bare arms install the ref's external plugins; 'skip' keeps installs offline.
  plugins: 'install',
  // Stop the eval at the first run whose session loaded something the arm did not install.
  strictIsolation: true,
  // Wait before starting an agent run while less memory than this is available (0: never wait).
  minFreeMb: 1500,
  // Copy a finished run with the same inputsKey from another result dir instead of running it again.
  reuse: true
});

const LIST_FLAGS = new Set(['a-add', 'a-remove', 'b-add', 'b-remove', 'env', 'watch', 'only', 'reuse-from']);
const BOOLEAN_FLAGS = new Set(['smoke', 'browser', 'http', 'no-judge', 'dry-run', 'report-only', 'rejudge', 'recheck', 'single-arm', 'strict-isolation', 'no-strict-isolation', 'accept-arm-drift', 'keep-linked', 'no-reuse', 'assume-template-unchanged', 'help']);
const NUMBER_FLAGS = new Set(['min-free-mb', 'reps', 'concurrency', 'timeout-min', 'judge-reps', 'judge-controls', 'max-usd', 'max-runs']);
const STRING_FLAGS = new Set(['a', 'b', 'tasks', 'provider', 'model', 'effort', 'judge-provider', 'judge-model', 'judge-effort', 'judge-command', 'out', 'resume', 'name', 'plugins', 'a-prefix', 'b-prefix', 'a-mode', 'b-mode', 'backfill-keys']);

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
    if (flag === 'combine') {
      // `--combine <dir> <dir> ...`: every following argument up to the next flag.
      const dirs = inlineValue !== undefined ? [inlineValue] : [];
      while (argv[index + 1] !== undefined && !argv[index + 1].startsWith('--')) dirs.push(argv[(index += 1)]);
      if (!dirs.length) throw new Error('Missing value for --combine');
      options.combine = [...(options.combine ?? []), ...dirs];
    } else if (BOOLEAN_FLAGS.has(flag)) {
      if (flag === 'no-judge') options.judge = false;
      else if (flag === 'no-strict-isolation') options.strictIsolation = false;
      else if (flag === 'no-reuse') options.reuse = false;
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
  if (spec.startsWith('plugin:')) throw new Error(`Adding a plugin is not supported; build the arm from a ref that declares it: ${spec}`);
  const [target, source] = spec.split(/=(.*)/s, 2);
  if (!target || target.startsWith('/') || target.split('/').includes('..')) throw new Error(`Invalid toggle path: ${spec}`);
  if (!/^(policy|skills)\//.test(target)) throw new Error(`Toggles must target policy/ or skills/: ${spec}`);
  return { path: target.replace(/\/$/, ''), source: source || null };
}

/** Validates `--x-remove`: `policy/<x>.md`, `skills/<x>`, or `plugin:<id>` (an id from the ref's bin/external-plugins.mjs). */
export function parseRemove(spec) {
  if (spec.startsWith('plugin:')) {
    if (!/^plugin:[a-z0-9][a-z0-9._-]*$/.test(spec)) throw new Error(`Invalid plugin id: ${spec}`);
    return spec;
  }
  return parseToggle(spec).path;
}

/**
 * A task as it runs in input mode `mode` (see `modes` in evals/README.md): the mode's `prompt` replaces
 * the base prompt and its `files` are added to the base `files` (same source: the mode's target wins).
 * A task without that mode, or no mode, is returned unchanged.
 */
export function taskForMode(task, mode) {
  const entry = mode ? task.modes?.[mode] : null;
  if (!entry) return task;
  return { ...task, prompt: entry.prompt ?? task.prompt, ...(entry.files || task.files ? { files: { ...(task.files ?? {}), ...(entry.files ?? {}) } } : {}) };
}

/** The exact prompt an arm's agent receives: the task's own `promptPrefix[arm]` wins over the arm's `--x-prefix`. */
export function promptFor(task, arm, armSpec = {}) {
  const prefix = task.promptPrefix?.[arm] ?? armSpec.prefix ?? '';
  return prefix ? `${prefix} ${task.prompt}` : task.prompt;
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
  if (!raw.b && !raw.reportOnly && !raw.singleArm) throw new Error('--b <ref> is required (use --b main for an A/A control run, or --single-arm)');
  const config = { ...DEFAULTS, ...raw };
  // Single-arm runs exercise tasks and checks on one install; there is nothing to compare or judge.
  if (raw.singleArm) {
    config.b = config.a;
    config.judge = false;
  }
  config.env = parseEnv(raw.env);
  if (!['install', 'skip'].includes(config.plugins)) throw new Error('--plugins must be install or skip');
  const armSpec = (ref, add = [], remove = [], prefix, flag, modeFlag) => {
    if (prefix !== undefined && !prefix.trim()) throw new Error(`--${flag}-prefix must not be empty`);
    const mode = modeFlag ?? taskSet.defaultMode;
    if (modeFlag !== undefined && !taskSet.modes?.[modeFlag]) throw new Error(`--${flag}-mode ${modeFlag}: task set ${taskSet.name} has ${taskSet.modes ? `modes ${Object.keys(taskSet.modes).join(', ')}` : 'no modes'}`);
    if (ref === 'BARE' && (add.length || remove.length)) throw new Error(`--${flag}-add and --${flag}-remove do not apply to a BARE arm`);
    return { ref, add: add.map(parseToggle), remove: remove.map(parseRemove), ...(prefix !== undefined ? { prefix } : {}), ...(mode ? { mode } : {}) };
  };
  config.arms = {
    A: armSpec(config.a, raw.aAdd, raw.aRemove, raw.aPrefix, 'a', raw.aMode),
    B: armSpec(config.b, raw.bAdd, raw.bRemove, raw.singleArm ? raw.aPrefix : raw.bPrefix, 'b', raw.singleArm ? raw.aMode : raw.bMode)
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
  config.name = raw.name ?? (raw.singleArm ? `${slug(config.a)}-single` : `${slug(config.a)}-vs-${slug(config.b ?? '')}${raw.smoke ? '-smoke' : ''}`);
  delete config.a;
  delete config.b;
  delete config.aAdd;
  delete config.aRemove;
  delete config.bAdd;
  delete config.bRemove;
  delete config.aPrefix;
  delete config.bPrefix;
  delete config.aMode;
  delete config.bMode;
  return config;
}

/** Directory name for a judge configuration, so verdicts from different judges never mix. */
export function judgeSetId({ judgeProvider, judgeModel, judgeEffort, judgeCommand }) {
  if (judgeProvider === 'command') {
    let hash = 0;
    for (const char of judgeCommand ?? '') hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    return `command-${hash.toString(16).padStart(8, '0')}`;
  }
  const base = judgeProvider === 'claude' ? judgeModel : `${judgeProvider}-${judgeModel}`;
  return slug(judgeEffort && judgeEffort !== 'medium' ? `${base}-${judgeEffort}` : base);
}

export const slug = (value) => String(value).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

const CHECK_TYPES = new Set(['pattern', 'changed', 'command']);

/** A `{ "fixture-relative source": "app-relative target" }` map with no absolute or `..` paths. */
const relativeMap = (map) => Boolean(map) && typeof map === 'object' && !Array.isArray(map)
  && Object.entries(map).every(([from, to]) => typeof to === 'string' && from && to && !from.startsWith('/') && !to.startsWith('/') && !`${from}/${to}`.split('/').includes('..'));

const relativePath = (value) => typeof value === 'string' && value && !value.startsWith('/') && !value.split('/').includes('..');

/**
 * Problems with a task set's input `modes` and `defaultMode`. A mode may start local stdio MCP servers
 * (`mcpServers`: `{ command, args, env }`) from a fixture dir copied into the run (`serverFiles`);
 * network servers (`url`, `type` other than stdio) are refused.
 */
function modeErrors(taskSet) {
  const errors = [];
  if (taskSet.modes === undefined) {
    if (taskSet.defaultMode !== undefined) errors.push('defaultMode needs modes');
    return errors;
  }
  if (!taskSet.modes || typeof taskSet.modes !== 'object' || Array.isArray(taskSet.modes) || !Object.keys(taskSet.modes).length) return ['modes must be a non-empty object'];
  if (taskSet.defaultMode !== undefined && !taskSet.modes[taskSet.defaultMode]) errors.push(`defaultMode ${taskSet.defaultMode} is not one of the modes`);
  for (const [name, mode] of Object.entries(taskSet.modes)) {
    const where = `modes.${name}`;
    if (!/^[A-Za-z0-9._-]+$/.test(name)) errors.push(`${where}: name must match [A-Za-z0-9._-]+`);
    if (mode?.serverFiles !== undefined && !relativePath(mode.serverFiles)) errors.push(`${where}: serverFiles must be a fixture-relative directory`);
    if (mode?.mcpServers === undefined) continue;
    if (!mode.mcpServers || typeof mode.mcpServers !== 'object' || Array.isArray(mode.mcpServers)) {
      errors.push(`${where}: mcpServers must be an object`);
      continue;
    }
    for (const [server, spec] of Object.entries(mode.mcpServers)) {
      const swhere = `${where}.mcpServers.${server}`;
      if (!/^[A-Za-z0-9_-]+$/.test(server)) errors.push(`${swhere}: name must match [A-Za-z0-9_-]+`);
      if (spec?.url !== undefined || (spec?.type !== undefined && spec.type !== 'stdio')) errors.push(`${swhere}: only local stdio servers are allowed (no url, type http or sse)`);
      if (typeof spec?.command !== 'string' || !spec.command.trim()) errors.push(`${swhere}: command is required`);
      if (spec?.args !== undefined && !(Array.isArray(spec.args) && spec.args.every((arg) => typeof arg === 'string'))) errors.push(`${swhere}: args must be a string array`);
      if (spec?.env !== undefined && !(spec.env && typeof spec.env === 'object' && Object.values(spec.env).every((value) => typeof value === 'string'))) errors.push(`${swhere}: env must map names to strings`);
    }
  }
  return errors;
}

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
  errors.push(...modeErrors(taskSet));
  const ids = new Set();
  for (const [index, task] of (taskSet.tasks ?? []).entries()) {
    const where = `tasks[${index}]${task?.id ? ` (${task.id})` : ''}`;
    if (typeof task?.id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(task.id)) errors.push(`${where}: id must match [A-Za-z0-9._-]+`);
    else if (ids.has(task.id)) errors.push(`${where}: duplicate id`);
    else ids.add(task.id);
    if (typeof task?.prompt !== 'string' || !task.prompt.trim()) errors.push(`${where}: prompt is required`);
    if (!(task?.category in categories)) errors.push(`${where}: unknown category ${task?.category}`);
    if (task?.promptPrefix !== undefined && !(task.promptPrefix && typeof task.promptPrefix === 'object' && !Array.isArray(task.promptPrefix)
      && Object.entries(task.promptPrefix).every(([arm, prefix]) => ['A', 'B'].includes(arm) && typeof prefix === 'string'))) {
      errors.push(`${where}: promptPrefix must map A and/or B to a string`);
    }
    for (const key of ['expectsPolicies', 'expectsComponents']) {
      if (task?.[key] !== undefined && !(Array.isArray(task[key]) && task[key].every((p) => typeof p === 'string'))) errors.push(`${where}: ${key} must be a string array`);
    }
    if (task?.expectsPolicies !== undefined && task?.expectsComponents !== undefined) errors.push(`${where}: use expectsComponents or its alias expectsPolicies, not both`);
    if (task?.files !== undefined && !relativeMap(task.files)) errors.push(`${where}: files must map fixture-relative paths to app-relative paths`);
    for (const [mode, entry] of Object.entries(task?.modes ?? {})) {
      if (!taskSet.modes?.[mode]) errors.push(`${where}: mode ${mode} is not one of the task set's modes`);
      if (entry?.prompt !== undefined && (typeof entry.prompt !== 'string' || !entry.prompt.trim())) errors.push(`${where}: modes.${mode}.prompt must be a non-empty string`);
      if (entry?.files !== undefined && !relativeMap(entry.files)) errors.push(`${where}: modes.${mode}.files must map fixture-relative paths to app-relative paths`);
    }
    const checkIds = new Set();
    for (const [checkIndex, check] of (task?.checks ?? []).entries()) {
      const cwhere = `${where}.checks[${checkIndex}]`;
      if (typeof check?.id !== 'string' || checkIds.has(check.id)) errors.push(`${cwhere}: id must be a unique string`);
      checkIds.add(check?.id);
      if (!CHECK_TYPES.has(check?.type)) errors.push(`${cwhere}: type must be pattern, changed or command`);
      if (check?.level !== undefined && !['required', 'info'].includes(check.level)) errors.push(`${cwhere}: level must be required or info`);
      if (check?.weight !== undefined && !(typeof check.weight === 'number' && Number.isFinite(check.weight) && check.weight > 0)) errors.push(`${cwhere}: weight must be a positive number`);
      if (check?.type === 'pattern') {
        if (!['added', 'final'].includes(check.in)) errors.push(`${cwhere}: in must be added or final`);
        if (!['present', 'absent'].includes(check.expect)) errors.push(`${cwhere}: expect must be present or absent`);
        if (check.in === 'final' && !(Array.isArray(check.files) && check.files.length)) errors.push(`${cwhere}: final checks need files`);
        if (typeof check.pattern !== 'string') errors.push(`${cwhere}: pattern is required`);
        else regexOk(check.pattern, cwhere);
      }
      if (check?.type === 'command') {
        if (typeof check.run !== 'string' || !check.run.trim()) errors.push(`${cwhere}: run is required`);
        if (check.expect !== undefined && !['pass', 'fail'].includes(check.expect)) errors.push(`${cwhere}: expect must be pass or fail`);
        if (check.reporter !== undefined && !['vitest-json', 'json-score'].includes(check.reporter)) errors.push(`${cwhere}: reporter must be vitest-json or json-score`);
        if (check.passAt !== undefined && (check.reporter !== 'json-score' || typeof check.passAt !== 'number' || check.passAt < 0 || check.passAt > 1)) errors.push(`${cwhere}: passAt must be a number in 0..1 on a json-score check`);
        if (check.browserTools !== undefined && typeof check.browserTools !== 'boolean') errors.push(`${cwhere}: browserTools must be true or false`);
        if (check.copy !== undefined && !relativeMap(check.copy)) {
          errors.push(`${cwhere}: copy must map fixture-relative paths to app-relative paths`);
        }
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
