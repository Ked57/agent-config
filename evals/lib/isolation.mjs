// Isolation verification: what a Claude Code session loaded (init event, session log) compared with
// what the arm installed. Pure apart from the file lookups in `unexplainedComponents`.
import fs from 'node:fs';
import path from 'node:path';
import { isInside } from './env.mjs';

const lines = (text) => text.split('\n').filter((line) => line.trim()).flatMap((line) => {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
});

/** The first `system/init` event of a stream-json transcript, or null. */
export function initEvent(transcriptText) {
  return lines(transcriptText).find((event) => event.type === 'system' && event.subtype === 'init') ?? null;
}

const normalise = (value, home) => (typeof value === 'string' && home ? value.split(home).join('~') : value);
const sorted = (values = []) => [...new Set(values)].sort();

/** What an init event says a session can use, with the home path written as `~` so homes compare. */
export function sessionComponents(init, home) {
  return {
    skills: sorted(init.skills),
    plugins: (init.plugins ?? []).map((plugin) => ({ name: plugin.name, source: plugin.source ?? null, version: plugin.version ?? null, path: normalise(plugin.path, home) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    agents: sorted(init.agents),
    mcpServers: (init.mcp_servers ?? []).map((server) => server.name ?? String(server)).sort(),
    slashCommands: sorted(init.slash_commands)
  };
}

const setDiff = (label, expected, actual) => {
  const want = new Set(expected);
  const have = new Set(actual);
  const missing = [...want].filter((item) => !have.has(item));
  const extra = [...have].filter((item) => !want.has(item));
  return [
    ...(extra.length ? [`unexpected ${label}: ${extra.join(', ')}`] : []),
    ...(missing.length ? [`missing ${label}: ${missing.join(', ')}`] : [])
  ];
};
const pluginKey = (plugin) => `${plugin.name}@${plugin.version ?? '?'}`;

/**
 * Problems with a run's init event against the arm's expectation (from its probe): skills, plugins
 * (name and version) and agents must match exactly, no MCP server may load, the cwd must be the run's
 * working copy, and memory and plugin paths must sit under the run home.
 */
export function initProblems({ expected, init, runHome, app }) {
  if (!init) return ['no init event in the transcript'];
  const actual = sessionComponents(init, runHome);
  const problems = [
    ...setDiff('skills', expected.skills, actual.skills),
    ...setDiff('plugins', expected.plugins.map(pluginKey), actual.plugins.map(pluginKey)),
    ...setDiff('agents', expected.agents, actual.agents)
  ];
  if (actual.mcpServers.length) problems.push(`MCP servers loaded: ${actual.mcpServers.join(', ')}`);
  if (path.resolve(init.cwd ?? '') !== path.resolve(app)) problems.push(`cwd ${init.cwd} is not the run's working copy ${app}`);
  for (const [kind, memory] of Object.entries(init.memory_paths ?? {})) {
    if (typeof memory === 'string' && !isInside(memory, runHome)) problems.push(`${kind} memory path ${memory} is outside the run home`);
  }
  for (const plugin of init.plugins ?? []) {
    if (plugin.path && plugin.path !== 'builtin' && !isInside(plugin.path, runHome)) problems.push(`plugin ${plugin.name} loaded from ${plugin.path}, outside the run home`);
  }
  return problems;
}

/**
 * Instruction and memory files a session loaded, from its session log. Claude Code records them as
 * `{"type":"attachment","attachment":{"type":"instructions","files":[{"path","type","content"}]}}`;
 * any other attachment carrying `files[].path` with content, or a CLAUDE.md `path`, is included too.
 */
export function loadedInstructionFiles(sessionText) {
  const files = new Set();
  for (const event of lines(sessionText)) {
    const attachment = event.type === 'attachment' ? event.attachment : null;
    if (!attachment) continue;
    for (const file of attachment.files ?? []) if (typeof file?.path === 'string' && (attachment.type === 'instructions' || 'content' in file)) files.add(file.path);
    if (typeof attachment.path === 'string' && /(^|\/)(CLAUDE(\.local)?|AGENTS)\.md$/.test(attachment.path)) files.add(attachment.path);
  }
  return [...files].sort();
}

/** Loaded instruction files outside every allowed root (the run home and the working copy). */
export const strayInstructionFiles = (files, roots) => files.filter((file) => !roots.some((root) => isInside(file, root)));

/** Slash commands a session expanded (`<command-name>/x</command-name>` in its user messages). */
export function invokedCommands(sessionText) {
  const commands = [];
  for (const event of lines(sessionText)) {
    if (event.type !== 'user') continue;
    const content = event.message?.content;
    const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((block) => block?.text ?? '').join('\n') : '');
    for (const match of text.matchAll(/<command-name>\/?([^<\s]+)<\/command-name>/g)) commands.push(match[1]);
  }
  return commands;
}

/** Notional USD a session reported in its last `cost-state` entry; null when it has none. */
export function sessionCostUsd(sessionText) {
  let cost = null;
  for (const event of lines(sessionText)) if (event.type === 'cost-state' && typeof event.totalCostUSD === 'number') cost = Math.max(cost ?? 0, event.totalCostUSD);
  return cost;
}

/** A skill's name: its SKILL.md front matter `name:` (plugins may name a skill unlike its directory), else the directory. */
export function skillName(text, directory) {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  return /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(frontMatter)?.[1] ?? path.basename(directory);
}

const isSkillNamed = (file, name) => path.basename(file) === 'SKILL.md' && skillName(fs.readFileSync(file, 'utf8'), path.dirname(file)) === name;

const findFile = (root, predicate, exists) => {
  if (!exists(root)) return null;
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) stack.push(full);
      else if (entry.isFile() && predicate(full)) return full;
    }
  }
  return null;
};

