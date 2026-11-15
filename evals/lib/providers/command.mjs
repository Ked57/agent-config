// Judge-only provider that pipes the prompt to any CLI on stdin and reads the reply from stdout,
// e.g. `--judge-command "codex exec -"` or `--judge-command "llm -m gpt-5"`. Cost is unknown (0).
import { spawn } from 'node:child_process';
import { baseEnv } from '../env.mjs';

export const commandProvider = (command) => ({
  name: 'command',
  async ask({ home, prompt, timeoutMs = 10 * 60 * 1000 }) {
    return new Promise((resolve, reject) => {
      // The judge command runs with the caller's env (it may need its own credentials) plus telemetry off.
      const child = spawn('bash', ['-c', command], { cwd: home, env: { ...process.env, ...baseEnv(process.env.HOME) }, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
      child.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ text: stdout, costUsd: 0 });
        else reject(new Error(`judge command exited ${code}: ${stderr.slice(0, 300)}`));
      });
      child.stdin.end(prompt);
    });
  }
});
