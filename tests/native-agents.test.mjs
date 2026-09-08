import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import test from 'node:test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const put = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-agents-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repo = path.join(directory, 'repo');
  const home = path.join(directory, 'home');
  fs.mkdirSync(home);
  for (const folder of ['bin', 'policy', 'skills']) fs.cpSync(path.join(root, folder), path.join(repo, folder), { recursive: true });
  const run = (command, extra = [], environment = {}) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home, ...environment };
    if (!('CODEX_HOME' in environment)) delete env.CODEX_HOME;
    return spawnSync(process.execPath, [path.join(repo, 'bin/agent-config.mjs'), command, '--user', ...extra], {
      env,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    });
  };
  return { repo, home, run, directory };
}
const ok = (result) => assert.equal(result.status, 0, result.stderr);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('synchronizes policy without installing shared roles', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  assert.ok(!fs.existsSync(path.join(home, '.agents/agents')));
  for (const file of ['.codex/agents/coder.toml', '.claude/agents/coder.md', '.cursor/agents/coder.md']) {
    assert.ok(!fs.existsSync(path.join(home, file)));
  }
  ok(run('check'));
  const lock = fs.readFileSync(path.join(home, '.agent-config/agent-config.lock.json'), 'utf8');
  assert.match(run('sync').stdout, /created=0 updated=0 removed=0/);
  assert.equal(fs.readFileSync(path.join(home, '.agent-config/agent-config.lock.json'), 'utf8'), lock);
  put(path.join(home, '.agents/policy/routing.md'), '# changed\n');
  assert.notEqual(run('check').status, 0);
  ok(run('sync'));
  ok(run('check'));
});

test('installs and connects the shared routing policy', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  for (const name of ['routing', 'typescript', 'react', 'vue-primevue', 'domain-module']) {
    assert.ok(fs.existsSync(path.join(home, '.agents/policy', `${name}.md`)));
  }
  assert.ok(!fs.existsSync(path.join(home, '.agents/policy/orchestration.md')));
  assert.match(fs.readFileSync(path.join(home, '.codex/AGENTS.md'), 'utf8'), /~\/.agents\/policy\/routing.md/);
  assert.match(fs.readFileSync(path.join(home, '.agents/AGENTS.md'), 'utf8'), /~\/.agents\/skills\/manual-qa\/SKILL.md/);
});

function snapshot(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? snapshot(full).map(([file, content]) => [`${entry.name}/${file}`, content]) : [[entry.name, fs.readFileSync(full, 'utf8')]];
  });
}

test('late shared-file collision and malformed policy block leave the whole home unchanged', (t) => {
  const { home, run } = fixture(t);
  put(path.join(home, '.agents/policy/routing.md'), 'User owned');
  const before = snapshot(home);
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), before);
  fs.unlinkSync(path.join(home, '.agents/policy/routing.md'));
  put(path.join(home, '.claude/CLAUDE.md'), '<!-- agent-config:begin claude-user-bridge -->');
  const malformed = snapshot(home);
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), malformed);
});

test('dry-run previews changes and removals without changing files or the lock', (t) => {
  const { repo, home, run } = fixture(t);
  const initial = run('sync', ['--dry-run']);
  ok(initial);
  assert.match(initial.stdout, /--- \/dev\/null/);
  assert.deepEqual(snapshot(home), []);
  ok(run('sync'));
  put(path.join(repo, 'skills/manual-qa/SKILL.md'), `${fs.readFileSync(path.join(repo, 'skills/manual-qa/SKILL.md'), 'utf8')}\nChanged behavior.\n`);
  const before = snapshot(home);
  const preview = run('sync', ['--dry-run']);
  ok(preview);
  assert.match(preview.stdout, /\+Changed behavior/);
  assert.deepEqual(snapshot(home), before);
  assert.notEqual(run('check').status, 0);
  ok(run('sync'));
  ok(run('check'));
});

test('empty shared agents fail before any writes; a missing agents directory is allowed', (t) => {
  const { repo, home, run } = fixture(t);
  put(path.join(repo, 'agents/coder.md'), '');
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), []);
  fs.rmSync(path.join(repo, 'agents'), { recursive: true, force: true });
  ok(run('sync'));
  assert.ok(fs.existsSync(path.join(home, '.agents/policy/routing.md')));
  assert.ok(!fs.existsSync(path.join(home, '.agents/agents')));
});

test('removes unchanged leftover shared-agent files and preserves modified leftovers', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  const managed = '<!-- agent-config:managed -->\n# Coder\n';
  put(path.join(home, '.cursor/agents/custom.md'), '# User agent');
  put(path.join(home, '.agents/agents/coder.md'), managed);
  const lockFile = path.join(home, '.agent-config/agent-config.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.managedFiles.push('agent:coder.md');
  lock.hashes['agent:coder.md'] = hash(managed);
  put(lockFile, JSON.stringify(lock, null, 2));
  const preview = run('sync', ['--dry-run']);
  ok(preview);
  assert.match(preview.stdout, /removed=1/);
  ok(run('sync'));
  assert.ok(!fs.existsSync(path.join(home, '.agents/agents/coder.md')));
  assert.equal(fs.readFileSync(path.join(home, '.cursor/agents/custom.md'), 'utf8'), '# User agent');
  ok(run('check'));

  put(path.join(home, '.agents/agents/reviewer.md'), '# Locally modified old agent');
  const after = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  after.managedFiles.push('agent:reviewer.md');
  after.hashes['agent:reviewer.md'] = hash(managed);
  put(lockFile, JSON.stringify(after, null, 2));
  const preserved = run('sync', ['--dry-run']);
  ok(preserved);
  assert.match(preserved.stdout, /removed=0/);
  assert.match(preserved.stdout, /preserved=1/);
  ok(run('sync'));
  assert.equal(fs.readFileSync(path.join(home, '.agents/agents/reviewer.md'), 'utf8'), '# Locally modified old agent');
  ok(run('check'));
});

