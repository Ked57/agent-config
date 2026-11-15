// Builds isolated agent-config installs ("arms") from git refs with optional policy/skill toggles.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TELEMETRY_OFF } from './env.mjs';

export const WORKTREE = 'WORKTREE';

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
 * Directories are walked to the bottom (symlinks not followed): a directory's own mtime does not
 * move when a file inside it is rewritten in place.
 */
export function liveConfigSnapshot(home = os.homedir()) {
  const watched = ['.claude/CLAUDE.md', '.claude/settings.json', '.claude/skills', '.agents', '.codex/AGENTS.md', '.agent-config'];
  const snapshot = {};
  const visit = (file, relative) => {
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return;
    if (!stat.isDirectory()) {
      snapshot[relative] = `${stat.size}:${stat.mtimeMs}`;
      return;
    }
    snapshot[`${relative}/`] = '';
    for (const entry of fs.readdirSync(file).sort()) visit(path.join(file, entry), `${relative}/${entry}`);
  };
  for (const relative of watched) visit(path.join(home, relative), relative);
  return snapshot;
}

const listFiles = (directory) => {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  if (fs.existsSync(directory)) visit(directory);
  return files;
};

/** Content hashes of the installed agent config, with the arm's home path normalised to `~`. */
export function inventory(home) {
  const hashes = {};
  for (const root of ['.agents', '.claude/skills', '.claude/CLAUDE.md']) {
    const start = path.join(home, root);
    const files = fs.existsSync(start) && fs.statSync(start).isFile() ? [start] : listFiles(start);
    for (const file of files) {
      const relative = path.relative(home, file).split(path.sep).join('/');
      const content = fs.readFileSync(file, 'utf8').replaceAll(home, '~');
      hashes[relative] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  const policies = Object.keys(hashes).map((file) => /^\.agents\/policy\/([^/]+)\.md$/.exec(file)?.[1]).filter(Boolean).sort();
  const skills = [...new Set(Object.keys(hashes).map((file) => /^\.claude\/skills\/([^/]+)\//.exec(file)?.[1]).filter(Boolean))].sort();
  return { hashes, policies, skills };
}

/** Policies/skills whose installed files differ between two inventories (routing excluded: always read). */
export function compareInventories(a, b) {
  const files = [...new Set([...Object.keys(a.hashes), ...Object.keys(b.hashes)])].sort();
  const changedFiles = files.filter((file) => a.hashes[file] !== b.hashes[file]);
  const watched = new Set();
  for (const file of changedFiles) {
    const policy = /^\.agents\/policy\/([^/]+)\.md$/.exec(file)?.[1];
    const skill = /^\.(?:agents|claude)\/skills\/([^/]+)\//.exec(file)?.[1];
    if (policy && policy !== 'routing') watched.add(policy);
    if (skill) watched.add(skill);
  }
  return { identical: changedFiles.length === 0, changedFiles, watched: [...watched].sort() };
}

/** Builds one arm into `armDir` (src/ + home/) and returns its metadata. */
export function buildArm({ repoRoot, spec, armDir }) {
  const src = path.join(armDir, 'src');
  const home = path.join(armDir, 'home');
  if (path.resolve(home) === path.resolve(os.homedir())) throw new Error('Refusing to install an arm into the real home directory');
  fs.rmSync(armDir, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  let sha = null;
  if (spec.ref === WORKTREE) copyWorkingTree(repoRoot, src);
  else {
    sha = tryRevParse(repoRoot, spec.ref);
    if (!sha) throw new Error(`Unknown ref: ${spec.ref}`);
    extractTree(repoRoot, sha, src);
  }
  const added = spec.add.map((toggle) => ({ ...toggle, resolved: applyAdd(repoRoot, src, toggle) }));
  for (const removal of spec.remove) {
    const target = path.join(src, removal);
    if (!fs.existsSync(target)) throw new Error(`--remove target does not exist in ${spec.ref}: ${removal}`);
    fs.rmSync(target, { recursive: true, force: true });
  }
  // The installer never reads evals/, and the agent can reach this directory by relative path from
  // its working copy: a ref that carries the suite would hand it the hidden tests and the checks.
  fs.rmSync(path.join(src, 'evals'), { recursive: true, force: true });
  const before = liveConfigSnapshot();
  const install = spawnSync(process.execPath, [path.join(src, 'bin', 'agent-config.mjs'), 'sync', '--user'], {
    cwd: src,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, LANG: process.env.LANG ?? 'C.UTF-8', HOME: home, USERPROFILE: home, AGENT_CONFIG_EXTERNAL_PLUGINS: 'skip', ...TELEMETRY_OFF }
  });
  const after = liveConfigSnapshot();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Live agent config changed during an arm build; aborting');
  if (install.status !== 0) throw new Error(`agent-config sync failed for ${spec.ref}: ${install.stderr || install.stdout}`);
  return { ref: spec.ref, sha, add: added, remove: spec.remove, home, ...inventory(home) };
}
