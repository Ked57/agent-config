import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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
  put(path.join(repo, 'agents/coder.md'), '# Coder\n\nImplement the task.\n');
  for (const harness of ['codex', 'claude', 'cursor']) {
    const instructions = 'Read `~/.agents/agents/coder.md` and follow it.';
    put(path.join(repo, `harnesses/${harness}/agents/coder.${harness === 'codex' ? 'toml' : 'md'}`), harness === 'codex'
      ? ['name = "coder"', 'description = "Implement a task"', 'model = "gpt-5.6-sol"', 'model_reasoning_effort = "low"', `developer_instructions = ${JSON.stringify(instructions)}`].join('\n') + '\n'
      : `---\nname: coder\ndescription: Implement a task\nmodel: ${harness === 'claude' ? 'sonnet' : '"gpt-5.6-sol[effort=low]"'}\n---\n\n${instructions}\n`);
  }
  const run = (command, extra = [], environment = {}) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home, ...environment };
    if (!('CODEX_HOME' in environment)) delete env.CODEX_HOME;
    return spawnSync(process.execPath, [path.join(repo, 'bin/agent-config.mjs'), command, '--user', ...extra], { env, encoding: 'utf8' });
  };
  return { repo, home, run, directory };
}
const ok = (result) => assert.equal(result.status, 0, result.stderr);

test('discovers shared and native agents, synchronizes deterministically, and detects drift', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  assert.match(fs.readFileSync(path.join(home, '.agents/agents/coder.md'), 'utf8'), /agent-config:managed/);
  for (const file of ['.codex/agents/coder.toml', '.claude/agents/coder.md', '.cursor/agents/coder.md']) {
    assert.match(fs.readFileSync(path.join(home, file), 'utf8'), /~\/.agents\/agents\/coder.md/);
  }
  ok(run('check'));
  const lock = fs.readFileSync(path.join(home, '.agent-config/agent-config.lock.json'), 'utf8');
  assert.match(run('sync').stdout, /created=0 updated=0 removed=0/);
  assert.equal(fs.readFileSync(path.join(home, '.agent-config/agent-config.lock.json'), 'utf8'), lock);
  put(path.join(home, '.codex/agents/coder.toml'), '# changed\n');
  assert.notEqual(run('check').status, 0);
  ok(run('sync'));
  ok(run('check'));
});

test('installs and connects the shared routing and role policy', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  for (const name of ['routing', 'orchestration', 'typescript', 'react', 'vue-primevue', 'domain-module']) {
    assert.ok(fs.existsSync(path.join(home, '.agents/policy', `${name}.md`)));
  }
  assert.match(fs.readFileSync(path.join(home, '.codex/AGENTS.md'), 'utf8'), /~\/.agents\/policy\/routing.md/);
});

function snapshot(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? snapshot(full).map(([file, content]) => [`${entry.name}/${file}`, content]) : [[entry.name, fs.readFileSync(full, 'utf8')]];
  });
}

test('late native collision and malformed policy block leave the whole home unchanged', (t) => {
  const { home, run } = fixture(t);
  put(path.join(home, '.cursor/agents/coder.md'), 'User owned');
  const before = snapshot(home);
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), before);
  fs.unlinkSync(path.join(home, '.cursor/agents/coder.md'));
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
  put(path.join(repo, 'agents/coder.md'), '# Coder\nChanged behavior.\n');
  const before = snapshot(home);
  const preview = run('sync', ['--dry-run']);
  ok(preview);
  assert.match(preview.stdout, /\+Changed behavior/);
  assert.deepEqual(snapshot(home), before);
  assert.notEqual(run('check').status, 0);
  ok(run('sync'));
  ok(run('check'));
});

test('invalid native metadata and missing sources fail before any writes', (t) => {
  const { repo, home, run } = fixture(t);
  const file = path.join(repo, 'harnesses/codex/agents/coder.toml');
  const original = fs.readFileSync(file, 'utf8');
  for (const contents of [
    original + 'name = "duplicate"\n',
    original.replace('name = "coder"', 'name = "other"'),
    original.replace('model_reasoning_effort = "low"', 'model_reasoning_effort = "invalid"'),
    original.replace('description = "Implement a task"', 'description = "bad\\qescape"'),
    original.replace('description = "Implement a task"', 'description = "bad\\uD800escape"'),
    original.replace('~/.agents/agents/coder.md', '~/.agents/agents/missing.md'),
    original.replace('model = "gpt-5.6-sol"\n', ''),
    original + 'unsupported = "setting"\n'
  ]) {
    put(file, contents);
    assert.notEqual(run('sync').status, 0, contents);
    assert.deepEqual(snapshot(home), []);
  }
  put(file, original);
  fs.renameSync(path.join(repo, 'agents'), path.join(repo, 'agents-missing'));
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), []);
});

function renameRole(repo) {
  for (const relative of ['agents/coder.md', 'harnesses/codex/agents/coder.toml', 'harnesses/claude/agents/coder.md', 'harnesses/cursor/agents/coder.md']) {
    const old = path.join(repo, relative);
    put(old.replace(/coder\.(md|toml)$/, 'reviewer.$1'), fs.readFileSync(old, 'utf8').replaceAll('coder', 'reviewer'));
    fs.unlinkSync(old);
  }
}