test('migrates legacy locks without deleting outputs lacking installed hashes', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  const managed = '<!-- agent-config:managed -->\n# Coder\n';
  put(path.join(home, '.agents/agents/coder.md'), managed);
  const lockFile = path.join(home, '.agent-config/agent-config.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.version = 1;
  lock.managedFiles.push('agent:coder.md');
  delete lock.hashes;
  put(lockFile, JSON.stringify(lock));
  const result = run('sync');
  ok(result);
  assert.match(result.stdout, /preserved=1/);
  assert.ok(fs.existsSync(path.join(home, '.agents/agents/coder.md')));
  ok(run('check'));
});

test('sync removes previously installed native harness wrappers', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  const contents = '# agent-config:managed\nname = "coder"\n';
  put(path.join(home, '.codex/agents/coder.toml'), contents);
  const lockFile = path.join(home, '.agent-config/agent-config.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.managedFiles.push('codex:agent:coder.toml');
  lock.hashes['codex:agent:coder.toml'] = hash(contents);
  put(lockFile, JSON.stringify(lock));
  ok(run('sync'));
  assert.ok(!fs.existsSync(path.join(home, '.codex/agents/coder.toml')));
  ok(run('check'));
});

test('sync removes an obsolete policy pack when the lock still owns the unchanged file', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  const contents = '# Sub-agent orchestration\n';
  put(path.join(home, '.agents/policy/orchestration.md'), contents);
  const lockFile = path.join(home, '.agent-config/agent-config.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.managedFiles.push('policy:orchestration');
  lock.hashes['policy:orchestration'] = hash(contents);
  put(lockFile, JSON.stringify(lock));
  ok(run('sync'));
  assert.ok(!fs.existsSync(path.join(home, '.agents/policy/orchestration.md')));
  ok(run('check'));
});

test('rejects poisoned ownership keys and invalid lock metadata before writes', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  const file = path.join(home, '.agent-config/agent-config.lock.json');
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['codex:agent:../../outside.toml', 'skill:bad:../outside.md', 'agent:/absolute.md', 'policy:../outside']) {
    const lock = structuredClone(original);
    lock.managedFiles.push(key);
    lock.hashes[key] = 'a'.repeat(64);
    put(file, JSON.stringify(lock));
    const before = snapshot(home);
    assert.notEqual(run('sync').status, 0);
    assert.deepEqual(snapshot(home), before);
  }
  put(file, '{broken json');
  const before = snapshot(home);
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), before);
});

test('custom Codex home installs policy without native agent wrappers', (t) => {
  const { home, run, directory } = fixture(t);
  const codexHome = path.join(directory, 'separate-codex');
  ok(run('sync', [], { CODEX_HOME: codexHome }));
  assert.ok(fs.existsSync(path.join(codexHome, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(codexHome, 'agents')));
  assert.ok(!fs.existsSync(path.join(home, '.codex')));
  ok(run('check', [], { CODEX_HOME: codexHome }));
  assert.match(run('status', [], { CODEX_HOME: codexHome }).stdout, /policy.routing\.md/);
});

test('junctions at a shared-policy destination or the Codex root cannot cause partial writes', (t) => {
  const { home, run, directory } = fixture(t);
  const external = path.join(directory, 'external');
  fs.mkdirSync(external);
  fs.mkdirSync(path.join(home, '.agents'));
  fs.symlinkSync(external, path.join(home, '.agents/policy'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run('sync').status, 0);
  assert.ok(!fs.existsSync(path.join(home, '.codex')));
  assert.deepEqual(fs.readdirSync(external), []);
  fs.unlinkSync(path.join(home, '.agents/policy'));
  const codexHome = path.join(directory, 'linked-codex');
  fs.symlinkSync(external, codexHome, process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run('sync', [], { CODEX_HOME: codexHome }).status, 0);
  assert.deepEqual(fs.readdirSync(external), []);
  assert.ok(!fs.existsSync(path.join(home, '.agents/policy')));
});

test('rejects Codex roots that overlap planned files before writing anything', (t) => {
  for (const relative of ['.agents/policy/routing.md', '.agent-config/agent-config.lock.json']) {
    const { home, run } = fixture(t);
    const result = run('sync', [], { CODEX_HOME: path.join(home, relative) });
    assert.notEqual(result.status, 0);
    assert.deepEqual(snapshot(home), [], `partial writes for ${relative}`);
  }
});
