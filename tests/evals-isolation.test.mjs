import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compareInventories, filesNamingHome, installedPlugins, inventory, prepareRunHome } from '../evals/lib/arms.mjs';
import { parseRemove, promptFor, resolveConfig, validateTaskSet } from '../evals/lib/config.mjs';
import { assertSafeRoot, baseEnv, isInside, isStray, killStrays, removeTree, sandboxProblems } from '../evals/lib/env.mjs';
import { moveTree } from '../evals/lib/fixtures.mjs';
import { initEvent, initProblems, invokedCommands, loadedInstructionFiles, removalLeftovers, sessionComponents, sessionCostUsd, skillName, strayInstructionFiles, unexplainedComponents } from '../evals/lib/isolation.mjs';
import { fixedFlagsOnResume } from '../evals/lib/plan.mjs';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-evals-isolation-'));
const write = (file, content = '') => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const jsonl = (...events) => events.map((event) => JSON.stringify(event)).join('\n');

const BUILTINS = { skills: ['debug', 'simplify'], agents: ['Explore', 'general-purpose'], plugins: [{ name: 'cc-plugin-agents-md', source: 'cc-plugin-agents-md@builtin', version: null, path: 'builtin' }] };

/** A template home as the installer leaves it: a repo skill, one plugin, and the home path in index files. */
function fakeArmHome(home) {
  write(path.join(home, '.claude', 'skills', 'manual-qa', 'SKILL.md'), 'qa');
  write(path.join(home, '.claude', 'CLAUDE.md'), `@${home}/.agents/AGENTS.md\n`);
  write(path.join(home, '.agents', 'AGENTS.md'), 'policy');
  write(path.join(home, '.codex', 'plugins', 'cache', 'big.bin'), 'codex only');
  write(path.join(home, '.cursor', 'skills', 'tdd', 'SKILL.md'), 'cursor only');
  write(path.join(home, '.cursor', 'plugins', 'local', 'pstack', 'skills', 'poteto-mode', 'SKILL.md'), 'cursor pstack');
  const installPath = path.join(home, '.claude', 'plugins', 'cache', 'cursor-plugins', 'pstack', '0.15.42');
  write(path.join(installPath, 'skills', 'poteto-mode', 'SKILL.md'), 'mode');
  write(path.join(installPath, 'agents', 'poteto-agent.md'), 'agent');
  write(path.join(installPath, 'node_modules', 'x', 'index.js'), 'ignored');
  write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'pstack@cursor-plugins': [{ scope: 'user', installPath, version: '0.15.42', installedAt: 'now', gitCommitSha: 'bf0c7cd' }] } }));
  return installPath;
}

const init = (home, app, overrides = {}) => ({
  type: 'system',
  subtype: 'init',
  cwd: app,
  skills: ['debug', 'simplify', 'manual-qa', 'pstack:poteto-mode'],
  agents: ['Explore', 'general-purpose', 'pstack:poteto-agent'],
  plugins: [{ name: 'pstack', path: `${home}/.claude/plugins/cache/cursor-plugins/pstack/0.15.42`, source: 'pstack@cursor-plugins', version: '0.15.42' }, { name: 'cc-plugin-agents-md', path: 'builtin', source: 'cc-plugin-agents-md@builtin' }],
  mcp_servers: [],
  slash_commands: ['debug', 'manual-qa', 'pstack:poteto-mode'],
  memory_paths: { auto: `${home}/.claude/projects/x/memory/` },
  ...overrides
});

test('sandboxProblems refuses a sandbox under the home or below agent config', () => {
  const root = temp();
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  assert.match(sandboxProblems(path.join(home, 'sandbox'), home).join(), /inside the home directory/);
  const above = path.join(root, 'shared');
  write(path.join(above, 'CLAUDE.md'));
  assert.match(sandboxProblems(path.join(above, 'evals'), home).join(), /agent config sits above the sandbox: .*CLAUDE\.md/);
  assert.deepEqual(sandboxProblems(path.join(root, 'clean', 'evals'), home).filter((problem) => problem.includes(root)), []);
  assert.ok(isInside(path.join(home, 'a'), home) && isInside(home, home) && !isInside(`${home}2`, home));
  fs.rmSync(root, { recursive: true, force: true });
});

