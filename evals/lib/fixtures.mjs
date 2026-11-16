// Fixture loading, cached pristine setup, per-run copies and integrity checks.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TELEMETRY_OFF } from './env.mjs';

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
  fs.rmSync(staging, { recursive: true, force: true });
  // A template may hold a local install from editing it; setup reinstalls from the lockfile.
  const skip = new Set(['node_modules', 'dist', 'data']);
  fs.cpSync(fixture.templateDir, staging, { recursive: true, filter: (source) => !skip.has(path.basename(source)) || path.dirname(source) !== fixture.templateDir });
  log(`Preparing fixture ${fixture.name} in ${pristine} ...`);
  const env = { ...process.env, ...TELEMETRY_OFF, npm_config_cache: path.join(cacheRoot, 'npm-cache') };
  for (const command of fixture.setup) sh(command.replaceAll('{fixtureDir}', fixture.dir), staging, env);
  fs.writeFileSync(path.join(staging, '.eval-manifest.json'), JSON.stringify(manifest(staging, fixture.linkPaths)));
  fs.writeFileSync(path.join(staging, '.eval-ready'), new Date().toISOString());
  fs.rmSync(pristine, { recursive: true, force: true });
  fs.renameSync(staging, pristine);
  return pristine;
}

/** Copies the pristine project to `destination`; `linkPaths` are hard-linked, not copied. */
export function copyForRun(fixture, pristine, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  const excludes = ['.eval-ready', '.eval-manifest.json', ...fixture.linkPaths].flatMap((item) => ['--exclude', `./${item}`]);
  const result = spawnSync('bash', ['-c', `tar ${excludes.map((e) => `'${e}'`).join(' ')} -cf - . | tar -xf - -C '${destination}'`], { cwd: pristine, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`copy failed: ${result.stderr}`);
  for (const linkPath of fixture.linkPaths) {
    const source = path.join(pristine, linkPath);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(path.dirname(path.join(destination, linkPath)), { recursive: true });
    const target = path.join(destination, linkPath);
    let link = spawnSync('cp', ['-al', source, target], { encoding: 'utf8' });
    if (link.status !== 0) {
      // Hard links can't cross filesystems (e.g. results on another mount than the cache): copy instead.
      fs.rmSync(target, { recursive: true, force: true });
      link = spawnSync('cp', ['-a', source, target], { encoding: 'utf8' });
    }
    if (link.status !== 0) throw new Error(`copy of ${linkPath} failed: ${link.stderr.slice(0, 500)}`);
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
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    const copy = spawnSync('cp', ['-a', from, to], { encoding: 'utf8' });
    if (copy.status !== 0) throw new Error(`copy of ${from} failed: ${copy.stderr.slice(0, 500)}`);
    fs.rmSync(from, { recursive: true, force: true });
  }
}
