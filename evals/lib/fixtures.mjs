// Fixture loading, cached pristine setup, per-run copies and integrity checks.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree, TELEMETRY_OFF } from './env.mjs';

export const FIXTURES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function loadFixture(name) {
  const dir = path.join(FIXTURES_ROOT, name);
  const file = path.join(dir, 'fixture.json');
  if (!fs.existsSync(file)) throw new Error(`Unknown fixture: ${name} (expected ${file})`);
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['name', 'gates']) if (!fixture[key]) throw new Error(`${file}: missing ${key}`);
  return { linkPaths: [], diffExclude: ['node_modules'], setup: [], ...fixture, dir, templateDir: path.join(dir, 'template') };
}

const walk = (directory, visit, skip = () => false) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    if (skip(full, entry)) continue;
    if (entry.isDirectory()) walk(full, visit, skip);
    else if (entry.isFile()) visit(full);
  }
};

/** Hash of every source file of the fixture definition; a change invalidates the cached pristine copy. */
export function fixtureHash(fixture) {
  const hash = crypto.createHash('sha256');
  walk(fixture.dir, (file) => {
    hash.update(path.relative(fixture.dir, file));
    hash.update(fs.readFileSync(file));
  }, (full, entry) => entry.isDirectory() && ['node_modules', 'dist'].includes(entry.name));
  return hash.digest('hex').slice(0, 12);
}

/**
 * Hash of what a run can observe or be measured by: `fixture.json`, `template/`, and every file its
 * `setup` commands name as `{fixtureDir}/<path>` (generator scripts such as `scaffold.mjs`). Task
 * material (hidden tests, mutants, specs, MCP stubs) is left out: it enters a run's inputsKey through
 * the task's own check copies, files and mode server files. `fixtureHash` still guards the cache and resume.
 */
