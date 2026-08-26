import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin/agent-config.mjs');
const run = (project, ...args) => execFileSync(process.execPath, [cli, ...args, '--project', project], {
  cwd: root,
  encoding: 'utf8'
});
const userEnvironment = (home) => {
  // Node's os.homedir() prefers USERPROFILE on Windows and ignores HOME.
  const environment = { ...process.env, HOME: home, USERPROFILE: home };
  delete environment.CODEX_HOME;
  return environment;
};
const runUser = (home, ...args) => execFileSync(process.execPath, [cli, ...args, '--user'], {
  cwd: root,
  encoding: 'utf8',
  env: userEnvironment(home)
});

test('installs one personal policy across Codex, Claude Code, and Cursor', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-user-'));
  const codexPolicy = path.join(home, '.codex/AGENTS.md');
  const claudePolicy = path.join(home, '.claude/CLAUDE.md');
  fs.mkdirSync(path.dirname(codexPolicy), { recursive: true });
  fs.mkdirSync(path.dirname(claudePolicy), { recursive: true });
  fs.writeFileSync(codexPolicy, '# Existing Codex preference\n');
  fs.writeFileSync(claudePolicy, '# Existing Claude preference\n');

  runUser(home, 'init');

  const installedPolicy = fs.readFileSync(codexPolicy, 'utf8');
  assert.match(installedPolicy, /Existing Codex preference/);
  assert.match(installedPolicy, /agent-config:begin user-policy/);
  assert.match(installedPolicy, /# TypeScript standards/);
  assert.match(installedPolicy, /# React \+ TypeScript/);
  assert.match(installedPolicy, /# Vue 3 \+ TypeScript \+ PrimeVue/);
  assert.match(installedPolicy, /# Domain module convention/);

  const installedClaudePolicy = fs.readFileSync(claudePolicy, 'utf8');
  assert.match(installedClaudePolicy, /Existing Claude preference/);
  assert.ok(installedClaudePolicy.includes(`@${codexPolicy}`));

  const cursorPlugin = path.join(home, '.cursor/plugins/local/agent-config');
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(cursorPlugin, '.cursor-plugin/plugin.json'), 'utf8')),
    {
      name: 'agent-config',
      version: '1.0.0',
      description: 'Personal cross-harness agent policy bridge.'
    }
  );
  assert.ok(fs.readFileSync(path.join(cursorPlugin, 'rules/00-agent-config.mdc'), 'utf8').includes(codexPolicy));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/fullstack-typescript-quality/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/fullstack-typescript-quality/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/frontend-design/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/frontend-design/LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/frontend-design/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/figma-design-to-code/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/figma-design-to-code/SKILL.md')));

  assert.doesNotThrow(() => runUser(home, 'check'));
  runUser(home, 'sync');
  assert.match(fs.readFileSync(codexPolicy, 'utf8'), /Existing Codex preference/);
});

test('preserves colliding user-level standalone files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-user-collision-'));
  const cursorRule = path.join(home, '.cursor/plugins/local/agent-config/rules/00-agent-config.mdc');
  fs.mkdirSync(path.dirname(cursorRule), { recursive: true });
  fs.writeFileSync(cursorRule, '# My existing Cursor rule\n');

  assert.throws(() => runUser(home, 'init'));
  assert.equal(fs.readFileSync(cursorRule, 'utf8'), '# My existing Cursor rule\n');
});

test('honours a custom Codex home for the canonical user policy', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-user-custom-home-'));
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-codex-home-'));
  const environment = { ...userEnvironment(home), CODEX_HOME: codexHome };

  execFileSync(process.execPath, [cli, 'init', '--user'], {
    cwd: root,
    encoding: 'utf8',
    env: environment
  });

  const canonicalPolicy = path.join(codexHome, 'AGENTS.md');
  assert.ok(fs.existsSync(canonicalPolicy));
  assert.ok(fs.readFileSync(path.join(home, '.claude/CLAUDE.md'), 'utf8').includes(`@${canonicalPolicy}`));
  assert.doesNotThrow(() => execFileSync(process.execPath, [cli, 'check', '--user'], {
    cwd: root,
    encoding: 'utf8',
    env: environment
  }));
});

