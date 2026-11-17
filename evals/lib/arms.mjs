// Builds isolated agent-config installs ("arms") from git refs with optional policy/skill/plugin toggles,
// and per-run copies of an arm's template home.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { removeTree, TELEMETRY_OFF } from './env.mjs';
import { changedArmFiles } from './plan.mjs';
import { skillName } from './isolation.mjs';

export const WORKTREE = 'WORKTREE';
/** An arm with an empty home: Claude Code with nothing installed. */
export const BARE = 'BARE';
/** Written into an arm dir once its build finished: an arm dir without it is incomplete. */
export const BUILT_MARKER = '.eval-built';

/** Whether an arm's build in `armDir` is complete and its home is still there. */
export const armBuilt = (armDir, home) => fs.existsSync(path.join(armDir, BUILT_MARKER)) && fs.existsSync(home);

const pluginKey = (plugin) => `${plugin.id}@${plugin.version ?? '?'}#${plugin.gitCommitSha ?? '?'}`;

/**
 * How a rebuilt arm differs from the one an eval was started with: changed plugin versions or commits
 * (`plugins`, as "id: old → new") and other installed files (`files`, plugin files excluded).
 */
export function armDrift(saved, rebuilt) {
  const before = Object.fromEntries((saved.plugins ?? []).map((plugin) => [plugin.id, pluginKey(plugin)]));
  const after = Object.fromEntries((rebuilt.plugins ?? []).map((plugin) => [plugin.id, pluginKey(plugin)]));
  const plugins = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    .filter((id) => before[id] !== after[id]).map((id) => `${id}: ${before[id] ?? 'absent'} → ${after[id] ?? 'absent'}`);
  const files = changedArmFiles(saved.hashes, rebuilt.hashes).filter((file) => !file.startsWith('.claude/plugins/'));
  return { plugins, files };
}

/**
 * What to do with an arm rebuilt after its sandbox build went missing: `continue` when it matches the
 * saved one, `accepted` when it drifted and `acceptDrift` is set, else `error`. `text` explains.
 */
export function rebuildDecision(arm, saved, rebuilt, acceptDrift = false) {
  const drift = armDrift(saved, rebuilt);
  const details = [...drift.plugins, ...(drift.files.length ? [`${drift.files.length} installed file(s) changed (${drift.files.slice(0, 5).join(', ')})`] : [])];
  if (!details.length) return { action: 'continue', drift, text: `Arm ${arm} rebuilt after its sandbox build went missing: identical installed files and plugin versions` };
  const text = `Arm ${arm} rebuilt after its sandbox build went missing and differs from the original build: ${details.join('; ')}`;
  return { action: acceptDrift ? 'accepted' : 'error', drift, text };
}