test('removes only unchanged obsolete outputs and preserves modified or unrelated agents', (t) => {
  const { repo, home, run } = fixture(t);
  ok(run('init'));
  put(path.join(home, '.cursor/agents/custom.md'), '# User agent');
  put(path.join(home, '.claude/agents/coder.md'), '# Locally modified old agent');
  renameRole(repo);
  assert.notEqual(run('check').status, 0);
  const before = snapshot(home);
  const preview = run('sync', ['--dry-run']);
  ok(preview);
  assert.match(preview.stdout, /removed=3/);
  assert.deepEqual(snapshot(home), before);
  ok(run('sync'));
  for (const file of ['.agents/agents/coder.md', '.codex/agents/coder.toml', '.cursor/agents/coder.md']) assert.ok(!fs.existsSync(path.join(home, file)));
  assert.equal(fs.readFileSync(path.join(home, '.claude/agents/coder.md'), 'utf8'), '# Locally modified old agent');
  assert.equal(fs.readFileSync(path.join(home, '.cursor/agents/custom.md'), 'utf8'), '# User agent');
  ok(run('check'));
});

test('migrates legacy locks without deleting outputs lacking installed hashes', (t) => {
  const { repo, home, run } = fixture(t);
  ok(run('init'));
  const lockFile = path.join(home, '.agent-config/agent-config.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.version = 1;
  delete lock.hashes;
  put(lockFile, JSON.stringify(lock));
  renameRole(repo);
  const result = run('sync');
  ok(result);
  assert.match(result.stdout, /preserved=4/);
  assert.ok(fs.existsSync(path.join(home, '.codex/agents/coder.toml')));
  ok(run('check'));
});

test('rejects poisoned ownership keys and invalid lock metadata before writes', (t) => {
  const { home, run } = fixture(t);
  ok(run('init'));
  const file = path.join(home, '.agent-config/agent-config.lock.json');
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['codex:agent:../../outside.toml', 'skill:bad:../outside.md', 'agent:/absolute.md']) {
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

test('custom Codex home installs and checks outside the user home', (t) => {
  const { home, run, directory } = fixture(t);
  const codexHome = path.join(directory, 'separate-codex');
  ok(run('sync', [], { CODEX_HOME: codexHome }));
  assert.ok(fs.existsSync(path.join(codexHome, 'agents/coder.toml')));
  assert.ok(!fs.existsSync(path.join(home, '.codex')));
  ok(run('check', [], { CODEX_HOME: codexHome }));
  assert.match(run('status', [], { CODEX_HOME: codexHome }).stdout, /agents.*coder/);
});

test('changing Codex home preserves conflicting files in the new root', (t) => {
  const { home, run, directory } = fixture(t);
  ok(run('init'));
  const codexHome = path.join(directory, 'other-codex');
  put(path.join(codexHome, 'agents/coder.toml'), '# User-owned new root agent');
  const before = snapshot(home);
  assert.notEqual(run('sync', [], { CODEX_HOME: codexHome }).status, 0);
  assert.equal(fs.readFileSync(path.join(codexHome, 'agents/coder.toml'), 'utf8'), '# User-owned new root agent');
  assert.deepEqual(snapshot(home), before);
});

test('junctions at a native destination or the Codex root cannot cause partial writes', (t) => {
  const { home, run, directory } = fixture(t);
  const external = path.join(directory, 'external');
  fs.mkdirSync(external);
  fs.mkdirSync(path.join(home, '.cursor'));
  fs.symlinkSync(external, path.join(home, '.cursor/agents'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run('sync').status, 0);
  assert.ok(!fs.existsSync(path.join(home, '.codex')));
  assert.deepEqual(fs.readdirSync(external), []);
  fs.unlinkSync(path.join(home, '.cursor/agents'));
  const codexHome = path.join(directory, 'linked-codex');
  fs.symlinkSync(external, codexHome, process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run('sync', [], { CODEX_HOME: codexHome }).status, 0);
  assert.deepEqual(fs.readdirSync(external), []);
  assert.ok(!fs.existsSync(path.join(home, '.agents')));
});

test('rejects YAML implicit non-string metadata and malformed frontmatter', (t) => {
  const { repo, home, run } = fixture(t);
  const file = path.join(repo, 'harnesses/claude/agents/coder.md');
  const original = fs.readFileSync(file, 'utf8');
  for (const bad of [original.replace('description: Implement a task', 'description: true'), original.replace('---\n', '--\n')]) {
    put(file, bad);
    assert.notEqual(run('sync').status, 0);
    assert.deepEqual(snapshot(home), []);
  }
});

test('validates Cursor model options before writes', (t) => {
  const { repo, home, run } = fixture(t);
  const file = path.join(repo, 'harnesses/cursor/agents/coder.md');
  const original = fs.readFileSync(file, 'utf8');
  put(file, original.replace('[effort=low]', '[effort=invalid]'));
  assert.notEqual(run('sync').status, 0);
  assert.deepEqual(snapshot(home), []);
});

test('rejects Codex roots that overlap planned files before writing anything', (t) => {
  for (const relative of ['.agents/agents/coder.md', '.agent-config/agent-config.lock.json']) {
    const { home, run } = fixture(t);
    const result = run('sync', [], { CODEX_HOME: path.join(home, relative) });
    assert.notEqual(result.status, 0);
    assert.deepEqual(snapshot(home), [], `partial writes for ${relative}`);
  }
});
