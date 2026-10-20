import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalTemporaryDirectory = fs.realpathSync(os.tmpdir());
const cli = path.join(root, 'bin/agent-config.mjs');
const keptSkills = [
  'agent-browser',
  'fullstack-typescript-mutation',
  'fullstack-typescript-quality',
  'fullstack-typescript-static',
  'fullstack-typescript-tests',
  'manual-qa'
];
const agentBrowserSkills = ['agent-browser'];
const agentBrowserLock = JSON.parse(fs.readFileSync(path.join(root, 'skills/agent-browser-skills.lock.json'), 'utf8'));
const policyPacks = fs.readdirSync(path.join(root, 'policy'))
  .filter((name) => name.endsWith('.md') && name !== 'shared-policy.md')
  .map((name) => name.slice(0, -'.md'.length))
  .sort();
const sharedPolicySource = fs.readFileSync(path.join(root, 'policy/shared-policy.md'), 'utf8');
const run = (project, ...args) => execFileSync(process.execPath, [cli, ...args, '--project', project], {
  cwd: root,
  encoding: 'utf8'
});
const userEnvironment = (home) => {
  // Node's os.homedir() prefers USERPROFILE on Windows and ignores HOME.
  const environment = { ...process.env, HOME: home, USERPROFILE: home, AGENT_CONFIG_EXTERNAL_PLUGINS: 'skip' };
  delete environment.CODEX_HOME;
  return environment;
};
const runUser = (home, ...args) => execFileSync(process.execPath, [cli, ...args, '--user'], {
  cwd: root,
  encoding: 'utf8',
  env: userEnvironment(home)
});
const listFiles = (directory, relativeDirectory = '') => fs.readdirSync(path.join(directory, relativeDirectory), {
  withFileTypes: true
}).flatMap((entry) => {
  const relativePath = path.join(relativeDirectory, entry.name);
  return entry.isDirectory() ? listFiles(directory, relativePath) : [relativePath];
}).sort();
const assertInstalledSkillTree = (installationRoot, name) => {
  const source = path.join(root, 'skills', name);
  const destination = path.join(installationRoot, name);
  assert.deepEqual(listFiles(destination), listFiles(source), `incomplete installed skill ${name}`);
  for (const file of listFiles(source)) {
    assert.equal(
      fs.readFileSync(path.join(destination, file), 'utf8'),
      fs.readFileSync(path.join(source, file), 'utf8'),
      `stale installed skill file ${name}/${file}`
    );
  }
};
const normalizedContent = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const normalizedContentSha256 = (file) => crypto.createHash('sha256')
  .update(normalizedContent(file))
  .digest('hex');