const git = (repoRoot, args, options = {}) => {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: options.encoding ?? 'utf8', maxBuffer: 256 * 1024 * 1024, input: options.input });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr).trim()}`);
  return result.stdout;
};
const tryRevParse = (repoRoot, ref) => {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
};
const extractTree = (repoRoot, sha, destination, paths = []) => {
  fs.mkdirSync(destination, { recursive: true });
  const archive = spawnSync('git', ['archive', '--format=tar', sha, ...(paths.length ? ['--', ...paths] : [])], { cwd: repoRoot, maxBuffer: 512 * 1024 * 1024 });
  if (archive.status !== 0) throw new Error(`git archive ${sha} ${paths.join(' ')} failed: ${archive.stderr}`);
  const untar = spawnSync('tar', ['-x', '-C', destination], { input: archive.stdout });
  if (untar.status !== 0) throw new Error(`tar failed: ${untar.stderr}`);
};
const copyWorkingTree = (repoRoot, destination) => {
  const files = git(repoRoot, ['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean)
    .filter((file) => fs.existsSync(path.join(repoRoot, file)));
  for (const file of files) {
    const target = path.join(destination, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, file), target);
  }
};

/** Resolves a toggle source to a function that materialises the content at `targetPath` under `src`. */
function applyAdd(repoRoot, src, toggle) {
  const target = path.join(src, toggle.path);
  removeTree(target, src);
  const fromRef = (ref, sourcePath) => {
    const sha = tryRevParse(repoRoot, ref);
    if (!sha) throw new Error(`Unknown ref in toggle: ${ref}`);
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-eval-toggle-'));
    try {
      extractTree(repoRoot, sha, temporary, [sourcePath]);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(path.join(temporary, sourcePath), target, { recursive: true });
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
    return `${ref}:${sourcePath}`;
  };
  if (!toggle.source) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(repoRoot, toggle.path), target, { recursive: true });
    return `working tree:${toggle.path}`;
  }
  const refPath = /^([^:]+):(.+)$/.exec(toggle.source);
  if (refPath && tryRevParse(repoRoot, refPath[1])) return fromRef(refPath[1], refPath[2]);
  if (tryRevParse(repoRoot, toggle.source)) return fromRef(toggle.source, toggle.path);
  const local = path.resolve(toggle.source);
  if (fs.existsSync(local)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(local, target, { recursive: true });
    return local;
  }
  throw new Error(`Toggle source not found as ref, ref:path or file: ${toggle.source}`);
}

/**
 * Paths in the user's real home whose state must be identical before and after an arm build.
 * `deep` paths are walked to the bottom (symlinks not followed): a directory's own mtime does not
 * move when a file inside it is rewritten in place. `shallow` paths (plugin stores, which hold large
 * caches) record only their direct entries' size and mtime, which is enough to see an install or a
 * marketplace being added.
 */
export function liveConfigSnapshot(home = os.homedir()) {
  const deep = ['.claude/CLAUDE.md', '.claude/settings.json', '.claude/skills', '.claude/agents', '.claude/plugins/installed_plugins.json', '.claude/plugins/known_marketplaces.json', '.agents', '.codex/AGENTS.md', '.codex/config.toml', '.agent-config', '.cursor/agents'];
  const shallow = ['.claude/plugins', '.claude/plugins/marketplaces', '.claude/plugins/cache', '.cursor/plugins', '.cursor/plugins/local', '.cursor/skills', '.codex/plugins', '.codex/skills'];
  const snapshot = {};
  const stamp = (stat) => (stat.isDirectory() ? `dir:${stat.mtimeMs}` : `${stat.size}:${stat.mtimeMs}`);
  const visit = (file, relative, recurse) => {
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return;
    if (!stat.isDirectory()) {
      snapshot[relative] = stamp(stat);
      return;
    }
    snapshot[`${relative}/`] = recurse ? '' : stamp(stat);
    for (const entry of fs.readdirSync(file).sort()) {
      if (recurse) visit(path.join(file, entry), `${relative}/${entry}`, true);
      else {
        const child = fs.lstatSync(path.join(file, entry), { throwIfNoEntry: false });
        if (child) snapshot[`${relative}/${entry}`] = stamp(child);
      }
    }
  };
  for (const relative of deep) visit(path.join(home, relative), relative, true);
  for (const relative of shallow) visit(path.join(home, relative), relative, false);
  return snapshot;
}

/** Plugins recorded in a home's `installed_plugins.json`, keyed by plugin name. */
export function installedPlugins(home) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  if (!fs.existsSync(file)) return {};
  const plugins = {};
  for (const [id, installs] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')).plugins ?? {})) {
    const install = [installs].flat().find((entry) => entry?.scope === 'user') ?? [installs].flat()[0];
    if (install?.installPath) plugins[id.split('@')[0]] = { id, version: install.version ?? null, gitCommitSha: install.gitCommitSha ?? null, installPath: install.installPath };
  }
  return plugins;
}

const listFiles = (directory) => {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      // A plugin's own node_modules and git metadata are not agent config.
      if (entry.isDirectory() && ['node_modules', '.git'].includes(entry.name)) continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  if (fs.existsSync(directory)) visit(directory);
  return files;
};

/**
 * Content hashes of the installed agent config, with the arm's home path normalised to `~`: policies,
 * skills, CLAUDE.md, settings, agents, commands, and the installed copy of every Claude Code plugin.
 * `plugins` lists each plugin with its version and the skills and agents it ships.
 */
export function inventory(home) {
  const hashes = {};
  const installed = installedPlugins(home);
  const roots = ['.agents', '.claude/skills', '.claude/CLAUDE.md', '.claude/settings.json', '.claude/agents', '.claude/commands', ...Object.values(installed).map((plugin) => path.relative(home, plugin.installPath))];
  for (const root of roots) {
    const start = path.join(home, root);
    if (root.startsWith('..') || !fs.existsSync(start)) continue;
    const files = fs.statSync(start).isFile() ? [start] : listFiles(start);
    for (const file of files) {
      const relative = path.relative(home, file).split(path.sep).join('/');
      // The skills CLI's lock records install times: bookkeeping, not config, and never the same twice.
      if (relative === '.agents/.skill-lock.json') continue;
      const content = fs.readFileSync(file, 'utf8').replaceAll(home, '~');
      hashes[relative] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  const policies = Object.keys(hashes).map((file) => /^\.agents\/policy\/([^/]+)\.md$/.exec(file)?.[1]).filter(Boolean).sort();
  const skills = [...new Set(Object.keys(hashes).map((file) => /^\.claude\/skills\/([^/]+)\//.exec(file)?.[1]).filter(Boolean))].sort();
  const plugins = Object.entries(installed).map(([name, plugin]) => {
    const prefix = `${path.relative(home, plugin.installPath).split(path.sep).join('/')}/`;
    const own = Object.keys(hashes).filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length));
    return {
      id: plugin.id,
      name,
      version: plugin.version,
      gitCommitSha: plugin.gitCommitSha,
      skills: [...new Set(own.filter((file) => /(?:^|\/)skills\/[^/]+\/SKILL\.md$/.test(file)).map((file) => skillName(fs.readFileSync(path.join(plugin.installPath, file), 'utf8'), path.dirname(file))))].sort(),
      agents: [...new Set(own.map((file) => /(?:^|\/)agents\/([^/]+)\.md$/.exec(file)?.[1]).filter(Boolean))].sort()
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { hashes, policies, skills, plugins };
}

/**
 * Policies, skills and plugins whose installed files differ between two inventories (routing excluded:
 * always read). A changed plugin is watched as `plugin:<name>`.
 */
export function compareInventories(a, b) {
  const files = [...new Set([...Object.keys(a.hashes), ...Object.keys(b.hashes)])].sort();
  const changedFiles = files.filter((file) => a.hashes[file] !== b.hashes[file]);
  const watched = new Set();
  for (const file of changedFiles) {
    const policy = /^\.agents\/policy\/([^/]+)\.md$/.exec(file)?.[1];
    const skill = /^\.(?:agents|claude)\/skills\/([^/]+)\//.exec(file)?.[1];
    const plugin = /^\.claude\/plugins\/cache\/[^/]+\/([^/]+)\//.exec(file)?.[1];
    if (policy && policy !== 'routing') watched.add(policy);
    if (skill) watched.add(skill);
    if (plugin) watched.add(`plugin:${plugin}`);
  }
  return { identical: changedFiles.length === 0, changedFiles, watched: [...watched].sort() };
}

/** Text files under `home` that contain its absolute path (the installer writes it into imports and plugin indexes). */
export function filesNamingHome(home) {
  const result = spawnSync('grep', ['-rlIF', '--exclude-dir=.git', '--exclude-dir=node_modules', '-e', home, home], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status > 1) throw new Error(`grep for the home path failed: ${result.stderr}`);
  return result.stdout.split('\n').filter(Boolean).map((file) => path.relative(home, file).split(path.sep).join('/')).sort();
}

/**
 * What a Claude Code run reads from its home. The Codex and Cursor copies (`.codex/plugins`,
 * `.cursor/skills`, about 360 MB) and the installers' caches stay in the template; the local Cursor
 * pstack copy comes along because poteto-agent searches `~/.cursor/plugins/` when its parent gives no
 * SKILL.md path.
 */
export const RUN_HOME_PATHS = ['.claude', '.agents', '.agent-config', '.cursor/plugins/local'];

/**
 * Copies the Claude-relevant part of an arm's template home (`RUN_HOME_PATHS`) to a run's home
 * (`cp -a`, so modes and symlinks survive) and rewrites the template's absolute path to the run
 * home's in `files` (from `filesNamingHome`), so CLAUDE.md imports and plugin install paths point
 * into the run's own copy. `from` is the path string the template's files embed, when it is not
 * `template` itself (a cached arm home keeps the path of the sandbox home it was built in).
 */
export function prepareRunHome({ template, home, files = [], from = template }) {
  removeTree(home, path.dirname(home));
  fs.mkdirSync(home, { recursive: true });
  for (const relative of RUN_HOME_PATHS) {
    const source = path.join(template, relative);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(path.dirname(path.join(home, relative)), { recursive: true });
    const copy = spawnSync('cp', ['-a', source, path.join(home, relative)], { encoding: 'utf8' });
    if (copy.status !== 0) throw new Error(`copying the arm home failed: ${copy.stderr}`);
  }
  for (const relative of files) {
    const file = path.join(home, relative);
    if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split(from).join(home));
  }
}

/**
 * Removes one external plugin (`plugin:<id>`) from an installed arm home, using the ref's own
 * `bin/external-plugins.mjs` to learn what the installer put where. Returns what was removed: Claude
 * plugin names (uninstalled with `claude plugin uninstall`) and skill directory names.
 */
async function removePlugin({ src, home, env, id }) {
  const file = path.join(src, 'bin', 'external-plugins.mjs');
  if (!fs.existsSync(file)) throw new Error(`--remove plugin:${id}: this ref has no bin/external-plugins.mjs`);
  const { externalPlugins = [] } = await import(pathToFileURL(file).href);
  const entries = externalPlugins.filter((entry) => entry.id === id);
  if (!entries.length) throw new Error(`--remove plugin:${id}: not in this ref's external plugins (${[...new Set(externalPlugins.map((entry) => entry.id))].join(', ')})`);
  const removed = { id, plugins: [], skills: [], skipped: [] };
  for (const entry of entries) {
    if (entry.kind === 'plugin' && entry.bin === 'claude') {
      const result = spawnSync('claude', ['plugin', 'uninstall', entry.plugin, '--scope', 'user'], { cwd: home, env, encoding: 'utf8', timeout: 120000 });
      if (result.status !== 0) throw new Error(`claude plugin uninstall ${entry.plugin} failed: ${result.stderr || result.stdout}`);
      removed.plugins.push(entry.plugin.split('@')[0]);
    } else if (entry.kind === 'skills') {
      for (const name of entry.skills) {
        // A skill this repository installs itself is not the plugin's to remove.
        if (fs.existsSync(path.join(src, 'skills', name))) continue;
        for (const root of ['.claude/skills', '.agents/skills', '.cursor/skills']) removeTree(path.join(home, root, name), path.join(home, root));
        removed.skills.push(name);
      }
    } else if (entry.kind === 'cursor-local') {
      removeTree(path.join(home, '.cursor', 'plugins', 'local', entry.directory), path.join(home, '.cursor', 'plugins', 'local'));
    } else {
      // Codex plugins are not read by Claude Code runs; the Codex provider will need this.
      removed.skipped.push(`${entry.harness} ${entry.kind}`);
    }
  }
  return removed;
}

