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
const mattPocockSkills = [
  'ask-matt',
  'claude-handoff',
  'code-review',
  'codebase-design',
  'diagnosing-bugs',
  'domain-modeling',
  'git-guardrails-claude-code',
  'grill-me',
  'grill-with-docs',
  'grilling',
  'handoff',
  'implement',
  'implement-spec',
  'improve-codebase-architecture',
  'loop-me',
  'migrate-to-shoehorn',
  'prototype',
  'research',
  'resolving-merge-conflicts',
  'retro',
  'scaffold-exercises',
  'setup-matt-pocock-skills',
  'setup-pre-commit',
  'setup-ts-deep-modules',
  'tdd',
  'teach',
  'to-questionnaire',
  'to-spec',
  'to-tickets',
  'triage',
  'wait-what',
  'wayfinder',
  'wizard',
  'writing-beats',
  'writing-for-agents',
  'writing-fragments',
  'writing-shape'
];
const modelInvokedJakubKrehelSkills = [
  'better-accessibility',
  'better-colors',
  'better-interface',
  'better-layout',
  'better-typography',
  'better-ui',
  'better-writing'
];
const userInvokedJakubKrehelSkills = [
  'break',
  'explain-interface',
  'interface-review',
  'variant'
];
const jakubKrehelSkills = [
  ...modelInvokedJakubKrehelSkills,
  ...userInvokedJakubKrehelSkills
].sort();
const jakubKrehelLock = JSON.parse(fs.readFileSync(path.join(root, 'skills/jakubkrehel-skills.lock.json'), 'utf8'));
const policyPacks = fs.readdirSync(path.join(root, 'policy'))
  .filter((name) => name.endsWith('.md') && name !== 'shared-policy.md')
  .map((name) => name.slice(0, -'.md'.length))
  .sort();