test('installs one personal policy across Codex, Claude Code, and Cursor', () => {
  const home = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-user-'));
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
  assert.match(installedPolicy, /# Start here/);
  assert.match(installedPolicy, /~\/\.agents\/policy\/routing\.md/);
  assert.match(installedPolicy, /~\/\.agents\/skills\/manual-qa\/SKILL\.md/);
  assert.doesNotMatch(installedPolicy, /orchestration\.md/);
  assert.doesNotMatch(installedPolicy, /# TypeScript standards/);
  const userAgentsMd = path.join(home, '.agents/AGENTS.md');
  assert.ok(fs.existsSync(userAgentsMd), 'missing ~/.agents/AGENTS.md');
  assert.equal(fs.readFileSync(userAgentsMd, 'utf8'), sharedPolicySource);
  assert.match(fs.readFileSync(userAgentsMd, 'utf8'), /~\/\.agents\/AGENTS\.md/);
  assert.ok(!fs.existsSync(path.join(home, '.agents/policy/shared-policy.md')));
  assert.deepEqual(policyPacks, ['domain-module', 'react', 'routing', 'typescript', 'vue-primevue']);
  for (const pack of policyPacks) {
    const installedPack = path.join(home, '.agents/policy', `${pack}.md`);
    assert.ok(fs.existsSync(installedPack), `missing user pack ${pack}`);
    assert.equal(fs.readFileSync(installedPack, 'utf8'), fs.readFileSync(path.join(root, 'policy', `${pack}.md`), 'utf8'));
  }
  assert.ok(!fs.existsSync(path.join(home, '.agents/policy/orchestration.md')));
  assert.ok(!fs.existsSync(path.join(home, '.agents/agents')));
  assert.match(fs.readFileSync(path.join(home, '.agents/policy/routing.md'), 'utf8'), /Implemented runnable UI, API, or CLI change → `manual-qa`/);
  assert.match(fs.readFileSync(path.join(home, '.agents/skills/manual-qa/SKILL.md'), 'utf8'), /Hands-on verification of a running surface/);

  const installedClaudePolicy = fs.readFileSync(claudePolicy, 'utf8');
  assert.match(installedClaudePolicy, /Existing Claude preference/);
  assert.ok(installedClaudePolicy.includes(`@${userAgentsMd}`));

  const cursorPlugin = path.join(home, '.cursor/plugins/local/agent-config');
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(cursorPlugin, '.cursor-plugin/plugin.json'), 'utf8')),
    {
      name: 'agent-config',
      version: '1.0.0',
      description: 'Personal cross-harness agent policy bridge.'
    }
  );
  assert.match(fs.readFileSync(path.join(cursorPlugin, 'rules/00-agent-config.mdc'), 'utf8'), /~\/\.agents\/AGENTS\.md/);
  const installedRouting = fs.readFileSync(path.join(home, '.agents/policy/routing.md'), 'utf8');
  assert.match(installedRouting, /## 2\. Skill/);
  assert.match(installedRouting, /TypeScript quality-tooling work → `fullstack-typescript-quality`/);
  for (const name of keptSkills) {
    assertInstalledSkillTree(path.join(home, '.agents/skills'), name);
    assertInstalledSkillTree(path.join(home, '.claude/skills'), name);
  }

  assert.doesNotThrow(() => runUser(home, 'check'));
  fs.rmSync(userAgentsMd);
  assert.throws(() => runUser(home, 'check'));
  runUser(home, 'sync');
  assert.equal(fs.readFileSync(userAgentsMd, 'utf8'), sharedPolicySource);
  assert.match(fs.readFileSync(codexPolicy, 'utf8'), /Existing Codex preference/);
  assert.doesNotThrow(() => runUser(home, 'check'));
});

test('preserves colliding user-level standalone files', () => {
  const home = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-user-collision-'));
  const cursorRule = path.join(home, '.cursor/plugins/local/agent-config/rules/00-agent-config.mdc');
  fs.mkdirSync(path.dirname(cursorRule), { recursive: true });
  fs.writeFileSync(cursorRule, '# My existing Cursor rule\n');

  assert.throws(() => runUser(home, 'init'));
  assert.equal(fs.readFileSync(cursorRule, 'utf8'), '# My existing Cursor rule\n');
});

test('honours a custom Codex home for the canonical user policy', () => {
  const home = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-user-custom-home-'));
  const codexHome = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-codex-home-'));
  const environment = { ...userEnvironment(home), CODEX_HOME: codexHome };

  execFileSync(process.execPath, [cli, 'init', '--user'], {
    cwd: root,
    encoding: 'utf8',
    env: environment
  });

  const canonicalPolicy = path.join(codexHome, 'AGENTS.md');
  const userAgentsMd = path.join(home, '.agents/AGENTS.md');
  assert.ok(fs.existsSync(canonicalPolicy));
  assert.equal(fs.readFileSync(userAgentsMd, 'utf8'), sharedPolicySource);
  assert.ok(fs.readFileSync(path.join(home, '.claude/CLAUDE.md'), 'utf8').includes(`@${userAgentsMd}`));
  assert.doesNotThrow(() => execFileSync(process.execPath, [cli, 'check', '--user'], {
    cwd: root,
    encoding: 'utf8',
    env: environment
  }));
});