/**
 * Bump when the arm build changes in a way the cache key cannot see (what the build does, what it
 * records): every cached arm template is then rebuilt.
 */
export const ARM_BUILD_VERSION = 1;
/** Waits before each retry of an arm install that failed on the network (GitHub 429s, DNS, clone timeouts). */
export const BUILD_RETRY_WAITS_S = [60, 180, 300];

/** Whether an arm install failed on the network or a rate limit rather than on the ref itself. */
export const isNetworkFailure = (text) => /\b429\b|too many requests|rate[ _-]?limit|could not resolve host|timed out|ETIMEDOUT/i.test(String(text ?? ''));

/** Content digest of an extracted ref: every file's relative path and bytes (node_modules and .git skipped). */
export function treeDigest(directory) {
  const hash = crypto.createHash('sha256');
  for (const file of listFiles(directory).map((full) => path.relative(directory, full).split(path.sep).join('/')).sort()) {
    hash.update(`${file}\0`).update(fs.readFileSync(path.join(directory, file))).update('\0');
  }
  return hash.digest('hex');
}

/**
 * The arm cache key: everything that determines a build. `srcDigest` is the extracted tree after the
 * toggles were applied, so it covers a WORKTREE checkout and the resolved content of every add and
 * removal; `sha`, `add` (with what each resolved to) and `remove` name them too.
 */
