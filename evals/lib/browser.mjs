// Optional browser smoke step: build, serve, visit the fixture's routes, screenshot, record errors.
// Playwright is installed on demand into the eval cache, not into this repository.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGate } from './measure.mjs';
import { TELEMETRY_OFF, freePort } from './env.mjs';

let playwrightPromise = null;

async function loadPlaywright(cacheRoot) {
  const tools = path.join(cacheRoot, 'tools');
  const entry = path.join(tools, 'node_modules', 'playwright', 'index.mjs');
  if (!fs.existsSync(entry)) {
    fs.mkdirSync(tools, { recursive: true });
    const env = { ...process.env, ...TELEMETRY_OFF };
    for (const command of ['npm init -y >/dev/null', 'npm install --no-audit --no-fund --loglevel=error playwright', 'npx playwright install chromium']) {
      const result = spawnSync('bash', ['-c', command], { cwd: tools, env, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`Playwright setup failed (${command}): ${result.stderr}`);
    }
  }
  return import(pathToFileURL(entry).href);
}

export async function browserSmoke({ fixture, app, outDir, cacheRoot }) {
  if (!fixture.browser) return null;
  playwrightPromise ??= loadPlaywright(cacheRoot);
  const { chromium } = await playwrightPromise;
  const build = runGate(fixture.browser.build, app);
  if (!build.ok) return { ok: false, error: 'build failed', routes: {} };
  fs.mkdirSync(outDir, { recursive: true });
  const port = await freePort();
  const server = spawn('bash', ['-c', fixture.browser.serve.replaceAll('{port}', String(port))], {
    cwd: app,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PATH: `${path.join(app, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}` }
  });
  const base = `http://localhost:${port}`;
  const routes = {};
  try {
    for (let attempt = 0; attempt < 75; attempt += 1) {
      try {
        await fetch(base);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      for (const route of fixture.browser.routes ?? ['/']) {
        const errors = [];
        page.removeAllListeners('console');
        page.removeAllListeners('pageerror');
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 }).catch((error) => errors.push(String(error)));
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outDir, `${route.replaceAll('/', '_') || '_root'}.png`), fullPage: true }).catch(() => {});
        const textLength = (await page.locator('body').innerText().catch(() => '')).length;
        routes[route] = { errors, textLength };
      }
    } finally {
      await browser.close();
    }
  } finally {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already exited */ }
  }
  const ok = Object.values(routes).every((route) => route.errors.length === 0 && route.textLength > 0);
  return { ok, routes };
}