test('refuses to write through a symlinked user configuration path', {
  skip: process.platform === 'win32'
}, () => {
  const home = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-user-symlink-'));
  const external = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-user-external-'));
  fs.symlinkSync(external, path.join(home, '.agents'));

  assert.throws(() => runUser(home, 'init'));
  assert.deepEqual(fs.readdirSync(external), []);
});

test('initialises a Vue TypeScript workspace and preserves project-owned routing', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-vue-'));
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

  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /# Start here/);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /~\/\.agents\/policy\/routing\.md/);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /~\/\.agents\/skills\/manual-qa\/SKILL\.md/);
  assert.doesNotMatch(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /orchestration\.md/);
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /vue-primevue\.md/);
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/routing.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/orchestration.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/agents')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/shared-policy.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/AGENTS.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/manual-qa/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
  assert.ok(!fs.existsSync(path.join(project, '.cursor/rules/30-agent-config-vue-primevue.mdc')));
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /## 2\. Skill/);
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /TypeScript quality-tooling work → `fullstack-typescript-quality`/);
  for (const name of keptSkills) {
    assertInstalledSkillTree(path.join(project, '.agents/skills'), name);
  }
  assert.match(fs.readFileSync(path.join(project, '.prettierignore'), 'utf8'), /# agent-config:begin prettier-ignore/);
  assert.match(fs.readFileSync(path.join(project, '.prettierignore'), 'utf8'), /\.agents\//);

  const configPath = path.join(project, '.agents/agent-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.commands.component, 'npm run test:component');
  assert.equal(config.commands.fast, 'npm run verify:fast');
  assert.ok(!fs.existsSync(path.join(project, '.agents/scripts/agent-check.mjs')));

  fs.writeFileSync(configPath, JSON.stringify({ version: 1, commands: { fast: 'custom fast' }, routing: [{ match: ['**/*'], required: ['fast'] }] }, null, 2));
  run(project, 'sync');
  assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).commands.fast, 'custom fast');

  run(project, 'check');

  fs.rmSync(path.join(project, '.agents/skills/manual-qa/SKILL.md'));
  assert.throws(() => run(project, 'check'));
  run(project, 'sync');
  run(project, 'check');
});

test('routing and shared policy resolve without role files', () => {
  const routing = fs.readFileSync(path.join(root, 'policy/routing.md'), 'utf8');
  const sharedPolicy = fs.readFileSync(path.join(root, 'policy/shared-policy.md'), 'utf8');
  assert.match(routing, /~\/\.agents\/policy\/typescript\.md/);
  assert.doesNotMatch(routing, /orchestration\.md/);
  assert.doesNotMatch(sharedPolicy, /orchestration\.md/);
  assert.match(sharedPolicy, /~\/\.agents\/skills\/manual-qa\/SKILL\.md/);
  assert.match(routing, /Implemented runnable UI, API, or CLI change → `manual-qa`/);
  assert.match(routing, /Browser automation → `agent-browser`/);
  assert.match(routing, /TypeScript quality-tooling work → `fullstack-typescript-quality`/);
  assert.doesNotMatch(routing, /## 3\. Topic and evidence/);
  assert.doesNotMatch(sharedPolicy, /Non-coding task → answer/);
  assert.doesNotMatch(routing, /### Explicit workflows/);
  assert.doesNotMatch(sharedPolicy, /When `tdd` is routed/);
  assert.match(sharedPolicy, /When `GLOSSARY.md` or `GLOSSARY-MAP.md` exists, read the entries for this task/);
  assert.ok(!fs.existsSync(path.join(root, 'policy/orchestration.md')));
  assert.ok(!fs.existsSync(path.join(root, 'agents')));
  const manualQa = fs.readFileSync(path.join(root, 'skills/manual-qa/SKILL.md'), 'utf8');
  assert.match(manualQa, /^description:/m);
  assert.doesNotMatch(manualQa, /^disable-model-invocation: true$/m);
  assert.match(manualQa, /~\/\.agents\/skills\/agent-browser\/SKILL\.md/);
  assert.match(manualQa, /React inspection/);
  assert.match(manualQa, /Web Vitals/);
  assert.match(manualQa, /profiler/);
  assert.match(manualQa, /hunting regressions/);
});

test('preserves an unmanaged AGENTS.md instead of overwriting it', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-safe-'));
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project guidance\n');

  assert.throws(() => run(project, 'init'));
  assert.equal(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), '# Existing project guidance\n');
});

