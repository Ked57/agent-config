import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadModels, renderModels } from '../bin/skill-models.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = fs.realpathSync(os.tmpdir());
const put = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const placeholderSkill = '---\nname: placeholder-skill\ndescription: Test skill.\n---\n\nImplementer {{models.implementer}}, judge {{models.judge}}.\n';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'skill-models-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repo = path.join(directory, 'repo');
  const home = path.join(directory, 'home');
  const project = path.join(directory, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  for (const folder of ['bin', 'policy', 'skills']) fs.cpSync(path.join(root, folder), path.join(repo, folder), { recursive: true });
  put(path.join(repo, 'skills/placeholder-skill/SKILL.md'), placeholderSkill);
  put(path.join(repo, 'models.json'), JSON.stringify({ claude: { implementer: 'opus', judge: 'fable' }, codex: { judge: 'gpt-judge' } }));
  const run = (...args) => spawnSync(process.execPath, [path.join(repo, 'bin/agent-config.mjs'), ...args], {
    cwd: repo,
    env: { ...process.env, HOME: home, USERPROFILE: home, AGENT_CONFIG_EXTERNAL_PLUGINS: 'skip', CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8'
  });
  const installed = (base) => fs.readFileSync(path.join(base, 'placeholder-skill/SKILL.md'), 'utf8');
  return { repo, home, project, run, installed };
}
const ok = (result) => assert.equal(result.status, 0, result.stderr);

test('renders one model per harness and names each harness when a shared copy differs', () => {
  const models = {
    models: { claude: { judge: 'fable' }, codex: { judge: 'gpt' }, cursor: {} },
    roles: new Set(['judge'])
  };
  assert.equal(renderModels('Judge on {{models.judge}}.', ['claude'], models), 'Judge on `fable`.');
  assert.equal(renderModels('Judge on {{models.judge}}.', ['codex', 'cursor'], models), 'Judge on `gpt` in Codex, `unset` in Cursor.');
  models.models.cursor.judge = 'gpt';
  assert.equal(renderModels('{{models.judge}}', ['codex', 'cursor'], models), '`gpt`');
  assert.equal(renderModels('No placeholders.', ['claude'], models), 'No placeholders.');
});

test('rejects unknown roles, unknown harnesses and override roles the defaults do not declare', (t) => {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'skill-models-unit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  put(path.join(directory, 'models.json'), JSON.stringify({ claude: { judge: 'fable' } }));
  const models = loadModels({ sourceRoot: directory });
  assert.throws(() => renderModels('{{models.judgee}}', ['claude'], models), /Unknown model role \{\{models\.judgee\}\}/);
  const override = path.join(directory, 'override.json');
  put(override, JSON.stringify({ claude: { reviewer: 'opus' } }));
  assert.throws(() => loadModels({ sourceRoot: directory, overrideFile: override }), /reviewer is not a role declared/);
  put(override, JSON.stringify({ gemini: { judge: 'x' } }));
  assert.throws(() => loadModels({ sourceRoot: directory, overrideFile: override }), /unknown harness gemini/);
  put(override, JSON.stringify({ claude: { judge: '' } }));
  assert.throws(() => loadModels({ sourceRoot: directory, overrideFile: override }), /must be a non-empty model name/);
});

test('the repository declares every role its skills use', () => {
  const models = loadModels({ sourceRoot: root });
  for (const name of fs.readdirSync(path.join(root, 'skills'))) {
    const file = path.join(root, 'skills', name, 'SKILL.md');
    if (fs.existsSync(file)) renderModels(fs.readFileSync(file, 'utf8'), ['claude'], models);
  }
  assert.equal(models.models.claude.judge, 'fable');
  assert.equal(models.models.claude.implementer, 'opus');
});

test('user sync fills models per harness, applies the personal override, and re-syncs after a change', (t) => {
  const { home, run, installed } = fixture(t);
  ok(run('sync', '--user'));
  assert.match(installed(path.join(home, '.claude/skills')), /Implementer `opus`, judge `fable`\./);
  assert.match(installed(path.join(home, '.agents/skills')), /Implementer `opus` in Claude Code, `unset` in Codex, `unset` in Cursor, judge `fable` in Claude Code, `gpt-judge` in Codex, `unset` in Cursor\./);
  ok(run('check', '--user'));

  put(path.join(home, '.agent-config/models.json'), JSON.stringify({ claude: { judge: 'sonnet' }, cursor: { judge: 'gpt-judge' } }));
  const drifted = run('check', '--user');
  assert.equal(drifted.status, 1);
  assert.match(drifted.stdout, /updated ~\/\.claude\/skills\/placeholder-skill\/SKILL\.md/);
  ok(run('sync', '--user'));
  assert.match(installed(path.join(home, '.claude/skills')), /Implementer `opus`, judge `sonnet`\./);
  assert.match(installed(path.join(home, '.agents/skills')), /judge `sonnet` in Claude Code, `gpt-judge` in Codex, `gpt-judge` in Cursor\./);
  ok(run('check', '--user'));
});

test('project sync renders repository defaults and ignores the personal override', (t) => {
  const { home, project, run, installed } = fixture(t);
  put(path.join(home, '.agent-config/models.json'), JSON.stringify({ claude: { judge: 'sonnet' } }));
  ok(run('sync', '--project', project));
  assert.match(installed(path.join(project, '.claude/skills')), /judge `fable`\./);
  ok(run('check', '--project', project));
});

test('an unknown placeholder fails the sync before anything is written', (t) => {
  const { repo, home, run } = fixture(t);
  put(path.join(repo, 'skills/placeholder-skill/SKILL.md'), `${placeholderSkill}Reviewer {{models.reviewer}}.\n`);
  const result = run('sync', '--user');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown model role \{\{models\.reviewer\}\}/);
  assert.equal(fs.existsSync(path.join(home, '.claude')), false);
});
