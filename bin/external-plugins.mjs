import fs from 'node:fs';
import path from 'node:path';

const emilSkills = [
  'emil-design-eng',
  'break-ui',
  'animate',
  'animation-performance',
  'animation-vocabulary',
  'find-animation-opportunities',
  'improve-animations',
  'review-animations'
];

const mattCursorSkills = [
  'ask-matt',
  'diagnosing-bugs',
  'grill-with-docs',
  'triage',
  'improve-codebase-architecture',
  'setup-matt-pocock-skills',
  'tdd',
  'to-spec',
  'to-tickets',
  'wayfinder',
  'implement',
  'implement-spec',
  'prototype',
  'research',
  'domain-modeling',
  'codebase-design',
  'code-review',
  'pr',
  'retro',
  'wizard',
  'grill-me',
  'grilling',
  'handoff',
  'teach',
  'to-questionnaire',
  'wait-what',
  'writing-for-agents'
];

const plugin = (id, harness, marketplace, marketplaceName, pluginId) => ({
  id,
  harness,
  kind: 'plugin',
  bin: harness === 'codex' ? 'codex' : 'claude',
  marketplace,
  marketplaceName,
  plugin: pluginId
});

const skills = (id, harnesses, agent, source, names, placement) => ({
  id,
  harness: harnesses.join(','),
  kind: 'skills',
  agent,
  package: source,
  skills: names,
  ...placement
});

// One install per harness that publishes this pack. pstack has no Codex adapter.
export const externalPlugins = [
  plugin('taste-skill', 'claude', 'Leonxlnx/taste-skill', 'taste-skill', 'taste-skill@taste-skill'),
  plugin('taste-skill', 'codex', 'Leonxlnx/taste-skill', 'taste-skill', 'taste-skill@taste-skill'),
  skills('taste-skill', ['cursor'], 'cursor', 'Leonxlnx/taste-skill', ['design-taste-frontend'], { relocate: 'cursor' }),
  skills('emilkowalski-ui', ['cursor', 'claude', 'codex'], 'cursor', 'emilkowalski/skills', emilSkills, { mirror: ['claude'] }),
  plugin('mattpocock-skills', 'claude', 'mattpocock/skills', 'mattpocock', 'mattpocock-skills@mattpocock'),
  plugin('mattpocock-skills', 'codex', 'mattpocock/skills', 'mattpocock', 'mattpocock-skills@mattpocock'),
  skills('mattpocock-skills', ['cursor'], 'cursor', 'mattpocock/skills', mattCursorSkills, { relocate: 'cursor' }),
  plugin('pstack', 'claude', 'cursor/plugins', 'cursor-plugins', 'pstack@cursor-plugins'),
  {
    id: 'pstack',
    harness: 'cursor',
    kind: 'cursor-local',
    repo: 'https://github.com/cursor/plugins.git',
    directory: 'pstack'
  }
];

export const formatPlugin = (entry) => {
  if (entry.kind === 'plugin') return `plugin ${entry.id} ${entry.harness} ${entry.plugin}`;
  if (entry.kind === 'skills') return `plugin ${entry.id} ${entry.harness} skills ${entry.skills.join(',')}`;
  return `plugin ${entry.id} ${entry.harness} local ${entry.directory}`;
};

export const commandsFor = (entry, state) => {
  if (entry.kind === 'plugin') {
    const commands = [];
    if (!state.marketplaces.includes(entry.marketplaceName)) {
      const args = ['plugin', 'marketplace', 'add', entry.marketplace];
      if (entry.bin === 'claude') args.push('--scope', 'user');
      commands.push([entry.bin, args]);
    }
    if (!state.plugins.includes(entry.plugin)) {
      const args = entry.bin === 'claude'
        ? ['plugin', 'install', entry.plugin, '--scope', 'user', '-y']
        : ['plugin', 'add', entry.plugin];
      commands.push([entry.bin, args]);
    }
    return commands;
  }
  if (entry.kind === 'skills') {
    if (!state.missing.length) return [];
    return [['npx', ['--yes', 'skills@latest', 'add', entry.package, '-g', '-a', entry.agent, '-y', '--copy', ...state.missing.flatMap((name) => ['-s', name])]]];
  }
  const cache = state.cache;
  if (!state.cacheExists) {
    return [
      ['git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', entry.repo, cache]],
      ['git', ['-C', cache, 'sparse-checkout', 'set', entry.directory]]
    ];
  }
  return [
    ['git', ['-C', cache, 'fetch', '--depth', '1', 'origin', 'main']],
    ['git', ['-C', cache, 'reset', '--hard', 'origin/main']],
    ['git', ['-C', cache, 'sparse-checkout', 'set', entry.directory]]
  ];
};