test('runs from a source checkout path containing spaces', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent config source-'));
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
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-collision-'));
  const collision = path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md');
  fs.mkdirSync(path.dirname(collision), { recursive: true });
  fs.writeFileSync(collision, '// Project-owned implementation\n');

  assert.throws(() => run(project, 'init'));
  assert.equal(fs.readFileSync(collision, 'utf8'), '// Project-owned implementation\n');

  assert.throws(() => run(project, 'sync'));
  assert.equal(fs.readFileSync(collision, 'utf8'), '// Project-owned implementation\n');
});

test('ships only the kept portable skills', () => {
  const discovered = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(discovered, keptSkills);
  for (const name of keptSkills) {
    assert.ok(fs.existsSync(path.join(root, 'skills', name, 'SKILL.md')), `missing ${name}/SKILL.md`);
  }
  const lockfiles = fs.readdirSync(path.join(root, 'skills')).filter((name) => name.endsWith('.lock.json'));
  assert.deepEqual(lockfiles, ['agent-browser-skills.lock.json']);
});

test('locks the vendored agent-browser discovery skill and license to its upstream commit', () => {
  assert.equal(agentBrowserLock.version, 1);
  assert.equal(agentBrowserLock.source, 'https://github.com/vercel-labs/agent-browser');
  assert.equal(agentBrowserLock.commit, '72007a6788d863611b23bed0b59d0d659c638d8e');
  assert.equal(agentBrowserLock.license.sourcePath, 'LICENSE');
  assert.equal(agentBrowserLock.license.installedAs, 'LICENSE.txt');
  assert.deepEqual(Object.keys(agentBrowserLock.skills).sort(), agentBrowserSkills);

  for (const name of agentBrowserSkills) {
    const skillDirectory = path.join(root, 'skills', name);
    const lockedSkill = agentBrowserLock.skills[name];
    assert.equal(lockedSkill.upstreamPath, `skills/${name}`);
    const lockedFiles = Object.keys(lockedSkill.files).map((file) => file.split(/[\\\\/]/).join('/')).sort();
    const installedFiles = listFiles(skillDirectory)
      .map((file) => file.split(path.sep).join('/'))
      .sort();
    assert.deepEqual(
      installedFiles,
      [...lockedFiles, agentBrowserLock.license.installedAs].sort(),
      `vendored inventory drifted for ${name}`
    );

    for (const file of lockedFiles) {
      const lockedFileKey = Object.keys(lockedSkill.files).find((key) => key.split(/[\\\\/]/).join('/') === file);
      assert.equal(
        normalizedContentSha256(path.join(skillDirectory, file)),
        lockedSkill.files[lockedFileKey],
        `vendored content drifted for ${name}/${file}`
      );
    }

    const licenseFile = path.join(skillDirectory, agentBrowserLock.license.installedAs);
    assert.equal(
      normalizedContentSha256(licenseFile),
      agentBrowserLock.license.normalizedSha256,
      `license drifted for ${name}`
    );
    assert.match(fs.readFileSync(path.join(skillDirectory, 'SKILL.md'), 'utf8'), /agent-browser skills get core/);
    assert.doesNotMatch(fs.readFileSync(path.join(skillDirectory, 'SKILL.md'), 'utf8'), /^disable-model-invocation: true$/m);
  }
});