export function armCacheKey({ sha = null, srcDigest, add = [], remove = [], pluginMode, version = ARM_BUILD_VERSION }) {
  const inputs = {
    version,
    sha,
    srcDigest,
    add: add.map((toggle) => ({ path: toggle.path, source: toggle.source ?? null, resolved: toggle.resolved ?? null })),
    remove: [...remove].sort(),
    removedPlugins: remove.filter((item) => item.startsWith('plugin:')).sort(),
    pluginMode
  };
  return crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex').slice(0, 32);
}

/**
 * Whether to reuse a cached arm: `reuse` when an entry exists, is younger than `maxAgeHours` and no
 * rebuild was asked for; `off` when `maxAgeHours` is 0 (no read, no write); else `build`. `fallback` is
 * the existing entry, used only if a fresh build fails on the network.
 */
export function cacheDecision({ entry, nowMs, maxAgeHours, rebuild = false }) {
  if (!maxAgeHours) return { action: 'off', fallback: null, ageHours: null };
  const ageHours = entry ? (nowMs - Date.parse(entry.builtAt)) / 3600000 : null;
  const fresh = entry && Number.isFinite(ageHours) && ageHours >= 0 && ageHours < maxAgeHours;
  return { action: fresh && !rebuild ? 'reuse' : 'build', fallback: entry ?? null, ageHours };
}