const roleFiles = fs.readdirSync(path.join(root, 'agents'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.slice(0, -'.md'.length))
  .sort();
const sharedPolicySource = fs.readFileSync(path.join(root, 'policy/shared-policy.md'), 'utf8');
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
  assert.match(installedPolicy, /# Start here/);
  assert.match(installedPolicy, /~\/\.agents\/policy\/routing\.md/);
  assert.match(installedPolicy, /~\/\.agents\/policy\/orchestration\.md/);
  assert.doesNotMatch(installedPolicy, /# TypeScript standards/);
  const userAgentsMd = path.join(home, '.agents/AGENTS.md');
  assert.ok(fs.existsSync(userAgentsMd), 'missing ~/.agents/AGENTS.md');
  assert.equal(fs.readFileSync(userAgentsMd, 'utf8'), sharedPolicySource);
  assert.match(fs.readFileSync(userAgentsMd, 'utf8'), /~\/\.agents\/AGENTS\.md/);
  assert.ok(!fs.existsSync(path.join(home, '.agents/policy/shared-policy.md')));
  assert.deepEqual(policyPacks, ['domain-module', 'orchestration', 'react', 'routing', 'typescript', 'vue-primevue']);
  for (const pack of policyPacks) {
    const installedPack = path.join(home, '.agents/policy', `${pack}.md`);
    assert.ok(fs.existsSync(installedPack), `missing user pack ${pack}`);
    assert.equal(fs.readFileSync(installedPack, 'utf8'), fs.readFileSync(path.join(root, 'policy', `${pack}.md`), 'utf8'));
  }
  for (const role of roleFiles) {
    const installedRole = path.join(home, '.agents/agents', `${role}.md`);
    assert.ok(fs.existsSync(installedRole), `missing user role ${role}`);
    const installed = fs.readFileSync(installedRole, 'utf8');
    assert.match(installed, /^<!-- agent-config:managed -->\n/);
    assert.equal(
      installed.replace(/^<!-- agent-config:managed -->\n/, ''),
      fs.readFileSync(path.join(root, 'agents', `${role}.md`), 'utf8').replace(/\r\n/g, '\n')
    );
  }
  assert.match(fs.readFileSync(path.join(home, '.agents/policy/routing.md'), 'utf8'), /~\/\.agents\/policy\/orchestration\.md/);
  assert.match(fs.readFileSync(path.join(home, '.agents/policy/orchestration.md'), 'utf8'), /~\/\.agents\/agents\/orchestrator\.md/);

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
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/fullstack-typescript-quality/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/fullstack-typescript-quality/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/frontend-design/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/frontend-design/LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/frontend-design/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/figma-design-to-code/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/figma-design-to-code/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/frontend-design/EXAMPLES.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/complexity-audit/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/complexity-audit/references/typescript-before-after.md')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/complexity-audit/SKILL.md')));
  const installedRouting = fs.readFileSync(path.join(home, '.agents/policy/routing.md'), 'utf8');
  assert.match(installedRouting, /## 2\. Skill/);
  assert.match(installedRouting, /Exact visual spec:.*`figma-design-to-code`/s);
  assert.match(installedRouting, /Original UI:.*`frontend-design`/s);
  assert.match(installedRouting, /Complexity:.*`complexity-audit`/s);
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/tdd/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/tdd/tests.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/tdd/LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(home, '.claude/skills/tdd/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/setup-matt-pocock-skills/SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/writing-for-agents/SKILL-MECHANICS.md')));
  for (const name of mattPocockSkills) {
    assert.ok(fs.existsSync(path.join(home, '.agents/skills', name, 'SKILL.md')), `missing user skill ${name}`);
    assert.ok(fs.existsSync(path.join(home, '.claude/skills', name, 'SKILL.md')), `missing claude skill ${name}`);
  }
  for (const name of jakubKrehelSkills) {
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

  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /# Start here/);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /~\/\.agents\/policy\/routing\.md/);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /~\/\.agents\/policy\/orchestration\.md/);
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /vue-primevue\.md/);
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/routing.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/orchestration.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/shared-policy.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/AGENTS.md')));
  for (const role of roleFiles) {
    assert.ok(fs.existsSync(path.join(project, '.agents/agents', `${role}.md`)), `missing project role ${role}`);
  }
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/typescript.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/policy/vue-primevue.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/react.md')));
  assert.ok(!fs.existsSync(path.join(project, '.agents/policy/domain-module.md')));
  assert.ok(!fs.existsSync(path.join(project, '.cursor/rules/30-agent-config-vue-primevue.mdc')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/fullstack-typescript-quality/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/frontend-design/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/frontend-design/LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/figma-design-to-code/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/frontend-design/EXAMPLES.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/complexity-audit/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/complexity-audit/references/typescript-before-after.md')));
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /## 2\. Skill/);
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /Exact visual spec:.*`figma-design-to-code`/s);
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /Original UI:.*`frontend-design`/s);
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/routing.md'), 'utf8'), /Complexity:.*`complexity-audit`/s);
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/tdd/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/tdd/tests.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/grilling/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.agents/skills/wizard/template.sh')));
  for (const name of jakubKrehelSkills) {
    assertInstalledSkillTree(path.join(project, '.agents/skills'), name);
  }
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

  fs.rmSync(path.join(project, '.agents/agents/coder.md'));
  assert.throws(() => run(project, 'check'));
  run(project, 'sync');
  run(project, 'check');
});