/**
 * Components in an arm's probe that are neither built in (listed by an empty home's probe) nor backed
 * by a file under the arm home. `installed` maps plugin names to their install directories.
 */
export function unexplainedComponents({ components, builtins, home, installed, exists = fs.existsSync }) {
  const problems = [];
  const builtinSkills = new Set(builtins.skills);
  const builtinAgents = new Set(builtins.agents);
  const builtinPlugins = new Set(builtins.plugins.map((plugin) => plugin.name));
  const inPlugin = (qualified, predicate) => {
    const [plugin, name] = qualified.split(/:(.*)/s, 2);
    const root = installed[plugin];
    return root && isInside(root, home) ? findFile(root, (file) => predicate(file, name), exists) : null;
  };
  for (const skill of components.skills) {
    if (builtinSkills.has(skill)) continue;
    const found = skill.includes(':')
      ? inPlugin(skill, (file, name) => isSkillNamed(file, name) || file.endsWith(`/commands/${name}.md`))
      : findFile(path.join(home, '.claude', 'skills'), (file) => isSkillNamed(file, skill), exists) ?? (exists(path.join(home, '.claude', 'commands', `${skill}.md`)) ? skill : null);
    if (!found) problems.push(`skill ${skill} has no file under the arm home`);
  }
  for (const agent of components.agents) {
    if (builtinAgents.has(agent)) continue;
    const found = agent.includes(':')
      ? inPlugin(agent, (file, name) => file.endsWith(`/agents/${name}.md`))
      : (exists(path.join(home, '.claude', 'agents', `${agent}.md`)) ? agent : null);
    if (!found) problems.push(`agent ${agent} has no file under the arm home`);
  }
  for (const plugin of components.plugins) {
    if (builtinPlugins.has(plugin.name)) continue;
    if (!installed[plugin.name] || !plugin.path?.startsWith('~')) problems.push(`plugin ${plugin.name} (${plugin.path}) is not installed under the arm home`);
  }
  return problems;
}

/** Components that a `plugin:<id>` removal should have taken out but the arm's probe still lists. */
export function removalLeftovers(components, removedPlugins = []) {
  const problems = [];
  for (const removed of removedPlugins) {
    for (const plugin of removed.plugins) {
      const left = [
        ...components.plugins.filter((entry) => entry.name === plugin).map((entry) => `plugin ${entry.name}`),
        ...components.skills.filter((skill) => skill.startsWith(`${plugin}:`)),
        ...components.agents.filter((agent) => agent.startsWith(`${plugin}:`))
      ];
      if (left.length) problems.push(`plugin:${removed.id} still loads ${left.join(', ')}`);
    }
    const skills = removed.skills.filter((skill) => components.skills.includes(skill));
    if (skills.length) problems.push(`plugin:${removed.id} still loads skills ${skills.join(', ')}`);
  }
  return problems;
}