/** A cache entry (`entry.json` with its `home/`), or null. */
export function readCacheEntry(cacheDir) {
  try {
    const entry = JSON.parse(fs.readFileSync(path.join(cacheDir, 'entry.json'), 'utf8'));
    return fs.existsSync(path.join(cacheDir, 'home')) ? entry : null;
  } catch {
    return null;
  }
}

/**
 * Stores a built arm's template home (the `RUN_HOME_PATHS` part, which is all a run or probe reads) with
 * its metadata and the home path its files embed. Written beside the entry, then renamed into place.
 */
export function storeArmCache({ cacheRoot, key, built }) {
  const cacheDir = path.join(cacheRoot, key);
  const staging = path.join(cacheRoot, `${key}.tmp-${process.pid}`);
  fs.mkdirSync(cacheRoot, { recursive: true });
  removeTree(staging, cacheRoot);
  prepareRunHome({ template: built.home, home: path.join(staging, 'home'), files: [] });
  const builtAt = new Date().toISOString();
  fs.writeFileSync(path.join(staging, 'entry.json'), `${JSON.stringify({ key, builtAt, homePath: built.home, built }, null, 2)}\n`);
  removeTree(cacheDir, cacheRoot);
  fs.renameSync(staging, cacheDir);
  return builtAt;
}

/**
 * Copies a cached template home to `home`, rewriting the cached home path in the files that name it,
 * and checks the copy's file digests against the cached inventory. Returns the arm metadata for `home`,
 * or throws when the copy does not match.
 */
