// Arm result reuse: an `inputsKey` per run over everything that decides what the agent saw and how
// the run was measured, an index of finished runs in other result dirs, and the copy of a reused run
// into this eval. See "Reusing runs" in evals/README.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { armIdentity, installedDigest } from './combine.mjs';
import { promptFor, taskForMode } from './config.mjs';
import { removeTree } from './env.mjs';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** JSON with object keys sorted at every level (undefined members dropped), so equal values hash equally. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Hash of the files at `sources` (relative to `baseDir`; directories walked) by path and bytes. A missing source hashes as missing. */
export function contentHash(baseDir, sources) {
  const hash = crypto.createHash('sha256');
  const visit = (relative) => {
    const full = path.join(baseDir, relative);
    const stat = fs.statSync(full, { throwIfNoEntry: false });
    if (!stat) hash.update(`missing:${relative}\0`);
    else if (stat.isDirectory()) for (const entry of fs.readdirSync(full).sort()) visit(`${relative}/${entry}`);
    else {
      hash.update(`${relative}\0`);
      hash.update(fs.readFileSync(full));
      hash.update('\0');
    }
  };
  for (const source of [...new Set(sources)].sort()) visit(source);
  return hash.digest('hex').slice(0, 16);
}

/**
 * A task's part of the key: its checks (definition plus the contents of every file a check copies in,
 * i.e. the hidden tests) and its pre-run `files` (map plus contents, binary files included).
 */
export function taskInputs(task, fixtureDir) {
  const checks = task.checks ?? [];
  return {
    id: task.id,
    checks: sha256(canonicalJson(checks)).slice(0, 16),
    checkFiles: contentHash(fixtureDir, checks.flatMap((check) => Object.keys(check.copy ?? {}))),
    files: task.files ? `${sha256(canonicalJson(task.files)).slice(0, 16)}:${contentHash(fixtureDir, Object.keys(task.files))}` : null
  };
}

/**
 * The readable inputs of one run. The arm is identified by commit (or `BARE`/`WORKTREE`), toggles,
 * plugin mode, plugin versions and commits, and the installed-files digest (which also covers toggle
 * content and `WORKTREE` arms), never by its letter: arm B of one eval can be arm A of another. The
 * arm's input mode counts with its MCP server specs and the contents of its `serverFiles`; `task` is
 * the base task, resolved for that mode here.
 */
// Files an external plugin install writes (plugin caches, marketplaces, installed-plugin lists). Every
// other installed file (policies, repo skills, CLAUDE.md, AGENTS.md, settings) is repo-owned.
const PLUGIN_OWNED = /^\.(claude|cursor|codex)\/plugins\//;

/** The installed-files digest split into its repo-owned and plugin-owned parts. */
export function installedParts(hashes = {}) {
  const repo = {};
  const plugins = {};
  for (const [file, hash] of Object.entries(hashes)) (PLUGIN_OWNED.test(file) ? plugins : repo)[file] = hash;
  return { repo: installedDigest(repo), plugins: installedDigest(plugins) };
}

export function runInputs({ config, armsInfo, arm, task: baseTask, taskSet = {}, rep, runFixtureHash, fixtureDir, prompt }) {
  const identity = armIdentity(config, armsInfo, arm);
  const modeName = config.arms?.[arm]?.mode ?? null;
  const mode = modeName ? taskSet.modes?.[modeName] ?? {} : null;
  const task = taskForMode(baseTask, modeName);
  return {
    mode: mode ? { name: modeName, mcpServers: sha256(canonicalJson(mode.mcpServers ?? {})).slice(0, 16), serverFiles: mode.serverFiles ? contentHash(fixtureDir, [mode.serverFiles]) : null } : null,
    agent: { provider: config.provider, model: config.model, effort: config.effort, timeoutMin: config.timeoutMin, env: config.env ?? {} },
    arm: {
      ref: identity.ref === 'BARE' ? 'BARE' : identity.sha ?? 'WORKTREE',
      add: identity.add,
      remove: identity.remove,
      pluginMode: identity.pluginMode,
      plugins: identity.plugins,
      installed: identity.installed,
      prefix: task.promptPrefix?.[arm] ?? config.arms?.[arm]?.prefix ?? ''
    },
    task: { ...taskInputs(task, fixtureDir), prompt: prompt ?? promptFor(task, arm, config.arms?.[arm]) },
    // Only what a run observes of the fixture (see `runFixtureHash`), so editing another task's hidden test keeps keys.
    runFixtureHash,
    rep,
    measure: { http: Boolean(config.http), browser: Boolean(config.browser) },
    installedParts: installedParts(armsInfo?.[arm]?.hashes)
  };
}