test('routing registers every kept skill', () => {
  const routing = fs.readFileSync(path.join(root, 'policy/routing.md'), 'utf8');
  const skillsSection = routing.split('## 2. Skills')[1].split(/^## /m)[0];
  const skillNames = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const externalUiSkills = [
    'animation-performance',
    'animation-vocabulary',
    'animate',
    'break-ui',
    'design-taste-frontend',
    'emil-design-eng',
    'find-animation-opportunities',
    'improve-animations',
    'review-animations'
  ];
  const registered = new Set([...skillsSection.matchAll(/`([a-z][a-z0-9-]+)`/g)].map((match) => match[1]));
  assert.deepEqual([...registered].sort(), [...skillNames, ...externalUiSkills].sort());
  for (const name of skillNames) {
    const skill = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const metadataPath = path.join(root, 'skills', name, 'agents/openai.yaml');
    const metadata = fs.existsSync(metadataPath) ? fs.readFileSync(metadataPath, 'utf8') : '';
    assert.equal(/^disable-model-invocation: true$/m.test(skill), false, `${name} stays model-invoked`);
    assert.equal(/allow_implicit_invocation:\s*false/.test(metadata), false, `${name} stays implicitly invocable`);
  }
});

test('fullstack-typescript-static requires persistent complexity gates', () => {
  const staticSkill = fs.readFileSync(path.join(root, 'skills/fullstack-typescript-static/SKILL.md'), 'utf8');
  const qualitySkill = fs.readFileSync(path.join(root, 'skills/fullstack-typescript-quality/SKILL.md'), 'utf8');
  const typescriptPolicy = fs.readFileSync(path.join(root, 'policy/typescript.md'), 'utf8');

  assert.match(staticSkill, /Cyclomatic complexity under 22 \(`complexity` with `max: 21`\)/);
  assert.match(qualitySkill, /Branch count \| ESLint complexity gates \| `fullstack-typescript-static` \|/);
  assert.doesNotMatch(qualitySkill, /complexity-audit/);
  assert.doesNotMatch(typescriptPolicy, /complexity-audit/);
  assert.match(qualitySkill, /Sibling owners were loaded and their gates applied/);
});

test('preserves a colliding project-owned lock file', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-lock-collision-'));
  const lock = path.join(project, '.agents/agent-config.lock.json');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, JSON.stringify({ projectOwned: true }, null, 2));

  assert.throws(() => run(project, 'init'));
  assert.deepEqual(JSON.parse(fs.readFileSync(lock, 'utf8')), { projectOwned: true });
});

test('does not mistake a similarly named prettier-ignore block for its own', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-prettier-collision-'));
  const prettierIgnore = path.join(project, '.prettierignore');
  fs.writeFileSync(prettierIgnore, '# agent-config:begin prettier-ignore-custom\nKEEP-ME\n# agent-config:end prettier-ignore-custom\n');

  assert.throws(() => run(project, 'init'));
  assert.match(fs.readFileSync(prettierIgnore, 'utf8'), /KEEP-ME/);
});

test('migrates lock-owned legacy Cursor rules to shared policy packs', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-legacy-rules-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { vue: '^3.5.0' },
    devDependencies: { typescript: '^5.0.0' },
    scripts: { test: 'node --test' }
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
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-unowned-legacy-'));
  const legacyRule = path.join(project, '.cursor/rules/10-agent-config-typescript.mdc');
  fs.mkdirSync(path.dirname(legacyRule), { recursive: true });
  fs.writeFileSync(legacyRule, '# Project-owned legacy rule\n');

  run(project, 'init');

  assert.equal(fs.readFileSync(legacyRule, 'utf8'), '# Project-owned legacy rule\n');
});

