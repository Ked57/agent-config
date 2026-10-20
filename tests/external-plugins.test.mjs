import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  agentsSkill,
  claudeSkill,
  commandsFor,
  cursorPluginDestination,
  cursorSkill,
  externalPlugins,
  formatPlugin,
  installExternalPlugins,
  placeInstalledSkills,
  publishCursorLocalPlugin
} from '../bin/external-plugins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin/agent-config.mjs');
const byId = (id) => externalPlugins.filter((entry) => entry.id === id);

test('external plugins cover each supported harness and leave pstack off Codex', () => {
  assert.deepEqual(byId('taste-skill').map((entry) => entry.harness), ['claude', 'codex', 'cursor']);
  assert.equal(byId('emilkowalski-ui')[0].harness, 'cursor,claude,codex');
  assert.deepEqual(byId('mattpocock-skills').map((entry) => entry.harness), ['claude', 'codex', 'cursor']);
  assert.deepEqual(byId('pstack').map((entry) => entry.harness), ['claude', 'cursor']);
  const emil = byId('emilkowalski-ui')[0];
  assert.deepEqual(emil.skills, [
    'emil-design-eng',
    'break-ui',
    'animate',
    'animation-performance',
    'animation-vocabulary',
    'find-animation-opportunities',
    'improve-animations',
    'review-animations'
  ]);
  assert.equal(byId('taste-skill').find((entry) => entry.harness === 'cursor').skills[0], 'design-taste-frontend');
});

test('plugin commands add a marketplace only when it is missing', () => {
  const taste = byId('taste-skill').find((entry) => entry.harness === 'claude');
  assert.deepEqual(commandsFor(taste, { marketplaces: [], plugins: [] }), [
    ['claude', ['plugin', 'marketplace', 'add', 'Leonxlnx/taste-skill', '--scope', 'user']],
    ['claude', ['plugin', 'install', 'taste-skill@taste-skill', '--scope', 'user', '-y']]
  ]);
  assert.deepEqual(commandsFor(taste, { marketplaces: ['taste-skill'], plugins: ['taste-skill@taste-skill'] }), []);
  const codex = byId('pstack').find((entry) => entry.kind === 'plugin');
  assert.equal(codex.harness, 'claude');
  const matt = byId('mattpocock-skills').find((entry) => entry.harness === 'codex');
  assert.deepEqual(commandsFor(matt, { marketplaces: ['mattpocock'], plugins: [] }), [
    ['codex', ['plugin', 'add', 'mattpocock-skills@mattpocock']]
  ]);
});

test('skill installs request only the missing names', () => {
  const emil = byId('emilkowalski-ui')[0];
  const commands = commandsFor(emil, { missing: ['break-ui'] });
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0][1].slice(0, 8), ['--yes', 'skills@latest', 'add', 'emilkowalski/skills', '-g', '-a', 'cursor', '-y']);
  assert.ok(commands[0][1].includes('--copy'));
  assert.deepEqual(commands[0][1].filter((arg, index) => commands[0][1][index - 1] === '-s'), ['break-ui']);
});

test('dry-run and the skip switch do not execute plugin commands', () => {
  let calls = 0;
  const run = () => { calls += 1; return { stdout: '', stderr: '' }; };
  assert.deepEqual(installExternalPlugins({ userHome: '/tmp/unused', dryRun: true, env: {}, run }).length, externalPlugins.length);
  assert.equal(calls, 0);
  assert.deepEqual(installExternalPlugins({ userHome: '/tmp/unused', env: { AGENT_CONFIG_EXTERNAL_PLUGINS: 'skip' }, run }), []);
  assert.equal(calls, 0);
  assert.match(formatPlugin(byId('pstack')[1]), /plugin pstack cursor local pstack/);
});

test('cursor-only skills leave the shared directory and Emil skills mirror to Claude', () => {
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'agent-config-skill-place-'));
  fs.mkdirSync(path.join(agentsSkill(home, 'tdd'), 'agents'), { recursive: true });
  fs.writeFileSync(path.join(agentsSkill(home, 'tdd'), 'SKILL.md'), 'tdd\n');
  fs.mkdirSync(agentsSkill(home, 'animate'), { recursive: true });
  fs.writeFileSync(path.join(agentsSkill(home, 'animate'), 'SKILL.md'), 'animate\n');
  placeInstalledSkills(byId('mattpocock-skills').find((entry) => entry.relocate === 'cursor'), home);
  placeInstalledSkills(byId('emilkowalski-ui')[0], home);
  assert.equal(fs.existsSync(agentsSkill(home, 'tdd')), false);
  assert.equal(fs.readFileSync(path.join(cursorSkill(home, 'tdd'), 'SKILL.md'), 'utf8'), 'tdd\n');
  assert.equal(fs.readFileSync(path.join(claudeSkill(home, 'animate'), 'SKILL.md'), 'utf8'), 'animate\n');
  assert.equal(fs.readFileSync(path.join(agentsSkill(home, 'animate'), 'SKILL.md'), 'utf8'), 'animate\n');
});

test('cursor local pstack is published from the sparse checkout', () => {
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'agent-config-pstack-'));
  const source = path.join(home, '.agent-config', 'sources', 'cursor-plugins', 'pstack', '.cursor-plugin');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'plugin.json'), '{"name":"pstack"}\n');
  publishCursorLocalPlugin(home);
  const installed = path.join(cursorPluginDestination(home), '.cursor-plugin', 'plugin.json');
  assert.equal(fs.readFileSync(installed, 'utf8'), '{"name":"pstack"}\n');
});

test('user dry-run lists plugin installs without writing the cursor plugin', () => {
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'agent-config-plugins-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CODEX_HOME;
  const stdout = execFileSync(process.execPath, [cli, 'sync', '--user', '--dry-run'], {
    cwd: root,
    encoding: 'utf8',
    env
  });
  assert.match(stdout, /planned plugin taste-skill claude taste-skill@taste-skill/);
  assert.match(stdout, /planned plugin taste-skill codex taste-skill@taste-skill/);
  assert.match(stdout, /planned plugin pstack claude pstack@cursor-plugins/);
  assert.match(stdout, /planned plugin pstack cursor local pstack/);
  assert.doesNotMatch(stdout, /plugin pstack codex/);
  assert.equal(fs.existsSync(cursorPluginDestination(home)), false);
});