test('baseEnv gives a run its own temp dir', () => {
  assert.deepEqual([baseEnv('/h', '/r/tmp').TMPDIR, baseEnv('/h', '/r/tmp').TMP, baseEnv('/h', '/r/tmp').TEMP], ['/r/tmp', '/r/tmp', '/r/tmp']);
  assert.equal(baseEnv('/h').TMPDIR, undefined);
});

test('prepareRunHome copies the template and points its own path at the run home', () => {
  const root = temp();
  const template = path.join(root, 'arms', 'A', 'home');
  fakeArmHome(template);
  const files = filesNamingHome(template);
  assert.deepEqual(files, ['.claude/CLAUDE.md', '.claude/plugins/installed_plugins.json']);
  const home = path.join(root, 'runs', 'r1', 'home');
  prepareRunHome({ template, home, files });
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), `@${home}/.agents/AGENTS.md\n`);
  assert.equal(installedPlugins(home).pstack.installPath, path.join(home, '.claude', 'plugins', 'cache', 'cursor-plugins', 'pstack', '0.15.42'));
  assert.equal(fs.readFileSync(path.join(template, '.claude', 'CLAUDE.md'), 'utf8'), `@${template}/.agents/AGENTS.md\n`, 'template untouched');
  assert.ok(!fs.existsSync(path.join(home, '.codex')) && !fs.existsSync(path.join(home, '.cursor', 'skills')), 'Codex and Cursor-only copies stay in the template');
  assert.ok(fs.existsSync(path.join(home, '.cursor', 'plugins', 'local', 'pstack', 'skills', 'poteto-mode', 'SKILL.md')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('inventory lists plugins with their skills and agents, and a changed plugin is watched', () => {
  const root = temp();
  const a = path.join(root, 'a');
  const b = path.join(root, 'b');
  fakeArmHome(a);
  fakeArmHome(b);
  const left = inventory(a);
  assert.deepEqual(left.plugins, [{ id: 'pstack@cursor-plugins', name: 'pstack', version: '0.15.42', gitCommitSha: 'bf0c7cd', skills: ['poteto-mode'], agents: ['poteto-agent'] }]);
  assert.ok(!Object.keys(left.hashes).some((file) => file.includes('node_modules')));
  assert.ok(!Object.keys(left.hashes).includes('.claude/plugins/installed_plugins.json'), 'install timestamps must not make identical arms differ');
  assert.equal(compareInventories(left, inventory(b)).identical, true, 'home paths are normalised');
  write(path.join(b, '.claude', 'plugins', 'cache', 'cursor-plugins', 'pstack', '0.15.42', 'skills', 'poteto-mode', 'SKILL.md'), 'changed');
  assert.deepEqual(compareInventories(left, inventory(b)).watched, ['plugin:pstack']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('initProblems accepts a run that loads exactly what the arm probe saw', () => {
  const probeHome = '/sandbox/e/probe/arm-A/home';
  const expected = sessionComponents(init(probeHome, '/sandbox/e/probe/arm-A/cwd'), probeHome);
  assert.equal(expected.plugins[1].path, '~/.claude/plugins/cache/cursor-plugins/pstack/0.15.42');
  const home = '/sandbox/e/runs/r1/home';
  const app = '/sandbox/e/runs/r1/app';
  assert.deepEqual(initProblems({ expected, init: init(home, app), runHome: home, app }), []);
});

test('initProblems names every way a run can differ from its arm', () => {
  const expected = sessionComponents(init('/p/home', '/p/cwd'), '/p/home');
  const home = '/s/runs/r1/home';
  const app = '/s/runs/r1/app';
  const leaky = init(home, '/home/u/evals/app', {
    skills: ['debug', 'simplify', 'manual-qa', 'pstack:poteto-mode', 'step-ssh', 'vault-run', 'paseo', 'paseo-handoff'],
    agents: ['Explore', 'general-purpose'],
    plugins: [{ name: 'pstack', path: '/home/u/.claude/plugins/cache/cursor-plugins/pstack/0.16.0', source: 'pstack@cursor-plugins', version: '0.16.0' }, { name: 'cc-plugin-agents-md', path: 'builtin' }],
    mcp_servers: [{ name: 'paseo', status: 'connected' }],
    memory_paths: { auto: '/home/u/.claude/projects/x/memory/' }
  });
  const problems = initProblems({ expected, init: leaky, runHome: home, app });
  for (const pattern of [/unexpected skills: paseo, paseo-handoff, step-ssh, vault-run/, /unexpected plugins: pstack@0\.16\.0/, /missing plugins: pstack@0\.15\.42/, /missing agents: pstack:poteto-agent/, /MCP servers loaded: paseo/, /cwd \/home\/u\/evals\/app/, /memory path .* outside the run home/, /plugin pstack loaded from \/home\/u/]) {
    assert.ok(problems.some((problem) => pattern.test(problem)), `${pattern} in ${problems.join(' | ')}`);
  }
  assert.deepEqual(initProblems({ expected, init: null, runHome: home, app }), ['no init event in the transcript']);
});

test('initEvent takes the first init event of a transcript', () => {
  const text = `not json\n${jsonl({ type: 'system', subtype: 'other' }, { type: 'system', subtype: 'init', cwd: '/a' }, { type: 'system', subtype: 'init', cwd: '/b' })}`;
  assert.equal(initEvent(text).cwd, '/a');
  assert.equal(initEvent(''), null);
});

test('loaded instruction files come from the session log, and strays are those outside the run', () => {
  const session = jsonl(
    { type: 'user', message: { role: 'user', content: '<command-message>pstack:poteto-mode</command-message>\n<command-name>/pstack:poteto-mode</command-name>\n<command-args>fix it</command-args>' } },
    { type: 'attachment', attachment: { type: 'instructions', files: [{ path: '/s/r1/home/.claude/CLAUDE.md', type: 'User', content: '@x' }, { path: '/s/r1/home/.agents/AGENTS.md', type: 'User', content: 'p' }] } },
    { type: 'attachment', attachment: { type: 'nested_memory', path: '/home/u/CLAUDE.md', content: 'live' } },
    { type: 'attachment', attachment: { type: 'skill_listing', content: '- a' } },
    { type: 'cost-state', totalCostUSD: 0.5 },
    { type: 'cost-state', totalCostUSD: 0.75 }
  );
  const files = loadedInstructionFiles(session);
  assert.deepEqual(files, ['/home/u/CLAUDE.md', '/s/r1/home/.agents/AGENTS.md', '/s/r1/home/.claude/CLAUDE.md']);
  assert.deepEqual(strayInstructionFiles(files, ['/s/r1/home', '/s/r1/app']), ['/home/u/CLAUDE.md']);
  assert.deepEqual(invokedCommands(session), ['pstack:poteto-mode']);
  assert.equal(sessionCostUsd(session), 0.75);
  assert.equal(sessionCostUsd(jsonl({ type: 'user' })), null);
});

test('unexplainedComponents accepts built-ins and installed files, and names the rest', () => {
  const home = temp();
  const installPath = fakeArmHome(home);
  const components = sessionComponents(init(home, '/cwd'), home);
  const installed = { pstack: installPath };
  assert.deepEqual(unexplainedComponents({ components, builtins: BUILTINS, home, installed }), []);
  const extra = { ...components, skills: [...components.skills, 'step-ssh', 'pstack:ghost'], agents: [...components.agents, 'reviewer'], plugins: [...components.plugins, { name: 'paseo', path: '/home/u/.claude/plugins/paseo' }] };
  assert.deepEqual(unexplainedComponents({ components: extra, builtins: BUILTINS, home, installed }), [
    'skill step-ssh has no file under the arm home',
    'skill pstack:ghost has no file under the arm home',
    'agent reviewer has no file under the arm home',
    'plugin paseo (/home/u/.claude/plugins/paseo) is not installed under the arm home'
  ]);
  fs.rmSync(home, { recursive: true, force: true });
});

test('removalLeftovers names what a removed plugin still loads', () => {
  const components = { skills: ['pstack:poteto-mode', 'animate', 'manual-qa'], agents: ['pstack:poteto-agent'], plugins: [{ name: 'pstack' }] };
  assert.deepEqual(removalLeftovers(components, [{ id: 'pstack', plugins: ['pstack'], skills: [] }, { id: 'emilkowalski-ui', plugins: [], skills: ['animate', 'break-ui'] }]), [
    'plugin:pstack still loads plugin pstack, pstack:poteto-mode, pstack:poteto-agent',
    'plugin:emilkowalski-ui still loads skills animate'
  ]);
  assert.deepEqual(removalLeftovers({ skills: ['manual-qa'], agents: [], plugins: [] }, [{ id: 'pstack', plugins: ['pstack'], skills: [] }]), []);
});

test('arm toggles: plugin removals, prefixes, BARE and --plugins are validated', () => {
  const taskSet = { name: 't', fixture: 'f', categories: { c: {} }, tasks: [{ id: 'T1', category: 'c', prompt: 'Fix the bug.' }] };
  assert.equal(parseRemove('plugin:pstack'), 'plugin:pstack');
  assert.equal(parseRemove('skills/manual-qa/'), 'skills/manual-qa');
  assert.throws(() => parseRemove('plugin:../x'), /Invalid plugin id/);
  const config = resolveConfig({ a: 'BARE', b: 'WORKTREE', bRemove: ['plugin:pstack'], bPrefix: '/pstack:poteto-mode' }, taskSet);
  assert.deepEqual(config.arms.B, { ref: 'WORKTREE', add: [], remove: ['plugin:pstack'], prefix: '/pstack:poteto-mode' });
  assert.equal(config.plugins, 'install');
  assert.equal(config.strictIsolation, true);
  assert.throws(() => resolveConfig({ a: 'BARE', aRemove: ['plugin:pstack'], b: 'main' }, taskSet), /BARE/);
  assert.throws(() => resolveConfig({ b: 'main', plugins: 'maybe' }, taskSet), /--plugins/);
  assert.throws(() => resolveConfig({ b: 'main', bPrefix: '  ' }, taskSet), /--b-prefix/);
  assert.throws(() => resolveConfig({ b: 'main', bAdd: ['plugin:pstack'] }, taskSet), /not supported/);
  assert.deepEqual(fixedFlagsOnResume({ resume: 'd', bPrefix: 'x', plugins: 'skip', strictIsolation: false }), ['--b-prefix', '--plugins']);
});

test('promptFor: the task prefix wins over the arm prefix, and the record keeps the exact prompt', () => {
  const task = { prompt: 'Fix the bug.' };
  assert.equal(promptFor(task, 'A', {}), 'Fix the bug.');
  assert.equal(promptFor(task, 'B', { prefix: '/pstack:poteto-mode' }), '/pstack:poteto-mode Fix the bug.');
  const own = { prompt: 'Fix the bug.', promptPrefix: { B: 'Use TDD.', A: '' } };
  assert.equal(promptFor(own, 'B', { prefix: '/pstack:poteto-mode' }), 'Use TDD. Fix the bug.');
  assert.equal(promptFor(own, 'A', { prefix: '/x' }), 'Fix the bug.');
  const base = { name: 't', fixture: 'f', categories: { c: {} } };
  assert.deepEqual(validateTaskSet({ ...base, tasks: [{ id: 'T', category: 'c', prompt: 'p', promptPrefix: { B: '/x' } }] }), []);
  assert.match(validateTaskSet({ ...base, tasks: [{ id: 'T', category: 'c', prompt: 'p', promptPrefix: { C: '/x' } }] }).join(), /promptPrefix/);
  assert.match(validateTaskSet({ ...base, tasks: [{ id: 'T', category: 'c', prompt: 'p', promptPrefix: '/x' }] }).join(), /promptPrefix/);
});

test('moveTree moves a directory with its hard links intact', () => {
  const root = temp();
  write(path.join(root, 'cache', 'lib.js'), 'x');
  const app = path.join(root, 'sandbox', 'app');
  write(path.join(app, 'src', 'a.ts'), 'a');
  fs.mkdirSync(path.join(app, 'node_modules'), { recursive: true });
  fs.linkSync(path.join(root, 'cache', 'lib.js'), path.join(app, 'node_modules', 'lib.js'));
  const target = path.join(root, 'results', 'runs', 'r1', 'app');
  moveTree(app, target);
  assert.ok(!fs.existsSync(app));
  assert.equal(fs.readFileSync(path.join(target, 'src', 'a.ts'), 'utf8'), 'a');
  assert.equal(fs.statSync(path.join(target, 'node_modules', 'lib.js')).ino, fs.statSync(path.join(root, 'cache', 'lib.js')).ino);
  fs.rmSync(root, { recursive: true, force: true });
});

test('killStrays stops a detached server that carries the run home in its env', { skip: !fs.existsSync('/proc/self/environ') }, async () => {
  const scratch = temp();
  const root = path.join(scratch, 'runs', 'r1');
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  // Started in its own session and from outside the run dir, as `setsid npm run dev &` would be.
  const child = spawn('sleep', ['30'], { cwd: os.tmpdir(), env: { PATH: process.env.PATH, HOME: home }, detached: true, stdio: 'ignore' });
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve(signal)));
  await new Promise((resolve) => setTimeout(resolve, 100));
  const killed = killStrays({ root, markers: [`HOME=${home}`] });
  assert.ok(killed.some((command) => command.startsWith('sleep 30')), killed.join());
  assert.equal(await exited, 'SIGKILL');
  assert.deepEqual(killStrays({ root, markers: [`HOME=${home}`] }), []);
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('a plugin skill is found by its front matter name, not only its directory', () => {
  assert.equal(skillName('---\nname: design-taste-frontend\ndescription: >-\n  x\n---\nbody', 'skills/taste-skill'), 'design-taste-frontend');
  assert.equal(skillName('no front matter', 'skills/manual-qa'), 'manual-qa');
  const home = temp();
  const installPath = path.join(home, '.claude', 'plugins', 'cache', 'taste-skill', 'taste-skill', '2.5.1');
  write(path.join(installPath, 'skills', 'taste-skill', 'SKILL.md'), '---\nname: "design-taste-frontend"\n---\n');
  write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'taste-skill@taste-skill': [{ scope: 'user', installPath, version: '2.5.1' }] } }));
  assert.deepEqual(inventory(home).plugins[0].skills, ['design-taste-frontend']);
  const components = { skills: ['taste-skill:design-taste-frontend'], agents: [], plugins: [{ name: 'taste-skill', path: '~/.claude/plugins/cache/taste-skill/taste-skill/2.5.1' }] };
  assert.deepEqual(unexplainedComponents({ components, builtins: BUILTINS, home, installed: { 'taste-skill': installPath } }), []);
  fs.rmSync(home, { recursive: true, force: true });
});

test('validateTaskSet checks task files, the vitest-json reporter and the expectsComponents alias', () => {
  const base = { name: 't', fixture: 'f', categories: { c: {} } };
  const task = (extra) => validateTaskSet({ ...base, tasks: [{ id: 'T', category: 'c', prompt: 'p', ...extra }] });
  assert.deepEqual(task({ files: { 'specs/x.md': 'docs/SPEC.md' }, expectsComponents: ['plugin:pstack'] }), []);
  assert.match(task({ files: { '../x': 'a' } }).join(), /files must map/);
  assert.match(task({ files: { x: '/abs' } }).join(), /files must map/);
  assert.match(task({ expectsComponents: 'x' }).join(), /expectsComponents must be a string array/);
  assert.match(task({ expectsComponents: ['a'], expectsPolicies: ['a'] }).join(), /not both/);
  assert.deepEqual(task({ checks: [{ id: 'h', type: 'command', run: 'vitest run', reporter: 'vitest-json' }] }), []);
  assert.match(task({ checks: [{ id: 'h', type: 'command', run: 'vitest run', reporter: 'junit' }] }).join(), /reporter must be vitest-json/);
});

test('removeTree deletes only strictly inside a deep root, never the root, a parent, or the home', () => {
  const scratch = temp();
  const root = path.join(scratch, 'sandbox', 'eval-abc123');
  write(path.join(root, 'runs', 'r1', 'home', 'f'), 'x');
  write(path.join(scratch, 'sandbox', 'other-eval', 'keep'), 'keep');
  write(path.join(scratch, 'sandbox', 'eval-abc123-sibling', 'keep'), 'keep');
  removeTree(path.join(root, 'runs', 'r1'), root);
  assert.ok(!fs.existsSync(path.join(root, 'runs', 'r1')) && fs.existsSync(path.join(root, 'runs')));
  for (const target of [root, path.join(root, '..'), path.join(root, 'runs', '..', '..'), `${root}-sibling`, path.join(scratch, 'sandbox', 'other-eval'), '', '/', null]) {
    assert.throws(() => removeTree(target, root), /Refusing/, String(target));
  }
  assert.ok(fs.existsSync(path.join(scratch, 'sandbox', 'other-eval', 'keep')) && fs.existsSync(`${root}-sibling/keep`));
  for (const shallow of ['/', '/var', '/var/tmp', 'relative/a/b/c', '', os.homedir(), path.dirname(os.homedir())]) {
    assert.throws(() => assertSafeRoot(shallow), /Refusing/, shallow);
    assert.throws(() => removeTree(path.join(shallow || '/x', 'a', 'b'), shallow), /Refusing/, shallow);
  }
  assert.equal(assertSafeRoot('/var/tmp/agent-config-evals'), '/var/tmp/agent-config-evals');
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('stray matching is exact on env entries and segment-wise on cwd, so /var/tmp prefixes never match', () => {
  const root = '/var/tmp/agent-config-evals/e-1/runs/r1';
  const markers = [`HOME=${root}/home`, `TMPDIR=${root}/tmp`];
  const opts = { root, markers };
  assert.ok(isStray({ environ: [`HOME=${root}/home`] }, opts));
  assert.ok(isStray({ environ: [], cwd: `${root}/app/src` }, opts));
  assert.ok(isStray({ environ: [], cwd: root }, opts));
  for (const proc of [
    { environ: ['HOME=/var/tmp'], cwd: '/var/tmp' },
    { environ: [`HOME=${root}/home2`, `TMPDIR=${root}/tmp/x`], cwd: '/var/tmp/agent-config-evals/e-1/runs' },
    { environ: ['HOME=/home/u'], cwd: `${root}2/app` },
    { environ: [`PWD=${root}/home`, `OLDHOME=${root}/home`], cwd: '/var/tmp/repo-evals-work/agent-c' }
  ]) assert.ok(!isStray(proc, opts), JSON.stringify(proc));
  assert.throws(() => killStrays({ root: '/var/tmp', markers: ['HOME=/var/tmp/x'] }), /Refusing/);
  assert.throws(() => killStrays({ root, markers: ['HOME=/var/tmp'] }), /Refusing stray marker/);
  assert.throws(() => killStrays({ root, markers: [`HOME=${root}`] }), /Refusing stray marker/);
});

test('armDrift names changed plugin versions or commits and changed installed files', async () => {
  const { armDrift, armBuilt, BUILT_MARKER } = await import('../evals/lib/arms.mjs');
  const saved = { plugins: [{ id: 'pstack@cursor-plugins', version: '0.15.42', gitCommitSha: 'bf0c7cd' }], hashes: { '.agents/AGENTS.md': 'a', '.claude/plugins/cache/cursor-plugins/pstack/0.15.42/x': 'p' } };
  assert.deepEqual(armDrift(saved, saved), { plugins: [], files: [] });
  const moved = { plugins: [{ id: 'pstack@cursor-plugins', version: '0.16.0', gitCommitSha: 'c0ffee1' }, { id: 'new@m', version: '1', gitCommitSha: 'n' }], hashes: { '.agents/AGENTS.md': 'b', '.claude/plugins/cache/cursor-plugins/pstack/0.16.0/x': 'q' } };
  assert.deepEqual(armDrift(saved, moved), {
    plugins: ['new@m: absent → new@m@1#n', 'pstack@cursor-plugins: pstack@cursor-plugins@0.15.42#bf0c7cd → pstack@cursor-plugins@0.16.0#c0ffee1'],
    files: ['.agents/AGENTS.md']
  });
  const scratch = temp();
  const armDir = path.join(scratch, 'arms', 'A');
  fs.mkdirSync(path.join(armDir, 'home'), { recursive: true });
  assert.equal(armBuilt(armDir, path.join(armDir, 'home')), false, 'a build without its marker is incomplete');
  fs.writeFileSync(path.join(armDir, BUILT_MARKER), 'now');
  assert.equal(armBuilt(armDir, path.join(armDir, 'home')), true);
  fs.rmSync(path.join(armDir, 'home'), { recursive: true });
  assert.equal(armBuilt(armDir, path.join(armDir, 'home')), false);
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('memAvailableMb reads MemAvailable from /proc/meminfo', async () => {
  const { memAvailableMb } = await import('../evals/lib/env.mjs');
  assert.equal(memAvailableMb('MemTotal:        7864320 kB\nMemFree:  100 kB\nMemAvailable:    1536000 kB\n'), 1500);
  assert.equal(memAvailableMb(''), null);
  assert.equal(resolveConfig({ b: 'main' }, { name: 't', fixture: 'f', categories: { c: {} }, tasks: [{ id: 'T', category: 'c', prompt: 'p' }] }).minFreeMb, 1500);
});