/**
 * `installedParts` only splits `arm.installed`, which the key already covers; it stays out of the key
 * so new runs keep the keys of records made before it existed.
 */
export const inputsKey = (inputs) => sha256(canonicalJson({ ...inputs, installedParts: undefined }));

/** `id@version#commit` (see `armIdentity`) as `{ id, version, commit }`; the id itself holds an `@`. */
const parsePlugin = (entry) => {
  const [head, commit = null] = entry.split('#');
  const at = head.lastIndexOf('@');
  return { id: head.slice(0, at), version: head.slice(at + 1), commit };
};

/**
 * The key with external plugin versions, commits and the installed-files digest left out (the set of
 * plugin ids stays in): the match `--reuse-allow-plugin-drift` falls back to. `pluginDriftCheck` then
 * compares the repo-owned files.
 */
export const driftKey = (inputs) => inputsKey({ ...inputs, arm: { ...inputs.arm, plugins: (inputs.arm.plugins ?? []).map((entry) => parsePlugin(entry).id).sort(), installed: null } });

/** Plugins whose version or commit differs between two `arm.plugins` lists, as `{ id, from, to }`. */
export function pluginDrift(fromPlugins = [], toPlugins = []) {
  const to = Object.fromEntries(toPlugins.map(parsePlugin).map((plugin) => [plugin.id, plugin]));
  return fromPlugins.map(parsePlugin).filter((plugin) => to[plugin.id] && (plugin.version !== to[plugin.id].version || plugin.commit !== to[plugin.id].commit))
    .map((plugin) => ({ id: plugin.id, from: { version: plugin.version, commit: plugin.commit }, to: { version: to[plugin.id].version, commit: to[plugin.id].commit } }));
}

/**
 * The repo-owned files digest of the arm a source run was made with: stored in records made since the
 * split, else derived from `arms.json` of the eval that holds the record (or of its origin), from the
 * arm whose full digest equals the record's.
 */
export function sourceRepoDigest(entry, armsOf) {
  const { inputs } = entry.record;
  if (inputs.installedParts) return inputs.installedParts.repo;
  for (const dir of new Set([entry.dir, reuseOrigin(entry).dir])) {
    for (const info of Object.values(armsOf(dir) ?? {})) {
      if (info?.hashes && installedDigest(info.hashes) === inputs.arm.installed) return installedParts(info.hashes).repo;
    }
  }
  return null;
}

/**
 * Whether a source run that matches `inputs` by `driftKey` may stand in: some plugin's version or commit
 * drifted, none of the drifted plugins fired in the source run (a Skill call, slash command or subagent
 * of the plugin; no telemetry counts as fired), and the repo-owned installed files are identical.
 * Returns `{ drift }` or `{ reason }`.
 */
export function pluginDriftCheck({ inputs, entry, armsOf }) {
  const drift = pluginDrift(entry.record.inputs.arm.plugins, inputs.arm.plugins);
  if (!drift.length) return { reason: 'the installed files differ, but no plugin version or commit does' };
  const fired = drift.filter((plugin) => entry.record.telemetry?.plugins?.[plugin.id.split('@')[0]]?.fired !== false);
  if (fired.length) return { reason: `${fired.map((plugin) => plugin.id).join(', ')} fired in the source run (or it has no telemetry for it)` };
  const repo = sourceRepoDigest(entry, armsOf);
  if (!repo) return { reason: 'the source run\'s repo-owned files are unknown (no split digest, no matching arms.json)' };
  if (repo !== inputs.installedParts?.repo) return { reason: 'the repo-owned installed files differ' };
  return { drift };
}