const jsonPayload = (text) => {
  const start = text.search(/[[{]/);
  if (start === -1) throw new Error(`Expected JSON from a plugin command, got: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start));
};

const pluginState = (entry, userHome, run) => {
  if (entry.kind === 'skills') return { missing: missingSkillCopies(entry, userHome) };
  if (entry.kind === 'cursor-local') {
    const cache = path.join(userHome, '.agent-config', 'sources', 'cursor-plugins');
    return { cache, cacheExists: fs.existsSync(path.join(cache, '.git')) };
  }
  if (entry.bin === 'claude') {
    const marketplaces = jsonPayload(run('claude', ['plugin', 'marketplace', 'list', '--json']).stdout);
    const plugins = jsonPayload(run('claude', ['plugin', 'list', '--json']).stdout);
    return {
      marketplaces: marketplaces.map((item) => item.name),
      plugins: plugins.map((item) => item.id)
    };
  }
  const marketplaces = jsonPayload(run('codex', ['plugin', 'marketplace', 'list', '--json']).stdout);
  const plugins = jsonPayload(run('codex', ['plugin', 'list', '--json']).stdout);
  return {
    marketplaces: marketplaces.marketplaces.map((item) => item.name),
    plugins: plugins.installed.map((item) => item.pluginId)
  };
};

const hasSkill = (directory) => fs.existsSync(path.join(directory, 'SKILL.md'));
export const agentsSkill = (userHome, name) => path.join(userHome, '.agents', 'skills', name);
export const cursorSkill = (userHome, name) => path.join(userHome, '.cursor', 'skills', name);
export const claudeSkill = (userHome, name) => path.join(userHome, '.claude', 'skills', name);

export const missingSkillCopies = (entry, userHome) => entry.skills.filter((name) => {
  if (entry.relocate === 'cursor') return !hasSkill(cursorSkill(userHome, name)) && !hasSkill(agentsSkill(userHome, name));
  return !hasSkill(agentsSkill(userHome, name));
});

// Cursor has no marketplace for Taste Skill or Matt Pocock, and the skills CLI
// writes those into the shared ~/.agents/skills directory that Codex also reads.
// Move those copies into ~/.cursor/skills so the Claude and Codex plugins stay
// the only copy on those harnesses. Emil has no plugin, so the shared copy is
// the Codex and Cursor install, mirrored into Claude's skill directory.
export const placeInstalledSkills = (entry, userHome) => {
  if (entry.relocate === 'cursor') {
    for (const name of entry.skills) {
      const source = agentsSkill(userHome, name);
      if (!hasSkill(source)) continue;
      const destination = cursorSkill(userHome, name);
      fs.rmSync(destination, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.renameSync(source, destination);
    }
  }
  if (entry.mirror?.includes('claude')) {
    for (const name of entry.skills) {
      const source = agentsSkill(userHome, name);
      if (!hasSkill(source)) continue;
      const destination = claudeSkill(userHome, name);
      fs.rmSync(destination, { recursive: true, force: true });
      fs.cpSync(source, destination, { recursive: true });
    }
  }
};

export const cursorPluginCache = (userHome) => path.join(userHome, '.agent-config', 'sources', 'cursor-plugins');
export const cursorPluginDestination = (userHome) => path.join(userHome, '.cursor', 'plugins', 'local', 'pstack');

export const publishCursorLocalPlugin = (userHome) => {
  const source = path.join(cursorPluginCache(userHome), 'pstack');
  const destination = cursorPluginDestination(userHome);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
};

export const installExternalPlugins = ({ userHome, dryRun = false, env = process.env, run }) => {
  if (env.AGENT_CONFIG_EXTERNAL_PLUGINS === 'skip') return [];
  const lines = [];
  for (const entry of externalPlugins) {
    const label = formatPlugin(entry);
    if (dryRun) {
      lines.push(`planned ${label}`);
      continue;
    }
    const state = pluginState(entry, userHome, run);
    const commands = commandsFor(entry, state);
    for (const [command, args] of commands) {
      const result = run(command, args);
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      if (output.includes('Invalid agents:')) throw new Error(`${label} rejected an agent name:\n${output}`);
    }
    const relocated = entry.relocate === 'cursor' && entry.skills.some((name) => hasSkill(agentsSkill(userHome, name)));
    if (entry.kind === 'skills') placeInstalledSkills(entry, userHome);
    if (entry.kind === 'cursor-local') publishCursorLocalPlugin(userHome);
    lines.push(`${commands.length || relocated ? 'installed' : 'present'} ${label}`);
  }
  return lines;
};