export function runFixtureHash(fixtureDir) {
  const hash = crypto.createHash('sha256');
  const definition = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'fixture.json'), 'utf8'));
  const scripts = (definition.setup ?? []).flatMap((command) => [...command.matchAll(/\{fixtureDir\}\/([^\s'"]+)/g)].map((match) => match[1]));
  const add = (file) => {
    hash.update(path.relative(fixtureDir, file));
    hash.update(fs.readFileSync(file));
  };
  for (const relative of ['fixture.json', ...[...new Set(scripts)].sort()]) {
    const full = path.join(fixtureDir, relative);
    if (fs.existsSync(full)) add(full);
  }
  const template = path.join(fixtureDir, 'template');
  if (fs.existsSync(template)) walk(template, add, (full, entry) => entry.isDirectory() && ['node_modules', 'dist'].includes(entry.name));
  return hash.digest('hex').slice(0, 12);
}

/**
 * The `runFixtureHash` an old eval ran with, for evals that predate it: the fixture at `commit` (the
 * repository commit the eval recorded) or, without one, at the newest commit whose full `fixtureHash`
 * equals `fullHash`. Extracted under `scratchRoot` and removed. Returns `{ hash, commit }` or null.
 */
export function historicalRunFixtureHash({ repoRoot, fixture, commit = null, fullHash, scratchRoot }) {
  const relative = path.relative(repoRoot, fixture.dir);
  const git = (args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const candidates = commit ? [commit] : git(['log', '--format=%H', '--', relative]).stdout.split('\n').filter(Boolean);
  fs.mkdirSync(scratchRoot, { recursive: true });
  for (const candidate of candidates) {
    const scratch = fs.mkdtempSync(path.join(scratchRoot, 'fixture-history-'));
    try {
      const archive = spawnSync('git', ['archive', '--format=tar', candidate, '--', relative], { cwd: repoRoot, maxBuffer: 512 * 1024 * 1024 });
      if (archive.status !== 0) continue;
      spawnSync('tar', ['-x', '-C', scratch], { input: archive.stdout });
      const dir = path.join(scratch, relative);
      if (!fs.existsSync(path.join(dir, 'fixture.json'))) continue;
      if (commit || fixtureHash({ dir }) === fullHash) return { hash: runFixtureHash(dir), commit: candidate };
    } finally {
      removeTree(scratch, scratchRoot);
    }
  }
  return null;
}

/** Whether every current template file (as the cache copies them) is byte-identical in a prepared copy. */
export function templateMatchesPrepared(fixture, prepared) {
  if (!fs.existsSync(path.join(prepared, '.eval-ready'))) return false;
  const skip = new Set(['node_modules', 'dist', 'data']);
  let same = true;
  walk(fixture.templateDir, (file) => {
    const copy = path.join(prepared, path.relative(fixture.templateDir, file));
    if (same && !(fs.existsSync(copy) && fs.readFileSync(copy).equals(fs.readFileSync(file)))) same = false;
  }, (full, entry) => entry.isDirectory() && skip.has(entry.name) && path.dirname(full) === fixture.templateDir);
  return same;
}

const sh = (command, cwd, env) => {
  const result = spawnSync('bash', ['-c', command], { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Fixture setup failed: ${command}\n${result.stdout}\n${result.stderr}`);
};

const manifest = (pristine, linkPaths) => {
  const entries = {};
  for (const linkPath of linkPaths) {
    const root = path.join(pristine, linkPath);
    if (!fs.existsSync(root)) continue;
    walk(root, (file) => {
      const stat = fs.statSync(file);
      entries[path.relative(pristine, file)] = `${stat.size}:${Math.trunc(stat.mtimeMs)}`;
    });
  }
  return entries;
};

/** Prepares (or reuses) the pristine copy under `<cacheRoot>/fixtures/<name>-<hash>`. */
export function preparePristine(fixture, cacheRoot, log = console.log) {
  const pristine = path.join(cacheRoot, 'fixtures', `${fixture.name}-${fixtureHash(fixture)}`);
  if (fs.existsSync(path.join(pristine, '.eval-ready'))) {
    // An earlier run may have written through a hard link; a damaged cache is rebuilt, not reused.
    const changed = verifyPristine(fixture, pristine);
    if (!changed.length) return pristine;
    log(`Cached fixture ${pristine} has ${changed.length} changed file(s) (e.g. ${changed[0]}); rebuilding it.`);
  }
  const staging = `${pristine}.staging-${process.pid}`;
  removeTree(staging, path.dirname(pristine));
  // A template may hold a local install from editing it; setup reinstalls from the lockfile.
  const skip = new Set(['node_modules', 'dist', 'data']);
  fs.cpSync(fixture.templateDir, staging, { recursive: true, filter: (source) => !skip.has(path.basename(source)) || path.dirname(source) !== fixture.templateDir });
  log(`Preparing fixture ${fixture.name} in ${pristine} ...`);
  const env = { ...process.env, ...TELEMETRY_OFF, npm_config_cache: path.join(cacheRoot, 'npm-cache') };
  for (const command of fixture.setup) sh(command.replaceAll('{fixtureDir}', fixture.dir), staging, env);
  fs.writeFileSync(path.join(staging, '.eval-manifest.json'), JSON.stringify(manifest(staging, fixture.linkPaths)));
  fs.writeFileSync(path.join(staging, '.eval-ready'), new Date().toISOString());
  removeTree(pristine, path.dirname(pristine));
  fs.renameSync(staging, pristine);
  return pristine;
}

/** Copies the pristine project to `destination`; `linkPaths` are hard-linked, not copied. */
export function copyForRun(fixture, pristine, destination) {
  removeTree(destination, path.dirname(destination));
  fs.mkdirSync(destination, { recursive: true });
  const excludes = ['.eval-ready', '.eval-manifest.json', ...fixture.linkPaths].flatMap((item) => ['--exclude', `./${item}`]);
  const result = spawnSync('bash', ['-c', `tar ${excludes.map((e) => `'${e}'`).join(' ')} -cf - . | tar -xf - -C '${destination}'`], { cwd: pristine, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`copy failed: ${result.stderr}`);
  linkFromPristine(fixture, pristine, destination);
}

/** Hard-links (or copies) `linkPaths` from the pristine copy into `destination`. */
function linkFromPristine(fixture, pristine, destination, linkPaths = fixture.linkPaths) {
  for (const linkPath of linkPaths) {
    const source = path.join(pristine, linkPath);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(path.dirname(path.join(destination, linkPath)), { recursive: true });
    const target = path.join(destination, linkPath);
    let link = spawnSync('cp', ['-al', source, target], { encoding: 'utf8' });
    if (link.status !== 0) {
      // Hard links can't cross filesystems (e.g. results on another mount than the cache): copy instead.
      removeTree(target, destination);
      link = spawnSync('cp', ['-a', source, target], { encoding: 'utf8' });
    }
    if (link.status !== 0) throw new Error(`copy of ${linkPath} failed: ${link.stderr.slice(0, 500)}`);
  }
}

/** Removes the fixture's `linkPaths` from a worked copy; returns those that were there. */
export function pruneLinkPaths(fixture, app) {
  const pruned = fixture.linkPaths.filter((linkPath) => fs.existsSync(path.join(app, linkPath)));
  for (const linkPath of pruned) removeTree(path.join(app, linkPath), app);
  return pruned;
}

/**
 * Runs `fn` in a saved app whose `linkPaths` were pruned: the missing ones are linked from the
 * pristine copy first and removed again afterwards. An app that kept its own copy is left alone.
 */
export function withLinkedPaths(fixture, pristine, app, fn) {
  const missing = fixture.linkPaths.filter((linkPath) => !fs.existsSync(path.join(app, linkPath)));
  try {
    if (missing.length) linkFromPristine(fixture, pristine, app, missing);
    return fn();
  } finally {
    for (const linkPath of missing) removeTree(path.join(app, linkPath), app);
  }
}

/** Files under linkPaths whose size or mtime changed (a run wrote through a hard link). */
export function verifyPristine(fixture, pristine) {
  const expected = JSON.parse(fs.readFileSync(path.join(pristine, '.eval-manifest.json'), 'utf8'));
  const actual = manifest(pristine, fixture.linkPaths);
  return Object.keys({ ...expected, ...actual }).filter((file) => expected[file] !== actual[file]);
}

/** Moves a directory tree; across filesystems (EXDEV) it copies with `cp -a` and removes the source. */
export function moveTree(from, to) {
  removeTree(to, path.dirname(to));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    const copy = spawnSync('cp', ['-a', from, to], { encoding: 'utf8' });
    if (copy.status !== 0) throw new Error(`copy of ${from} failed: ${copy.stderr.slice(0, 500)}`);
    removeTree(from, path.dirname(from));
  }
}

/** Copies a task's `files` (`{ "fixture-relative source": "app-relative target" }`) into a worked copy. */
export function copyTaskFiles(fixture, files = {}, destination) {
  for (const [from, to] of Object.entries(files)) {
    const target = path.join(destination, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(fixture.dir, from), target, { recursive: true });
  }
}
