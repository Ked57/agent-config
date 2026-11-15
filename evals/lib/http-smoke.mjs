// Optional HTTP smoke step: prepare, boot the service, hit the fixture's endpoints, record results.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TELEMETRY_OFF, freePort } from './env.mjs';

const fill = (value, vars) => value.replaceAll('{port}', String(vars.port)).replaceAll('{tmp}', vars.tmp);

export async function httpSmoke({ fixture, app, outDir }) {
  const spec = fixture.http;
  if (!spec) return null;
  fs.mkdirSync(outDir, { recursive: true });
  const vars = { port: await freePort(), tmp: outDir };
  const env = {
    ...process.env,
    ...TELEMETRY_OFF,
    PATH: `${path.join(app, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}`,
    ...Object.fromEntries(Object.entries(spec.env ?? {}).map(([key, value]) => [key, fill(value, vars)]))
  };
  for (const command of spec.prepare ?? []) {
    const result = spawnSync('bash', ['-c', command], { cwd: app, env, encoding: 'utf8', timeout: 120000 });
    if (result.status !== 0) return { ok: false, error: `prepare failed: ${command}: ${(result.stderr || result.stdout).slice(-400)}`, requests: {} };
  }
  const server = spawn('bash', ['-c', spec.start], { cwd: app, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let exited = false;
  server.on('exit', () => { exited = true; });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${vars.port}`;
  const requests = {};
  try {
    let ready = false;
    // Stop waiting once our server has died: whatever answers on the port then is not this run's service.
    for (let attempt = 0; attempt < 100 && !ready && !exited; attempt += 1) {
      ready = await fetch(base + (spec.readyPath ?? '/')).then(() => true, () => false);
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready || exited) return { ok: false, error: `server did not start: ${output.slice(-400)}`, requests };
    for (const item of spec.requests ?? []) {
      const headers = { ...(item.headers ?? {}) };
      if (item.token) headers.authorization = `Bearer ${item.token}`;
      if (item.body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(base + item.path, { method: item.method ?? 'GET', headers, body: item.body === undefined ? undefined : JSON.stringify(item.body) })
        .catch((error) => ({ status: 0, error: String(error) }));
      requests[item.name ?? `${item.method} ${item.path}`] = { status: response.status, expected: item.expectStatus, ok: response.status === item.expectStatus };
    }
  } finally {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already exited */ }
  }
  return { ok: Object.values(requests).every((request) => request.ok), requests };
}
