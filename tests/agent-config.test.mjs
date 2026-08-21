import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin/agent-config.mjs');
const run = (project, ...args) => execFileSync(process.execPath, [cli, ...args, '--project', project], {
  cwd: root,
  encoding: 'utf8'
});

test('initialises a Vue TypeScript workspace and preserves project-owned routing', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-vue-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { vue: '^3.5.0' },
    devDependencies: { typescript: '^5.0.0' },
    scripts: {
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      'test:unit': 'vitest run',
      'test:component': 'cypress run --component',
      'verify:fast': 'npm run lint && npm run typecheck && npm run test:unit'
    }
  }, null, 2));
  fs.writeFileSync(path.join(project, 'tsconfig.json'), '{}');

  run(project, 'init');

  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /agent-config:begin shared-policy/);
  assert.ok(fs.existsSync(path.join(project, '.cursor/rules/30-agent-config-vue-primevue.mdc')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md')));

  const configPath = path.join(project, '.agents/agent-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.commands.component, 'npm run test:component');
  assert.equal(config.commands.fast, 'npm run verify:fast');

  const routed = execFileSync(process.execPath, [path.join(project, '.agents/scripts/agent-check.mjs'), '--files', 'src/components/ProjectDialog.vue'], {
    cwd: project,
    encoding: 'utf8'
  });
  assert.match(routed, /component: npm run test:component/);

  fs.writeFileSync(configPath, JSON.stringify({ version: 1, commands: { fast: 'custom fast' }, routing: [] }, null, 2));
  run(project, 'sync');
  assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).commands.fast, 'custom fast');

  run(project, 'check');
});

test('preserves an unmanaged AGENTS.md instead of overwriting it', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-safe-'));
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project guidance\n');

  assert.throws(() => run(project, 'init'));
  assert.equal(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), '# Existing project guidance\n');
});

test('runs from a source checkout path containing spaces', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent config source-'));
  const spacedSource = path.join(temporaryRoot, 'source checkout');
  const project = path.join(temporaryRoot, 'target workspace');
  fs.cpSync(root, spacedSource, { recursive: true, filter: (entry) => !entry.includes(`${path.sep}.git`) });
  fs.mkdirSync(project);

  execFileSync(process.execPath, [path.join(spacedSource, 'bin/agent-config.mjs'), 'init', '--project', project], {
    cwd: project,
    encoding: 'utf8'
  });

  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));
});

test('preserves colliding unmanaged generated-target files', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-collision-'));
  const collision = path.join(project, '.agents/scripts/agent-check.mjs');
  fs.mkdirSync(path.dirname(collision), { recursive: true });
  fs.writeFileSync(collision, '// Project-owned implementation\n');

  assert.throws(() => run(project, 'init'));
  assert.equal(fs.readFileSync(collision, 'utf8'), '// Project-owned implementation\n');

  assert.throws(() => run(project, 'sync'));
  assert.equal(fs.readFileSync(collision, 'utf8'), '// Project-owned implementation\n');
});

test('preserves a colliding project-owned lock file', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-lock-collision-'));
  const lock = path.join(project, '.agents/agent-config.lock.json');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, JSON.stringify({ projectOwned: true }, null, 2));

  assert.throws(() => run(project, 'init'));
  assert.deepEqual(JSON.parse(fs.readFileSync(lock, 'utf8')), { projectOwned: true });
});