/** Result dirs to search: `--reuse-from` dirs when given, else every dir under the evals home; combined dirs are skipped. */
export function reuseSourceDirs({ evalsHome, reuseFrom = [], exclude = null }) {
  const dirs = reuseFrom.length ? reuseFrom.map((dir) => path.resolve(dir))
    : (fs.existsSync(evalsHome) ? fs.readdirSync(evalsHome, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(evalsHome, entry.name)) : []);
  return dirs.filter((dir) => dir !== exclude && fs.existsSync(path.join(dir, 'results', 'runs')) && !readJsonOrNull(path.join(dir, 'config.json'))?.combined);
}

const readJsonOrNull = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** Every readable run record in the given result dirs, as `{ dir, runId, record, madeAt }`. */
export function scanRuns(dirs) {
  const found = [];
  for (const dir of dirs) {
    const runsDir = path.join(dir, 'results', 'runs');
    for (const file of fs.readdirSync(runsDir).filter((name) => name.endsWith('.json')).sort()) {
      const record = readJsonOrNull(path.join(runsDir, file));
      if (record?.id) found.push({ dir, runId: record.id, record, madeAt: fs.statSync(path.join(runsDir, file)).mtime.toISOString() });
    }
  }
  return found;
}

/**
 * Index of reusable runs by `inputsKey` (or by `keyOf(record)`, e.g. `driftKey` of its inputs): only
 * finished runs (`status: "ok"`) that carry a key.
 */
export function indexRuns(entries, keyOf = (record) => record.inputsKey) {
  const index = new Map();
  for (const entry of entries) {
    if (entry.record.status !== 'ok' || !entry.record.inputsKey) continue;
    const key = keyOf(entry.record);
    index.set(key, [...(index.get(key) ?? []), entry]);
  }
  return index;
}

/** Index by `driftKey` for `planReuse`'s `drift` option; records without stored inputs are left out. */
export const indexRunsByDriftKey = (entries) => indexRuns(entries.filter((entry) => entry.record.inputs?.arm), (record) => driftKey(record.inputs));

/** The run a reused copy ultimately came from, so a chain of reuses never counts one run twice. */
export const reuseOrigin = (entry) => entry.record.reusedFrom ?? { dir: entry.dir, runId: entry.runId, madeAt: entry.madeAt };
const originId = (origin) => `${origin.dir}\0${origin.runId}`;

/**
 * Splits pending jobs into those a finished run can stand in for and those to run. Rep n reuses rep n
 * only (the rep is in the key); no source run is used twice in one eval (an A/A eval has equal keys in
 * both arms), and `used` holds the origins of runs this eval already reused. With `drift`
 * (`{ inputsOf, index }`, the index by `driftKey`), a job without an exact match takes a run that passes
 * `pluginDriftCheck`; its entry carries `pluginDrift`.
 */
export function planReuse({ pending, keyOf, index, used = [], drift = null }) {
  const taken = new Set(used.map(originId));
  const free = (entry) => entry.record.status === 'ok' && !taken.has(originId(reuseOrigin(entry)));
  const armsByDir = new Map();
  const armsOf = (dir) => {
    if (!armsByDir.has(dir)) armsByDir.set(dir, readJsonOrNull(path.join(dir, 'arms.json')));
    return armsByDir.get(dir);
  };
  const reuse = [];
  const run = [];
  for (const job of pending) {
    const exact = (index.get(keyOf(job)) ?? []).find(free);
    let found = exact ? { source: exact } : null;
    if (!found && drift) {
      const inputs = drift.inputsOf(job);
      for (const entry of (drift.index.get(driftKey(inputs)) ?? []).filter(free)) {
        const check = pluginDriftCheck({ inputs, entry, armsOf });
        if (check.drift) {
          found = { source: entry, pluginDrift: check.drift };
          break;
        }
      }
    }
    if (!found) {
      run.push(job);
      continue;
    }
    taken.add(originId(reuseOrigin(found.source)));
    reuse.push({ job, ...found });
  }
  return { reuse, run };
}

/**
 * The record a reused run gets in this eval: the source's, under this eval's run id and arm letter. Its
 * `inputs` and `inputsKey` stay the source's; a plugin-drift reuse records the drift in `reusedFrom`.
 */
export function reusedRecord(source, job, at = new Date().toISOString(), pluginDrift = null) {
  const origin = reuseOrigin(source);
  return { ...source.record, id: job.id, task: job.task, arm: job.arm, rep: job.rep, reusedFrom: { dir: origin.dir, runId: origin.runId, madeAt: origin.madeAt ?? null, at: origin.at ?? at, ...(pluginDrift?.length ? { pluginDrift } : {}) } };
}