export function restoreArmCache({ cacheDir, entry, home }) {
  prepareRunHome({ template: path.join(cacheDir, 'home'), home, files: entry.built.homePathFiles ?? [], from: entry.homePath });
  const changed = changedArmFiles(entry.built.hashes, inventory(home).hashes);
  if (changed.length) throw new Error(`cached arm ${entry.key} does not match its inventory (${changed.slice(0, 5).join(', ')})`);
  return { ...entry.built, home };
}

/**
 * Runs the ref's installer into a fresh `home` (and the `plugin:<id>` removals), checking that the live
 * config is untouched. Returns the plugin list and the removed plugins.
 */
async function installArm({ src, home, armDir, env, spec }) {
  removeTree(home, armDir);
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(env.TMPDIR, { recursive: true });
  const before = liveConfigSnapshot();
  const install = spawnSync(process.execPath, [path.join(src, 'bin', 'agent-config.mjs'), 'sync', '--user'], { cwd: src, encoding: 'utf8', env, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (install.status !== 0) throw new Error(`agent-config sync failed for ${spec.ref}: ${install.stderr || install.stdout || ''}${install.error ? ` (${install.error.message})` : ''}`);
  const removedPlugins = [];
  for (const removal of spec.remove.filter((item) => item.startsWith('plugin:'))) {
    removedPlugins.push(await removePlugin({ src, home, env, id: removal.slice('plugin:'.length) }));
  }
  const after = liveConfigSnapshot();
  const changed = Object.keys({ ...before, ...after }).filter((key) => before[key] !== after[key]);
  if (changed.length) throw new Error(`Live agent config changed during an arm build (${changed.slice(0, 5).join(', ')}); aborting`);
  fs.writeFileSync(path.join(armDir, 'install.log'), `${install.stdout}\n${install.stderr}`);
  const list = spawnSync('claude', ['plugin', 'list', '--json'], { cwd: home, env, encoding: 'utf8', timeout: 120000 });
  try {
    const pluginList = JSON.parse(list.stdout.slice(Math.max(0, list.stdout.search(/[[{]/)))).map((plugin) => ({ id: plugin.id, version: plugin.version ?? null, enabled: plugin.enabled ?? null }));
    return { pluginList, removedPlugins };
  } catch {
    throw new Error(`claude plugin list --json failed in arm ${spec.ref}: ${(list.stderr || list.stdout).slice(0, 300)}`);
  }
}

/**
 * Builds one arm into `armDir` (src/ + home/) and returns its metadata. `BARE` leaves the home empty.
 * Otherwise the ref's own installer runs with HOME, CLAUDE_CONFIG_DIR and CODEX_HOME inside the home,
 * so its `claude plugin`, `npx skills` and `git` calls install there; `plugins: 'skip'` sets
 * AGENT_CONFIG_EXTERNAL_PLUGINS=skip. `plugin:<id>` removals run after the install.
 *
 * `cache` (`{ root, maxAgeHours, rebuild }`) reuses a template home built from the same inputs (see
 * `armCacheKey`, `cacheDecision`) instead of installing, and stores fresh builds. An install that fails
 * on the network is retried after `BUILD_RETRY_WAITS_S`; after the last, an expired entry is used.
 * The result's `cache` says what happened: `reused`, `stored`, `expired-fallback` or `off`.
 */
export async function buildArm({ repoRoot, spec, armDir, plugins = 'install', npmCache = null, cache = null, log = () => {}, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const src = path.join(armDir, 'src');
  const home = path.join(armDir, 'home');
  if (path.resolve(home) === path.resolve(os.homedir())) throw new Error('Refusing to install an arm into the real home directory');
  removeTree(armDir, path.dirname(armDir));
  fs.mkdirSync(home, { recursive: true });
  const env = {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? 'C.UTF-8',
    HOME: home,
    USERPROFILE: home,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    CODEX_HOME: path.join(home, '.codex'),
    TMPDIR: path.join(armDir, 'tmp'),
    GIT_TERMINAL_PROMPT: '0',
    ...(npmCache ? { npm_config_cache: npmCache } : {}),
    ...(plugins === 'skip' ? { AGENT_CONFIG_EXTERNAL_PLUGINS: 'skip' } : {}),
    ...TELEMETRY_OFF
  };
  fs.mkdirSync(env.TMPDIR, { recursive: true });
  const meta = { ref: spec.ref, sha: null, add: [], remove: spec.remove, pluginMode: spec.ref === BARE ? 'none' : plugins, removedPlugins: [], home };
  if (spec.ref === BARE) {
    if (spec.add.length || spec.remove.length) throw new Error('BARE arms take no toggles');
    fs.writeFileSync(path.join(armDir, BUILT_MARKER), new Date().toISOString());
    return { ...meta, pluginList: [], homePathFiles: [], ...inventory(home) };
  }
  if (spec.ref === WORKTREE) copyWorkingTree(repoRoot, src);
  else {
    meta.sha = tryRevParse(repoRoot, spec.ref);
    if (!meta.sha) throw new Error(`Unknown ref: ${spec.ref}`);
    extractTree(repoRoot, meta.sha, src);
  }
  meta.add = spec.add.map((toggle) => ({ ...toggle, resolved: applyAdd(repoRoot, src, toggle) }));
  for (const removal of spec.remove.filter((item) => !item.startsWith('plugin:'))) {
    const target = path.join(src, removal);
    if (!fs.existsSync(target)) throw new Error(`--remove target does not exist in ${spec.ref}: ${removal}`);
    removeTree(target, src);
  }
  // The installer never reads evals/, and the agent can reach this directory by relative path from
  // its working copy: a ref that carries the suite would hand it the hidden tests and the checks.
  removeTree(path.join(src, 'evals'), src);

  const key = cache ? armCacheKey({ sha: meta.sha, srcDigest: treeDigest(src), add: meta.add, remove: spec.remove, pluginMode: plugins }) : null;
  const cacheDir = key ? path.join(cache.root, key) : null;
  const decision = cacheDecision({ entry: cacheDir ? readCacheEntry(cacheDir) : null, nowMs: Date.now(), maxAgeHours: cache?.maxAgeHours ?? 0, rebuild: cache?.rebuild });
  const finish = (built) => {
    fs.writeFileSync(path.join(armDir, BUILT_MARKER), new Date().toISOString());
    return built;
  };
  if (decision.action === 'reuse') {
    try {
      return finish({ ...restoreArmCache({ cacheDir, entry: decision.fallback, home }), cache: { status: 'reused', key, builtAt: decision.fallback.builtAt } });
    } catch (error) {
      log(`Arm ${spec.ref}: ${error.message}; building it fresh`);
    }
  }
  let installed;
  for (let attempt = 0; !installed; attempt += 1) {
    try {
      installed = await installArm({ src, home, armDir, env, spec });
    } catch (error) {
      if (!isNetworkFailure(error.message)) throw error;
      if (attempt < BUILD_RETRY_WAITS_S.length) {
        log(`Arm ${spec.ref}: install failed on the network (${error.message.split('\n')[0].slice(0, 200)}); retry ${attempt + 1}/${BUILD_RETRY_WAITS_S.length} in ${BUILD_RETRY_WAITS_S[attempt]} s`);
        await sleep(BUILD_RETRY_WAITS_S[attempt] * 1000);
        continue;
      }
      if (!decision.fallback) throw error;
      const built = restoreArmCache({ cacheDir, entry: decision.fallback, home });
      return finish({ ...built, cache: { status: 'expired-fallback', key, builtAt: decision.fallback.builtAt, error: error.message.slice(0, 300) } });
    }
  }
  const built = { ...meta, removedPlugins: installed.removedPlugins, pluginList: installed.pluginList, homePathFiles: filesNamingHome(home), ...inventory(home) };
  const builtAt = decision.action === 'off' ? null : storeArmCache({ cacheRoot: cache.root, key, built });
  return finish({ ...built, cache: decision.action === 'off' ? { status: 'off' } : { status: 'stored', key, builtAt } });
}
