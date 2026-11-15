// Environment shared by every isolated agent process. Nothing from the caller's env leaks in
// except PATH and locale, so live config (HOME, CLAUDE_CONFIG_DIR, CODEX_HOME) cannot be reached.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** Telemetry and update checks off for every tool that honours these variables. */
export const TELEMETRY_OFF = Object.freeze({
  DISABLE_TELEMETRY: '1',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_AUTOUPDATER: '1',
  DO_NOT_TRACK: '1',
  NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  NEXT_TELEMETRY_DISABLED: '1'
});

export function baseEnv(home) {
  return {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? 'C.UTF-8',
    TERM: 'dumb',
    HOME: home,
    ...TELEMETRY_OFF
  };
}

/**
 * agent-browser looks for its Chrome under $HOME, which is now an empty arm home. Point it at the
 * live install's browser binary (read-only use) and give each run its own session. `--no-sandbox`
 * is needed where Chrome's sandbox can't start (containers, nested sandboxes); override with --env.
 */
export function browserToolEnv(runId, home = os.homedir()) {
  const env = { AGENT_BROWSER_SESSION: runId.replace(/[^A-Za-z0-9_-]/g, '_'), AGENT_BROWSER_ARGS: '--no-sandbox' };
  const browsers = path.join(home, '.agent-browser', 'browsers');
  try {
    const chrome = fs.readdirSync(browsers).sort().reverse().map((dir) => path.join(browsers, dir, 'chrome')).find((file) => fs.existsSync(file));
    if (chrome) env.AGENT_BROWSER_EXECUTABLE_PATH = chrome;
  } catch {
    // agent-browser not installed; nothing to point at
  }
  return env;
}

/**
 * Claude Code treats `.claude/` (skills, CLAUDE.md, rules, agents, commands), `CLAUDE.md`, `AGENTS.md`
 * and `.mcp.json` in every ancestor of the working directory as project config, whatever HOME and
 * CLAUDE_CONFIG_DIR say. Results kept under the real home therefore expose the live `~/.claude` to
 * both arms. Returns the ancestor paths that exist, nearest first.
 */
export function ancestorAgentConfig(directory) {
  const found = [];
  let current = path.resolve(directory);
  for (;;) {
    const parent = path.dirname(current);
    if (parent === current) return found;
    current = parent;
    for (const name of ['.claude', 'CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.mcp.json']) {
      if (fs.existsSync(path.join(current, name))) found.push(path.join(current, name));
    }
  }
}

/** A TCP port that was free a moment ago: the OS picks it, so smoke servers don't guess into a port an agent's server holds. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}