test('preserves matching legacy content when the lock lacks a complete trusted shape', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-partial-lock-'));
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
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-pnpm-'));
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

test('routes module extensions, tests, root tooling and package-local React through real gates', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-file-routing-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ scripts: {
    typecheck: 'tsc --noEmit', test: 'node --test', build: 'vite build', 'verify:full': 'npm test'
  } }));
  fs.writeFileSync(path.join(project, 'tool.cts'), 'export {};\n');
  fs.mkdirSync(path.join(project, 'packages/web/src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'packages/web/package.json'), JSON.stringify({ dependencies: { react: '*' } }));
  for (const file of ['module.mts', 'module.test.ts', 'App.tsx']) {
    fs.writeFileSync(path.join(project, 'packages/web/src', file), 'export {};\n');
  }
  run(project, 'init');
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/react.md')));
  const config = JSON.parse(fs.readFileSync(path.join(project, '.agents/agent-config.json'), 'utf8'));
  const typescript = config.routing.find((route) => route.match.includes('**/*.mts'));
  assert.ok(typescript, 'MTS must have a TypeScript verification route');
  assert.ok(typescript.match.includes('**/*.cts'));
  assert.ok(!typescript.except, 'test files must retain TypeScript checks');
  const baseline = config.routing.find((route) => route.match.includes('**/*'));
  assert.ok(baseline.required.includes('full'), 'the full gate must be required when available');
  run(project, 'check');
  config.routing = [];
  fs.writeFileSync(path.join(project, '.agents/agent-config.json'), JSON.stringify(config));
  assert.throws(() => run(project, 'check'), /No required verification.*tool\.cts/s);
});

test('check rejects removed package scripts and identifies unverified custom commands', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-script-validation-'));
  const manifest = path.join(project, 'package.json');
  fs.writeFileSync(manifest, JSON.stringify({ scripts: { typecheck: 'tsc --noEmit', test: 'node --test' } }));
  fs.writeFileSync(path.join(project, 'module.ts'), 'export {};\n');
  run(project, 'init');
  run(project, 'check');
  fs.writeFileSync(manifest, JSON.stringify({ scripts: { test: 'node --test' } }));
  assert.throws(() => run(project, 'check'), /missing package script.*typecheck/s);
  fs.writeFileSync(manifest, JSON.stringify({ scripts: { typecheck: 'tsc --noEmit', test: 'node --test' } }));
  const configFile = path.join(project, '.agents/agent-config.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.commands.typecheck = 'custom-check-types';
  fs.writeFileSync(configFile, JSON.stringify(config));
  const checked = spawnSync(process.execPath, [cli, 'check', '--project', project], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stderr, /Unverified command.*custom-check-types/);
});

test('check rejects an invalid project-owned routing file', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-invalid-routing-'));
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
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-invalid-lock-'));
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
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-symlink-'));
  run(project, 'init');
  const skill = path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md');
  const externalFile = path.join(canonicalTemporaryDirectory, `agent-config-external-${crypto.randomUUID()}.md`);
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

  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-option-order-'));
  const output = execFileSync(process.execPath, [cli, '--project', project, 'status'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.match(output, /Detected: runtime=/);
});

test('installs React guidance only when React source exists', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-react-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/App.tsx'), 'export const App = () => <main />;\n');

  run(project, 'init');

  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/react.md'), 'utf8'), /shadcn\/ui/);
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
});

test('does not install framework packs from dependencies alone', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-no-framework-source-'));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    dependencies: { react: '^19.0.0', vue: '^3.5.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/index.js'), 'console.log("no framework source");\n');

  run(project, 'init');

  assert.ok(fs.existsSync(path.join(project, '.agents/policy/routing.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
});

test('detects Vue TypeScript source under apps/ monorepo layouts', () => {
  const project = fs.mkdtempSync(path.join(canonicalTemporaryDirectory, 'agent-config-apps-mono-'));
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