test('refuses to write through a symlinked user configuration path', {
  skip: process.platform === 'win32'
}, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-user-symlink-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-user-external-'));
  fs.symlinkSync(external, path.join(home, '.agents'));

  assert.throws(() => runUser(home, 'init'));
  assert.deepEqual(fs.readdirSync(external), []);
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
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/frontend-design/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/frontend-design/LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/figma-design-to-code/SKILL.md')));
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

test('frontend skills keep distinct triggers and required completion contracts', () => {
  const frontendSkill = fs.readFileSync(path.join(root, 'skills/frontend-design/SKILL.md'), 'utf8');
  const figmaSkill = fs.readFileSync(path.join(root, 'skills/figma-design-to-code/SKILL.md'), 'utf8');

  assert.match(frontendSkill, /without a supplied source-of-truth design/);
  assert.match(frontendSkill, /existing design system.*rather than replacing it/s);
  assert.match(frontendSkill, /screenshots at representative narrow and wide viewports/);

  assert.match(figmaSkill, /supplied Figma node/);
  assert.match(figmaSkill, /structured design context for that node before editing code/);
  assert.match(figmaSkill, /Reuse matching components, tokens, icons, and assets/);
  assert.match(figmaSkill, /visually compared with Figma at the reference viewport/);
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

test('falls back to individual quality checks and detects pnpm', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-pnpm-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    packageManager: 'pnpm@10.0.0',
    devDependencies: { typescript: '^5.0.0' },
    scripts: {
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      test: 'vitest run'
    }
  }, null, 2));
  fs.writeFileSync(path.join(project, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/index.ts'), 'export {};\n');

  run(project, 'init');

  const config = JSON.parse(fs.readFileSync(path.join(project, '.agents/agent-config.json'), 'utf8'));
  assert.equal(config.runtime, 'pnpm');
  assert.equal(config.commands.lint, 'pnpm run lint');
  assert.deepEqual(new Set(config.routing[0].required), new Set(['unit', 'lint', 'typecheck']));
});

test('check rejects an invalid project-owned routing file', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-invalid-routing-'));
  run(project, 'init');
  const configFile = path.join(project, '.agents/agent-config.json');
  fs.writeFileSync(configFile, '{ definitely not json');

  assert.throws(() => run(project, 'check'));

  fs.writeFileSync(configFile, JSON.stringify({
    version: 1,
    commands: {},
    routing: [{ match: ['**/*.ts'], required: ['missing'] }]
  }));

  assert.throws(() => run(project, 'check'));
});

test('check rejects incomplete lock ownership metadata', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-invalid-lock-'));
  run(project, 'init');
  const lockFile = path.join(project, '.agents/agent-config.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.managedFiles = [];
  fs.writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);

  assert.throws(() => run(project, 'check'));
});

test('refuses to write through a symlinked managed target', {
  skip: process.platform === 'win32'
}, () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-symlink-'));
  run(project, 'init');
  const skill = path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md');
  const externalFile = path.join(os.tmpdir(), `agent-config-external-${crypto.randomUUID()}.md`);
  fs.writeFileSync(externalFile, 'project-external content');
  fs.unlinkSync(skill);
  fs.symlinkSync(externalFile, skill);

  assert.throws(() => run(project, 'sync'));
  assert.equal(fs.readFileSync(externalFile, 'utf8'), 'project-external content');
});

test('rejects unknown commands and accepts options before the command', () => {
  const unknown = spawnSync(process.execPath, [cli, 'synk'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.notEqual(unknown.status, 0);

  const conflictingScopes = spawnSync(process.execPath, [cli, 'status', '--user', '--project', root], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.notEqual(conflictingScopes.status, 0);

  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-option-order-'));
  const output = execFileSync(process.execPath, [cli, '--project', project, 'status'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.match(output, /Detected: runtime=/);
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
  assert.match(output, /Created \.agents[\\/]policy[\\/]vue-primevue\.md/);
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));

  const status = run(project, 'status');
  assert.match(status, /vue=true/);
  assert.match(status, /typescript=true/);
});