/** Copies a reused run's files (diff, transcript, session logs; never the worked `app/`) and writes its record. */
export function copyReusedRun({ source, job, outDir, at, pluginDrift = null }) {
  const record = reusedRecord(source, job, at, pluginDrift);
  const from = path.join(source.dir, 'runs', source.runId);
  const to = path.join(outDir, 'runs', job.id);
  removeTree(to, outDir);
  fs.mkdirSync(to, { recursive: true });
  if (fs.existsSync(from)) for (const entry of fs.readdirSync(from)) if (entry !== 'app') fs.cpSync(path.join(from, entry), path.join(to, entry), { recursive: true });
  return record;
}

/** Where a run's worked copy lives: its own `app/`, or the source run's for a reused run. */
export const runAppDir = (outDir, run) => (run.reusedFrom ? path.join(run.reusedFrom.dir, 'runs', run.reusedFrom.runId, 'app') : path.join(outDir, 'runs', run.id, 'app'));

/** Agent spend this eval made itself: reused runs keep their recorded cost but were paid for elsewhere. */
export const newRunsUsd = (runs) => runs.filter((run) => !run.reusedFrom).reduce((sum, run) => sum + (run.cost?.usd ?? 0), 0);

/**
 * Keys for the runs of an existing results dir, for evals made before keys existed. Only valid when
 * nothing a run observed changed: `storedRunFixtureHash` (the eval's `runFixtureHash`, resolved by the
 * caller for old dirs) must equal the current one, and each task's prompt, prefix, checks, files and the
 * set's modes must equal the current task set's. Check copies, task files and server files are hashed
 * from the current fixture by content, so a changed hidden test changes the key rather than passing
 * unnoticed. Returns updated records and refusals.
 */
export function backfillKeys({ config, armsInfo, taskSet, runs, currentTaskSet, fixtureDir, storedRunFixtureHash, currentRunFixtureHash }) {
  const updated = [];
  const refused = [];
  const currentById = Object.fromEntries(currentTaskSet.tasks.map((task) => [task.id, task]));
  const storedById = Object.fromEntries(taskSet.tasks.map((task) => [task.id, task]));
  const comparable = (task) => canonicalJson({ prompt: task.prompt, promptPrefix: task.promptPrefix ?? null, checks: task.checks ?? [], files: task.files ?? null, modes: task.modes ?? null });
  for (const run of runs) {
    const stored = storedById[run.task];
    const current = currentById[run.task];
    let reason = null;
    if (config.combined) reason = 'the dir was made by --combine; backfill its source dirs';
    else if (!storedRunFixtureHash) reason = 'no stored fixture (template) hash';
    else if (storedRunFixtureHash !== currentRunFixtureHash) reason = `fixture template hash ${storedRunFixtureHash} (stored) differs from ${currentRunFixtureHash} (current)`;
    else if (!stored) reason = `task ${run.task} is not in the stored task set`;
    else if (!current) reason = `task ${run.task} is not in the current task set ${currentTaskSet.name}`;
    else if (comparable(stored) !== comparable(current)) {
      const differs = ['prompt', 'promptPrefix', 'checks', 'files', 'modes'].filter((key) => canonicalJson(stored[key] ?? null) !== canonicalJson(current[key] ?? null));
      reason = `task ${run.task}: ${differs.join(', ')} differ from the current task set`;
    } else if (!armsInfo?.[run.arm]) reason = `arm ${run.arm} is missing from arms.json`;
    else if (canonicalJson(taskSet.modes ?? null) !== canonicalJson(currentTaskSet.modes ?? null)) reason = 'the task set\'s input modes differ from the current task set';
    if (reason) {
      refused.push({ id: run.id, reason });
      continue;
    }
    const inputs = runInputs({ config, armsInfo, arm: run.arm, task: stored, taskSet, rep: run.rep, runFixtureHash: currentRunFixtureHash, fixtureDir, prompt: run.prompt });
    updated.push({ ...run, inputs, inputsKey: inputsKey(inputs) });
  }
  return { updated, refused };
}
