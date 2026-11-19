// Deterministic capture of a design screen: build and serve an app, open a frame (viewport, query,
// state steps), wait until it is still, screenshot. Shared by the scorer and the export tools.
// Browser packages come from the eval suite's tools dir ($EVAL_TOOLS_DIR), never from the app.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Every render sees the same moment, so dates and "x ago" texts are stable.
export const FIXED_TIME = '2026-11-16T12:00:00Z';

const STILL_CSS = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}';

export async function loadTools(toolsDir = process.env.EVAL_TOOLS_DIR) {
  if (!toolsDir || !fs.existsSync(path.join(toolsDir, 'node_modules'))) throw new Error('EVAL_TOOLS_DIR is not set or has no node_modules (the suite installs it for checks with "browserTools": true)');
  const require = createRequire(path.join(toolsDir, 'package.json'));
  const { chromium } = await import(pathToFileURL(path.join(toolsDir, 'node_modules', 'playwright', 'index.mjs')).href);
  return {
    chromium,
    PNG: require('pngjs').PNG,
    axeSource: fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  };
}

function freePort() {
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

/** Builds the app with its own Vite, serves `dist` with `vite preview`, runs `fn(baseUrl)`, stops the server. */
export async function withServer(appDir, fn, { build = true } = {}) {
  const app = path.resolve(appDir);
  const vite = path.join(app, 'node_modules', '.bin', 'vite');
  if (build) {
    const result = spawnSync(vite, ['build', '--logLevel', 'error'], { cwd: app, encoding: 'utf8', timeout: 300_000 });
    if (result.status !== 0) throw new Error(`vite build failed: ${`${result.stdout}${result.stderr}`.slice(-800)}`);
  }
  const port = await freePort();
  const server = spawn(vite, ['preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: app, detached: true, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fetch(base);
        break;
      } catch (error) {
        if (attempt > 150) throw new Error(`vite preview did not start: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    return await fn(base);
  } finally {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

export const launch = (chromium) => chromium.launch({ args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });

/** Waits for fonts, network and a DOM that stays unchanged for 300 ms (at most 5 s), then two frames. */
export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.evaluate(() => new Promise((resolve) => {
    let timer;
    const done = () => {
      observer.disconnect();
      clearTimeout(cap);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, 300);
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(done, 300);
    const cap = setTimeout(() => {
      clearTimeout(timer);
      done();
    }, 5000);
  }));
}

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Accessible names match from the start, case-insensitively ("Row actions" also matches "Row actions
 * for Initech"); with `contains` anywhere in the name.
 */
export const nameRe = (name, contains = false) => new RegExp(`${contains ? '' : '^\\s*'}${escapeRe(name)}`, 'i');
const exactRe = (name) => new RegExp(`^\\s*${escapeRe(name)}\\s*$`, 'i');

/**
 * A locator for `{ role, name, level?, nth?, contains? }` or `{ text, nth?, contains? }`. Text matches
 * an element's whole visible text (or a substring with `contains`); `nth` counts visible matches.
 */
export function locate(page, spec) {
  const base = spec.role
    ? page.getByRole(spec.role, { name: nameRe(spec.name ?? '', spec.contains), ...(spec.level ? { level: spec.level } : {}) })
    : page.getByText(spec.text, { exact: !spec.contains });
  return base.filter({ visible: true }).nth(spec.nth ?? 0);
}

/**
 * Picks `option` in the control labelled `control`, whatever it is built with: a native select, a
 * combobox or button that opens options, or a segmented group of radios, tabs or buttons.
 */
async function choose(page, { control, option }) {
  for (const role of ['combobox', 'listbox', 'button']) {
    const field = page.getByRole(role, { name: nameRe(control) }).filter({ visible: true }).first();
    if (!(await field.count())) continue;
    if ((await field.evaluate((element) => element.tagName)) === 'SELECT') return field.selectOption({ label: option });
    await field.click({ timeout: 5000 });
    const choice = page.getByRole('option', { name: exactRe(option) }).filter({ visible: true }).first();
    if (await choice.count()) return choice.click({ timeout: 5000 });
    return page.getByRole('menuitem', { name: exactRe(option) }).or(page.getByText(option, { exact: true })).filter({ visible: true }).last().click({ timeout: 5000 });
  }
  for (const role of ['radio', 'tab', 'button']) {
    const segment = page.getByRole(role, { name: exactRe(option) }).filter({ visible: true }).first();
    if (await segment.count()) return segment.click({ timeout: 5000 });
  }
  throw new Error(`no control labelled "${control}"`);
}

/**
 * Runs state steps: `{ click: { role, name, nth } | { text } }`, `{ choose: { control, option } }` or
 * `{ fill: { role, name, value } }` (types into a text field, replacing its value; "" clears it).
 */
export async function applySteps(page, steps = []) {
  for (const step of steps) {
    if (step.click) await locate(page, step.click).click({ timeout: 5000 });
    else if (step.choose) await choose(page, step.choose);
    else if (step.fill) await locate(page, step.fill).fill(step.fill.value, { timeout: 5000 });
    else throw new Error(`unknown step ${JSON.stringify(step)}`);
    await settle(page);
  }
}

/**
 * Opens a frame in a fresh context: `frame.viewport`, `frame.query` (appended to the route) and
 * `frame.steps`. Returns `{ context, page, error }`; `error` is set when a step could not run.
 */
export async function openFrame(browser, base, route, frame) {
  const context = await browser.newContext({
    viewport: frame.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC'
  });
  await context.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    });
  }, STILL_CSS);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(FIXED_TIME));
  let error = null;
  try {
    await page.goto(`${base}${route}${frame.query ? `?${frame.query}` : ''}`, { waitUntil: 'load', timeout: 30_000 });
    await settle(page);
    // Grow the viewport to the page before any step: a full-page screenshot resizes the viewport, and
    // overlays (menus, select panels) close on resize, so state frames would lose their popup.
    const grow = async () => {
      const { height } = page.viewportSize();
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (scrollHeight > height) {
        await page.setViewportSize({ width: frame.viewport.width, height: scrollHeight });
        await settle(page);
      }
    };
    await grow();
    await applySteps(page, frame.steps);
    // Focusing the first invalid field after a failed submit is good practice, but its focus ring hides
    // the error border a frame draws. Only an invalid field loses focus, so open overlays stay open.
    if (frame.steps?.length) {
      const blurred = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active?.matches?.('[aria-invalid="true"], .p-invalid, .p-invalid *')) return false;
        active.blur();
        return true;
      });
      if (blurred) await settle(page);
    }
    // A state that made the page taller (validation messages, a sticky bar) is grown into again, so
    // sticky and fixed bars sit at the end of the page as on a frame of the whole page.
    if (frame.steps?.length) await grow();
  } catch (caught) {
    error = String(caught?.message ?? caught).split('\n')[0];
  }
  return { context, page, error };
}

export const screenshot = (page) => page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', scale: 'css' });

/**
 * Builds and serves `app`, launches Chromium and calls `fn(open)`, where `open(frame)` opens a frame of
 * `route` (see `openFrame`) and resolves to `{ page, error, close }`.
 */
export function withBrowser({ app, route, tools, build = true }, fn) {
  return withServer(app, async (base) => {
    const browser = await launch(tools.chromium);
    try {
      return await fn(async (frame) => {
        const { context, page, error } = await openFrame(browser, base, route, frame);
        return { page, error, close: () => context.close() };
      });
    } finally {
      await browser.close();
    }
  }, { build });
}
