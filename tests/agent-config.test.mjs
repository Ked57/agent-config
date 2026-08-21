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
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/App.vue'), '<script setup lang="ts"></script>\n<template><main /></template>\n');

  run(project, 'init');

  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /vue-primevue\.md/);
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
  assert.ok(!fs.existsSync(path.join(project, '.cursor/rules/30-agent-config-vue-primevue.mdc')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md')));
  assert.match(fs.readFileSync(path.join(project, '.prettierignore'), 'utf8'), /# agent-config:begin prettier-ignore/);
  assert.match(fs.readFileSync(path.join(project, '.prettierignore'), 'utf8'), /\.agents\//);

  const configPath = path.join(project, '.agents/agent-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.commands.component, 'npm run test:component');
  assert.equal(config.commands.fast, 'npm run verify:fast');
  assert.ok(!fs.existsSync(path.join(project, '.agents/scripts/agent-check.mjs')));

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
  const collision = path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md');
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

test('does not mistake a similarly named prettier-ignore block for its own', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-prettier-collision-'));
  const prettierIgnore = path.join(project, '.prettierignore');
  fs.writeFileSync(prettierIgnore, '# agent-config:begin prettier-ignore-custom\nKEEP-ME\n# agent-config:end prettier-ignore-custom\n');

  assert.throws(() => run(project, 'init'));
  assert.match(fs.readFileSync(prettierIgnore, 'utf8'), /KEEP-ME/);
});

test('migrates lock-owned legacy Cursor rules to shared policy packs', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-legacy-rules-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { vue: '^3.5.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  fs.writeFileSync(path.join(project, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(project, 'src/domain'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/App.vue'), '<template><main /></template>\n');
  for (const part of ['model', 'interface', 'service', 'mock']) {
    fs.writeFileSync(path.join(project, `src/domain/counter.${part}.ts`), 'export {};\n');
  }
  const legacyRules = [
    '.cursor/rules/10-agent-config-typescript.mdc',
    '.agents/scripts/agent-check.mjs'
  ];
  const legacyTypeScriptRule = path.join(project, legacyRules[0]);
  const legacyRouter = path.join(project, legacyRules[1]);
  fs.mkdirSync(path.dirname(legacyTypeScriptRule), { recursive: true });
  fs.mkdirSync(path.dirname(legacyRouter), { recursive: true });
  fs.copyFileSync(path.join(root, 'tests/fixtures/legacy-typescript.mdc'), legacyTypeScriptRule);
  fs.copyFileSync(path.join(root, 'tests/fixtures/legacy-agent-check.mjs'), legacyRouter);
  const lockFile = path.join(project, '.agents/agent-config.lock.json');
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, JSON.stringify({
    version: 1,
    source: 'Ked57/agent-config',
    revision: 'b479b77d0f03',
    installedAt: '2026-08-21T12:00:00.000Z',
    detected: { runtime: 'npm', typescript: true, vue: true },
    managedFiles: legacyRules
  }, null, 2));

  run(project, 'sync');

  for (const rule of legacyRules) assert.ok(!fs.existsSync(path.join(project, rule)));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.doesNotThrow(() => run(project, 'check'));
});

test('preserves legacy Cursor rules not owned by a trusted lock', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-unowned-legacy-'));
  const legacyRule = path.join(project, '.cursor/rules/10-agent-config-typescript.mdc');
  fs.mkdirSync(path.dirname(legacyRule), { recursive: true });
  fs.writeFileSync(legacyRule, '# Project-owned legacy rule\n');

  run(project, 'init');

  assert.equal(fs.readFileSync(legacyRule, 'utf8'), '# Project-owned legacy rule\n');
});

test('preserves matching legacy content when the lock lacks a complete trusted shape', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-partial-lock-'));
  const legacyRule = path.join(project, '.cursor/rules/10-agent-config-typescript.mdc');
  fs.mkdirSync(path.dirname(legacyRule), { recursive: true });
  fs.copyFileSync(path.join(root, 'tests/fixtures/legacy-typescript.mdc'), legacyRule);
  const lockFile = path.join(project, '.agents/agent-config.lock.json');
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, JSON.stringify({
    version: 1,
    source: 'Ked57/agent-config',
    managedFiles: ['.cursor/rules/10-agent-config-typescript.mdc']
  }, null, 2));

  assert.throws(() => run(project, 'sync'));
  assert.ok(fs.existsSync(legacyRule));
});

test('installs React guidance only when React source exists', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-react-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/App.tsx'), 'export const App = () => <main />;\n');

  run(project, 'init');

  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
});

test('does not install framework packs from dependencies alone', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-no-framework-source-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { react: '^19.0.0', vue: '^3.5.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/index.js'), 'console.log("no framework source");\n');

  run(project, 'init');

  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
});

test('detects Vue TypeScript source under apps/ monorepo layouts', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-apps-mono-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { vue: '^3.5.0', primevue: '^4.0.0' },
    devDependencies: { typescript: '^5.0.0' },
    scripts: {
      'test:component': 'cypress run --component',
      'verify:fast': 'npm run test:component'
    }
  }, null, 2));
  fs.mkdirSync(path.join(project, 'apps/web/src'), { recursive: true });
  fs.writeFileSync(
    path.join(project, 'apps/web/src/App.vue'),
    '<script setup lang="ts"></script>\n<template><main /></template>\n'
  );

  const output = run(project, 'init');
  assert.match(output, /Created \.agents\/policy\/vue-primevue\.md/);
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));

  const status = run(project, 'status');
  assert.match(status, /vue=true/);
  assert.match(status, /typescript=true/);
});