test('role files are self-contained and the router chain resolves to them', () => {
  const routing = fs.readFileSync(path.join(root, 'policy/routing.md'), 'utf8');
  const orchestration = fs.readFileSync(path.join(root, 'policy/orchestration.md'), 'utf8');
  assert.match(routing, /~\/\.agents\/policy\/orchestration\.md/);
  assert.doesNotMatch(orchestration, /## Workflow graph|Skill router|Topic router/);
  for (const role of roleFiles) {
    assert.match(orchestration, new RegExp(`~/\\.agents/agents/${role}\\.md`));
    const contents = fs.readFileSync(path.join(root, 'agents', `${role}.md`), 'utf8');
    assert.match(contents, /^Models, in order: /m, `${role} lacks a model fallback list`);
    assert.match(contents, /## Inputs/);
    assert.match(contents, /## Output|## Handoffs received/);
    assert.match(contents, /## Exit/);
    assert.doesNotMatch(contents, /`\.agents\/(policy|agents|skills)\//, `${role} uses a project-relative path`);
  }
  const orchestrator = fs.readFileSync(path.join(root, 'agents/orchestrator.md'), 'utf8');
  assert.match(orchestrator, /## Workflow graph/);
  assert.match(orchestrator, /## Win condition/);
  assert.match(orchestrator, /Read `~\/\.agents\/agents\/<role>\.md`/);
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

test('vendors Matt Pocock skills with licenses and supporting files', () => {
  const originalSkills = new Set([
    'complexity-audit',
    'frontend-design',
    'figma-design-to-code',
    'fullstack-typescript-quality',
    'fullstack-typescript-static',
    'fullstack-typescript-tests',
    'fullstack-typescript-mutation'
  ]);
  const discovered = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !originalSkills.has(entry.name) && !jakubKrehelSkills.includes(entry.name))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(discovered, [...mattPocockSkills]);

  for (const name of mattPocockSkills) {
    const skillDirectory = path.join(root, 'skills', name);
    assert.ok(fs.existsSync(path.join(skillDirectory, 'SKILL.md')), `missing ${name}/SKILL.md`);
    const license = fs.readFileSync(path.join(skillDirectory, 'LICENSE.txt'), 'utf8');
    assert.match(license, /Copyright \(c\) 2026 Matt Pocock/);
  }

  assert.ok(fs.existsSync(path.join(root, 'skills/tdd/tests.md')));
  assert.ok(fs.existsSync(path.join(root, 'skills/tdd/mocking.md')));
  assert.ok(fs.existsSync(path.join(root, 'skills/writing-for-agents/SKILL-MECHANICS.md')));
  assert.ok(fs.existsSync(path.join(root, 'skills/codebase-design/DEEPENING.md')));
  assert.ok(fs.existsSync(path.join(root, 'skills/wizard/template.sh')));
  assert.ok(fs.existsSync(path.join(root, 'skills/diagnosing-bugs/scripts/hitl-loop.template.sh')));
  assert.ok(fs.existsSync(path.join(root, 'skills/setup-ts-deep-modules/dependency-cruiser.config.cjs')));
});

test('locks every vendored Jakub Krehel file and license to its upstream commit', () => {
  assert.equal(jakubKrehelLock.version, 1);
  assert.equal(jakubKrehelLock.source, 'https://github.com/jakubkrehel/skills');
  assert.equal(jakubKrehelLock.commit, '267330e1adfc66a718fb65fa6918c1f06d0a689e');
  assert.equal(jakubKrehelLock.license.sourcePath, 'LICENSE');
  assert.equal(jakubKrehelLock.license.installedAs, 'LICENSE.txt');
  assert.deepEqual(Object.keys(jakubKrehelLock.skills).sort(), jakubKrehelSkills);

  let canonicalLicense;
  for (const name of jakubKrehelSkills) {
    const skillDirectory = path.join(root, 'skills', name);
    const lockedSkill = jakubKrehelLock.skills[name];
    assert.equal(lockedSkill.upstreamPath, `skills/${name}`);
    const lockedFiles = Object.keys(lockedSkill.files).map((file) => file.split(/[\\\\/]/).join('/')).sort();
    const installedFiles = listFiles(skillDirectory)
      .map((file) => file.split(path.sep).join('/'))
      .sort();
    assert.deepEqual(
      installedFiles,
      [...lockedFiles, jakubKrehelLock.license.installedAs].sort(),
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

    const licenseFile = path.join(skillDirectory, jakubKrehelLock.license.installedAs);
    assert.equal(
      normalizedContentSha256(licenseFile),
      jakubKrehelLock.license.normalizedSha256,
      `license drifted for ${name}`
    );
    canonicalLicense ??= normalizedContent(licenseFile);
    assert.equal(normalizedContent(licenseFile), canonicalLicense, `license content differs for ${name}`);
  }
});

test('keeps Jakub Krehel model and user invocation boundaries', () => {
  for (const name of modelInvokedJakubKrehelSkills) {
    const skill = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const openAiMetadata = fs.readFileSync(path.join(root, 'skills', name, 'agents/openai.yaml'), 'utf8');
    assert.equal((skill.match(/^disable-model-invocation: true$/gm) ?? []).length, 0, `${name} must remain model-invoked`);
    assert.equal((openAiMetadata.match(/^\s*allow_implicit_invocation: false$/gm) ?? []).length, 0, `${name} must allow implicit invocation`);
  }

  for (const name of userInvokedJakubKrehelSkills) {
    const skill = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const openAiMetadata = fs.readFileSync(path.join(root, 'skills', name, 'agents/openai.yaml'), 'utf8');
    assert.equal((skill.match(/^disable-model-invocation: true$/gm) ?? []).length, 1, `${name} must remain user-invoked`);
    assert.equal((openAiMetadata.match(/^\s*allow_implicit_invocation: false$/gm) ?? []).length, 1, `${name} must reject implicit invocation`);
  }
});

test('routes interface skills at precise task and role boundaries', () => {
  const routing = fs.readFileSync(path.join(root, 'policy/routing.md'), 'utf8');
  const planner = fs.readFileSync(path.join(root, 'agents/planner.md'), 'utf8');
  const coder = fs.readFileSync(path.join(root, 'agents/coder.md'), 'utf8');
  const reviewer = fs.readFileSync(path.join(root, 'agents/reviewer.md'), 'utf8');

  const focusedSkills = modelInvokedJakubKrehelSkills.filter((name) => name !== 'better-interface');
  for (const route of [
    /- Cross-discipline audit of an existing screen, flow, or repository → `better-interface`\./,
    /- Semantic HTML, keyboard or focus behaviour, forms, or assistive technology → `better-accessibility`\./,
    /- Palettes, color tokens or formats, or measured contrast → `better-colors`\./,
    /- Grouping, alignment, spacing, responsive structure, or spatial RTL → `better-layout`\./,
    /- Type systems, fonts, wrapping, truncation, or rendered text → `better-typography`\./,
    /- Surfaces, icons, visual polish, or optional motion → `better-ui`\./,
    /- Product copy, labels, errors, empty states, voice, or terminology → `better-writing`\./
  ]) assert.match(routing, route);
  assert.match(routing, /`better-interface` owns review orchestration only; implementation and remediation route to the focused/s);
  assert.match(routing, /A branch, pull request, commit range, or working-tree review.*starts only when the user explicitly invokes `interface-review`.*hands the cross-discipline audit to `better-interface`/s);
  assert.match(routing, /`break`, `explain-interface`, `interface-review`, and `variant` are explicitly user-invoked/);
  assert.match(routing, /`frontend-design` remains the.*original visual direction or substantial redesign/s);
  assert.match(routing, /`figma-design-to-code` remains the.*faithful implementation of a supplied.*Figma node or other exact visual spec/s);

  for (const name of focusedSkills) {
    const exactPath = `~/.agents/skills/${name}/SKILL.md`;
    assert.ok(planner.includes(exactPath), `planner does not load ${exactPath}`);
    assert.ok(coder.includes(exactPath), `coder does not load ${exactPath}`);
    assert.ok(reviewer.includes(exactPath), `reviewer does not load ${exactPath}`);
  }
  assert.doesNotMatch(planner, /skills\/better-interface\/SKILL\.md/);
  assert.doesNotMatch(coder, /skills\/better-interface\/SKILL\.md/);
  assert.match(reviewer, /skills\/better-interface\/SKILL\.md.*screen, flow, or repository.*interface-review.*hands off/s);
  assert.match(coder, /skills\/break\/SKILL\.md.*skills\/variant\/SKILL\.md.*only when the user explicitly invokes/s);
  assert.doesNotMatch(planner, /skills\/(break|variant)\/SKILL\.md/);
  assert.doesNotMatch(reviewer, /skills\/(break|variant)\/SKILL\.md/);
  assert.match(reviewer, /skills\/interface-review\/SKILL\.md.*only when the user explicitly invokes/s);
  assert.doesNotMatch(planner, /skills\/interface-review\/SKILL\.md/);
  assert.doesNotMatch(coder, /skills\/interface-review\/SKILL\.md/);
  for (const role of [planner, coder, reviewer]) {
    assert.doesNotMatch(role, /skills\/explain-interface/);
  }
});

test('frontend skills keep distinct triggers and required completion contracts', () => {
  const frontendSkill = fs.readFileSync(path.join(root, 'skills/frontend-design/SKILL.md'), 'utf8');
  const figmaSkill = fs.readFileSync(path.join(root, 'skills/figma-design-to-code/SKILL.md'), 'utf8');
  const examples = fs.readFileSync(path.join(root, 'skills/frontend-design/EXAMPLES.md'), 'utf8');
  const routing = fs.readFileSync(path.join(root, 'policy/routing.md'), 'utf8');

  assert.match(frontendSkill, /without a supplied source-of-truth design/);
  assert.match(frontendSkill, /existing design system.*rather than replacing it/s);
  assert.match(frontendSkill, /screenshots at representative narrow and wide viewports/);
  assert.match(frontendSkill, /\[EXAMPLES\.md\]\(EXAMPLES\.md\)/);

  assert.match(figmaSkill, /supplied Figma node/);
  assert.match(figmaSkill, /other exact visual spec/);
  assert.match(figmaSkill, /structured design context before editing code/);
  assert.match(figmaSkill, /Reuse matching components, tokens, icons, and assets/);
  assert.match(figmaSkill, /visually compared with the spec at the reference viewport/);

  assert.match(examples, /Origin UI/);
  assert.match(examples, /Sakai Vue/);
  assert.match(examples, /Every Layout/);

  assert.match(routing, /## 2\. Skill/);
  assert.match(routing, /Exact visual spec:.*`figma-design-to-code`/s);
  assert.match(routing, /Original UI:.*`frontend-design`/s);
  assert.match(routing, /Complexity:.*`complexity-audit`/s);
});

test('complexity-audit requires tool metrics and behaviour-preserving reduction', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/complexity-audit/SKILL.md'), 'utf8');
  const examples = fs.readFileSync(
    path.join(root, 'skills/complexity-audit/references/typescript-before-after.md'),
    'utf8'
  );
  const typescriptPolicy = fs.readFileSync(path.join(root, 'policy/typescript.md'), 'utf8');

  assert.match(skill, /Hand-counting `if`s is a last resort/);
  assert.match(skill, /improve-codebase-architecture/);
  assert.match(skill, /Guard clauses/);
  assert.match(skill, /deletion test/);
  assert.match(skill, /Persistent ESLint complexity gates are required by `fullstack-typescript-static`/);
  assert.match(examples, /function submit/);
  assert.match(typescriptPolicy, /`complexity-audit`/);
});

test('fullstack-typescript-static requires persistent complexity gates', () => {
  const staticSkill = fs.readFileSync(path.join(root, 'skills/fullstack-typescript-static/SKILL.md'), 'utf8');
  const qualitySkill = fs.readFileSync(path.join(root, 'skills/fullstack-typescript-quality/SKILL.md'), 'utf8');

  assert.match(staticSkill, /Cyclomatic complexity under 22 \(`complexity` with `max: 21`\)/);
  assert.match(qualitySkill, /Branch count.*`fullstack-typescript-static`.*`complexity-audit`/s);
  assert.match(qualitySkill, /Sibling owners were loaded and their gates applied/);
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
  assert.match(fs.readFileSync(path.join(project, '.agents/policy/react.md'), 'utf8'), /shadcn\/ui/);
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

  assert.ok(fs.existsSync(path.join(project, '.agents/policy/orchestration.md')));
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
