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

/** `tmp`, when given, becomes the process's TMPDIR/TMP/TEMP so concurrent runs never share `/tmp` names. */
export function baseEnv(home, tmp = null) {
  return {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? 'C.UTF-8',
    TERM: 'dumb',
    HOME: home,
    ...(tmp ? { TMPDIR: tmp, TMP: tmp, TEMP: tmp } : {}),
    ...TELEMETRY_OFF
  };
}

export const DEFAULT_SANDBOX = '/var/tmp/agent-config-evals';

/** Root of everything an agent process touches (arm homes, run homes, working copies, caches). */
export const sandboxRoot = (env = process.env) => path.resolve(env.AGENT_CONFIG_EVALS_SANDBOX || DEFAULT_SANDBOX);

/** Whether `child` is `parent` or sits below it. */
export function isInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Reasons the sandbox can't isolate agents: it sits under the real home, or the sandbox or one of its
 * ancestors holds agent config that Claude Code would load as project config for every run.
 */
export function sandboxProblems(sandbox, home = os.homedir()) {
  const problems = [];
  if (isInside(sandbox, home)) problems.push(`the sandbox ${sandbox} is inside the home directory ${home}`);
  const found = ancestorAgentConfig(path.join(sandbox, 'probe'));
  if (found.length) problems.push(`agent config sits above the sandbox: ${found.join(', ')}`);
  return problems;
}

/**
 * Throws unless `root` can own deletable trees: absolute, at least three path segments deep (so never
 * `/`, `/var` or `/var/tmp`), and neither the home directory nor one of its ancestors.
 */
export function assertSafeRoot(root, home = os.homedir()) {
  const resolved = path.resolve(String(root ?? ''));
  const depth = resolved.split(path.sep).filter(Boolean).length;
  if (!root || !path.isAbsolute(String(root)) || depth < 3 || isInside(home, resolved)) throw new Error(`Refusing to treat ${root} as a deletable root (too shallow, or the home or one of its ancestors)`);
  return resolved;
}

/** Recursively deletes `target`, which must sit strictly below `root` (see `assertSafeRoot`). */
export function removeTree(target, root) {
  const base = assertSafeRoot(root);
  const resolved = path.resolve(String(target ?? ''));
  if (!target || !resolved.startsWith(base + path.sep)) throw new Error(`Refusing to delete ${target}: not inside ${base}`);
  fs.rmSync(resolved, { recursive: true, force: true });
}

/**
 * Kills what a run left behind: processes whose environment carries one of `markers` (e.g.
 * `HOME=<run home>`, inherited by everything the agent spawned, even after `setsid`) or whose cwd sits
 * under `root`. `pkill -f <app>` missed servers started with relative paths. Linux only (reads /proc).
 * Returns the killed processes' command lines. `root` must be a run dir (see `assertSafeRoot`) and
 * every marker `KEY=<path>` must name a path inside it.
 */
export function killStrays({ root, markers }) {
  const base = assertSafeRoot(root);
  for (const marker of markers) {
    const value = /^[A-Z_]+=(.+)$/.exec(marker)?.[1];
    if (!value || !path.resolve(value).startsWith(base + path.sep)) throw new Error(`Refusing stray marker ${marker}: not a path inside ${base}`);
  }
  if (!fs.existsSync('/proc/self/environ')) return [];
  const killed = [];
  for (const pid of fs.readdirSync('/proc').filter((name) => /^\d+$/.test(name)).map(Number)) {
    if (pid === process.pid || pid === process.ppid) continue;
    let environ;
    let cwd = '';
    try {
      environ = fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
      cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      if (!environ) continue; // another user's process, or already gone
    }
    if (!isStray({ environ, cwd }, { root: base, markers })) continue;
    let command = String(pid);
    try {
      command = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim() || command;
    } catch {
      // gone already
    }
    try {
      process.kill(pid, 'SIGKILL');
      killed.push(command.slice(0, 200));
    } catch {
      // gone already
    }
  }
  return killed;
}

/**
 * Whether a process belongs to a run: an environment entry equal to a marker (whole entries, so
 * `HOME=/var/tmp/x` never matches `HOME=/var/tmp/x2` or `HOME=/var/tmp`), or a cwd at or below `root`
 * (whole path segments).
 */
export const isStray = ({ environ = [], cwd = '' }, { root, markers }) => markers.some((marker) => environ.includes(marker)) || Boolean(cwd && isInside(cwd, root));

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
