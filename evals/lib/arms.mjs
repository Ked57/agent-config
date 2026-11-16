// Builds isolated agent-config installs ("arms") from git refs with optional policy/skill/plugin toggles,
// and per-run copies of an arm's template home.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TELEMETRY_OFF } from './env.mjs';
import { skillName } from './isolation.mjs';

export const WORKTREE = 'WORKTREE';
/** An arm with an empty home: Claude Code with nothing installed. */
export const BARE = 'BARE';

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
  fs.rmSync(target, { recursive: true, force: true });
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
  const shallow = ['.claude/plugins', '.claude/plugins/marketplaces', '.claude/plugins/cache', '.cursor', '.cursor/plugins', '.cursor/plugins/local', '.cursor/skills', '.codex/plugins', '.codex/skills'];
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
    if (install?.installPath) plugins[id.split('@')[0]] = { id, version: install.version ?? null, installPath: install.installPath };
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
 * Copies an arm's template home to a run's home (`cp -a`, so modes and symlinks survive) and rewrites
 * the template's absolute path to the run home's in `files` (from `filesNamingHome`), so CLAUDE.md
 * imports and plugin install paths point into the run's own copy.
 */
export function prepareRunHome({ template, home, files = [] }) {
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(home), { recursive: true });
  const copy = spawnSync('cp', ['-a', template, home], { encoding: 'utf8' });
  if (copy.status !== 0) throw new Error(`copying the arm home failed: ${copy.stderr}`);
  for (const relative of files) {
    const file = path.join(home, relative);
    if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split(template).join(home));
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
        for (const root of ['.claude/skills', '.agents/skills', '.cursor/skills']) fs.rmSync(path.join(home, root, name), { recursive: true, force: true });
        removed.skills.push(name);
      }
    } else if (entry.kind === 'cursor-local') {
      fs.rmSync(path.join(home, '.cursor', 'plugins', 'local', entry.directory), { recursive: true, force: true });
    } else {
      // Codex plugins are not read by Claude Code runs; the Codex provider will need this.
      removed.skipped.push(`${entry.harness} ${entry.kind}`);
    }
  }
  return removed;
}

/**
 * Builds one arm into `armDir` (src/ + home/) and returns its metadata. `BARE` leaves the home empty.
 * Otherwise the ref's own installer runs with HOME, CLAUDE_CONFIG_DIR and CODEX_HOME inside the home,
 * so its `claude plugin`, `npx skills` and `git` calls install there; `plugins: 'skip'` sets
 * AGENT_CONFIG_EXTERNAL_PLUGINS=skip. `plugin:<id>` removals run after the install.
 */
export async function buildArm({ repoRoot, spec, armDir, plugins = 'install', npmCache = null }) {
  const src = path.join(armDir, 'src');
  const home = path.join(armDir, 'home');
  if (path.resolve(home) === path.resolve(os.homedir())) throw new Error('Refusing to install an arm into the real home directory');
  fs.rmSync(armDir, { recursive: true, force: true });
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
    fs.rmSync(target, { recursive: true, force: true });
  }
  // The installer never reads evals/, and the agent can reach this directory by relative path from
  // its working copy: a ref that carries the suite would hand it the hidden tests and the checks.
  fs.rmSync(path.join(src, 'evals'), { recursive: true, force: true });
  const before = liveConfigSnapshot();
  const install = spawnSync(process.execPath, [path.join(src, 'bin', 'agent-config.mjs'), 'sync', '--user'], { cwd: src, encoding: 'utf8', env, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (install.status !== 0) throw new Error(`agent-config sync failed for ${spec.ref}: ${install.stderr || install.stdout || install.error}`);
  for (const removal of spec.remove.filter((item) => item.startsWith('plugin:'))) {
    meta.removedPlugins.push(await removePlugin({ src, home, env, id: removal.slice('plugin:'.length) }));
  }
  const after = liveConfigSnapshot();
  const changed = Object.keys({ ...before, ...after }).filter((key) => before[key] !== after[key]);
  if (changed.length) throw new Error(`Live agent config changed during an arm build (${changed.slice(0, 5).join(', ')}); aborting`);
  fs.writeFileSync(path.join(armDir, 'install.log'), `${install.stdout}\n${install.stderr}`);
  const list = spawnSync('claude', ['plugin', 'list', '--json'], { cwd: home, env, encoding: 'utf8', timeout: 120000 });
  let pluginList = [];
  try {
    pluginList = JSON.parse(list.stdout.slice(Math.max(0, list.stdout.search(/[[{]/)))).map((plugin) => ({ id: plugin.id, version: plugin.version ?? null, enabled: plugin.enabled ?? null }));
  } catch {
    throw new Error(`claude plugin list --json failed in arm ${spec.ref}: ${(list.stderr || list.stdout).slice(0, 300)}`);
  }
  return { ...meta, pluginList, homePathFiles: filesNamingHome(home), ...inventory(home) };
}
