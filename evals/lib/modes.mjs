// Input modes with MCP servers: the per-run `--mcp-config` file and what a run's init event must show.
// See "Input modes" in evals/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { TELEMETRY_OFF } from './env.mjs';

// The agent's credentials; a task-set MCP server never needs them.
const AUTH_VARS = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'];

/** Names of the MCP servers a run in `modeName` must have connected (sorted; empty without servers). */
export const expectedMcpServers = (taskSet, modeName) => Object.keys(taskSet.modes?.[modeName]?.mcpServers ?? {}).sort();

/**
 * The `--mcp-config` content for a run in `modeName`, in the shape Claude Code reads:
 * `{ "mcpServers": { <name>: { command, args, env } } }`. Placeholders `{serverDir}` (the run's copy of
 * the mode's `serverFiles`), `{runDir}`, `{appDir}` and `{fixtureDir}` are expanded in command, args and
 * env. Each server starts through `env -u` so it never sees the agent's credentials, with telemetry off.
 * Returns null for a mode without servers.
 */
export function mcpConfigFor({ taskSet, modeName, fixtureDir, runDir, appDir, serverDir }) {
  const servers = taskSet.modes?.[modeName]?.mcpServers;
  if (!servers || !Object.keys(servers).length) return null;
  const expand = (value) => value.replaceAll('{serverDir}', serverDir).replaceAll('{runDir}', runDir).replaceAll('{appDir}', appDir).replaceAll('{fixtureDir}', fixtureDir);
  const mcpServers = {};
  for (const [name, spec] of Object.entries(servers).sort(([a], [b]) => a.localeCompare(b))) {
    mcpServers[name] = {
      command: 'env',
      args: [...AUTH_VARS.flatMap((variable) => ['-u', variable]), expand(spec.command), ...(spec.args ?? []).map(expand)],
      env: { ...TELEMETRY_OFF, ...Object.fromEntries(Object.entries(spec.env ?? {}).map(([key, value]) => [key, expand(value)])) }
    };
  }
  return { mcpServers };
}

/**
 * Prepares a run's MCP servers in its sandbox dir: copies the mode's `serverFiles` to
 * `<runDir>/mcp/<mode>/` (so the config names nothing under the repository, which holds hidden tests)
 * and writes `<runDir>/mcp/config.json`. Returns the config path, or null for a mode without servers.
 */
export function writeMcpConfig({ taskSet, modeName, fixtureDir, runDir, appDir }) {
  const mode = taskSet.modes?.[modeName];
  const serverDir = path.join(runDir, 'mcp', modeName ?? 'none');
  const config = mcpConfigFor({ taskSet, modeName, fixtureDir, runDir, appDir, serverDir });
  if (!config) return null;
  fs.mkdirSync(serverDir, { recursive: true });
  if (mode.serverFiles) fs.cpSync(path.join(fixtureDir, mode.serverFiles), serverDir, { recursive: true });
  const file = path.join(runDir, 'mcp', 'config.json');
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return file;
}
