// Claude Code provider: headless agent runs in an isolated CLAUDE_CONFIG_DIR, transcript parsing, judging.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { baseEnv } from '../env.mjs';

/**
 * Auth for isolated config dirs. Prefers ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN from the
 * caller's env; otherwise reads the live login's short-lived access token, read-only, on every
 * spawn. The refresh token is never copied, so isolated runs cannot rotate the live login.
 */
export function claudeAuthEnv(env = process.env, home = os.homedir()) {
  if (env.ANTHROPIC_API_KEY) return { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
  if (env.CLAUDE_CODE_OAUTH_TOKEN) return { CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN };
  const credentials = path.join(home, '.claude', '.credentials.json');
  try {
    const token = JSON.parse(fs.readFileSync(credentials, 'utf8')).claudeAiOauth?.accessToken;
    if (token) return { CLAUDE_CODE_OAUTH_TOKEN: token };
  } catch {
    // fall through to the error below
  }
  throw new Error('No Claude credentials: set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN, or log in with `claude`.');
}

const claudeEnv = (home, extra = {}, tmp = null) => ({
  ...baseEnv(home, tmp),
  CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
  ...claudeAuthEnv(),
  ...extra
});

/** Normalises Claude Code `--output-format stream-json --verbose` output. */
export function parseTranscript(text) {
  const result = {
    model: null,
    events: { reads: [], commands: [], skills: [] },
    toolCalls: 0,
    toolsByName: {},
    turns: null,
    durationMs: null,
    costUsd: null,
    usage: null,
    resultText: '',
    subtype: null,
    isError: null
  };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.type === 'system' && message.subtype === 'init') result.model = message.model ?? null;
    if (message.type === 'assistant') {
      for (const block of message.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        result.toolCalls += 1;
        result.toolsByName[block.name] = (result.toolsByName[block.name] ?? 0) + 1;
        const input = block.input ?? {};
        if (block.name === 'Bash' && input.command) result.events.commands.push(String(input.command));
        if (block.name === 'Read' && input.file_path) result.events.reads.push(String(input.file_path));
        if (block.name === 'Skill' && input.skill) result.events.skills.push(String(input.skill));
      }
    }
    if (message.type === 'result') {
      const usage = message.usage ?? {};
      result.usage = {
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0
      };
      result.costUsd = message.total_cost_usd ?? null;
      result.durationMs = message.duration_ms ?? null;
      result.turns = message.num_turns ?? null;
      result.resultText = message.result ?? '';
      result.subtype = message.subtype ?? null;
      result.isError = message.is_error ?? null;
    }
  }
  return result;
}

export const PROBE_MODEL = 'claude-haiku-5-5';

const runProcess = ({ args, cwd, env, stdoutFile, stderrFile, stdin, timeoutMs }) => new Promise((resolve) => {
  const started = Date.now();
  const out = stdoutFile ? fs.openSync(stdoutFile, 'w') : 'pipe';
  const err = stderrFile ? fs.openSync(stderrFile, 'w') : 'pipe';
  const child = spawn('claude', args, { cwd, env, stdio: [stdin === undefined ? 'ignore' : 'pipe', out, err], detached: true });
  let stdout = '';
  if (out === 'pipe') child.stdout.on('data', (chunk) => { stdout += chunk; });
  if (stdin !== undefined) child.stdin.end(stdin);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  }, timeoutMs);
  const finish = (code) => {
    clearTimeout(timer);
    // The agent's own children (dev servers, watchers) share its process group: stop them with it.
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* group already empty */ }
    if (typeof out === 'number') fs.closeSync(out);
    if (typeof err === 'number') fs.closeSync(err);
    resolve({ exitCode: code, timedOut, wallMs: Date.now() - started, stdout });
  };
  child.on('error', () => finish(-1));
  child.on('exit', finish);
});

export const claudeProvider = {
  name: 'claude',
  parseTranscript,
  transcriptFile: 'transcript.jsonl',

  /** Where Claude Code keeps session logs for a config home (one jsonl per session, subagents below). */
  sessionRoot: (home) => path.join(home, '.claude', 'projects'),

  async runAgent({ home, cwd, tmp, prompt, model, effort, transcriptPath, stderrPath, timeoutMs, env = {} }) {
    const args = ['-p', prompt, '--model', model, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', '--strict-mcp-config'];
    if (effort) args.push('--effort', effort);
    return runProcess({ args, cwd, env: claudeEnv(home, env, tmp), stdoutFile: transcriptPath, stderrFile: stderrPath, timeoutMs });
  },

  /**
   * One cheap session that only reports what loaded: its init event lists the skills, plugins, agents
   * and MCP servers a run under this home will see. Returns the stream-json text.
   */
  async probe({ home, cwd, tmp, transcriptPath, model = PROBE_MODEL, timeoutMs = 3 * 60 * 1000 }) {
    const args = ['-p', 'Reply with the single word ok.', '--model', model, '--output-format', 'stream-json', '--verbose', '--strict-mcp-config', '--max-turns', '1'];
    const result = await runProcess({ args, cwd, env: claudeEnv(home, {}, tmp), stdoutFile: transcriptPath, timeoutMs });
    const text = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
    if (result.exitCode !== 0) throw new Error(`probe session in ${home} exited ${result.exitCode}${result.timedOut ? ' (timeout)' : ''}: ${text.slice(-300)}`);
    return text;
  },

  async ask({ home, prompt, model, effort, timeoutMs = 10 * 60 * 1000 }) {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    const args = ['-p', '--model', model, '--tools', '', '--output-format', 'json', '--strict-mcp-config'];
    if (effort) args.push('--effort', effort);
    // Judge from a fresh empty directory outside the eval tree. Claude Code loads CLAUDE.md from the
    // cwd's ancestors (a judge home under the user's home picked up the live ~/.claude/CLAUDE.md) and
    // shows the cwd to the model, so the cwd must not sit under a home or carry the eval's name.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-'));
    let stdout;
    let exitCode;
    try {
      ({ stdout, exitCode } = await runProcess({ args, cwd, env: claudeEnv(home), stdin: prompt, timeoutMs }));
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
    if (exitCode !== 0) throw new Error(`claude judge exited ${exitCode}: ${stdout.slice(0, 300)}`);
    const envelope = JSON.parse(stdout);
    return { text: envelope.result ?? '', costUsd: envelope.total_cost_usd ?? 0 };
  }
};
