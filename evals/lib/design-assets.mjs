// Design mockups (PNG) and Figma bundles under `fixtures/<fixture>/figma-stub/<screen>/` are generated
// from each screen's hidden reference implementation by `design/tools/export-frames.mjs`, not committed:
// they are about 5 MB of binary output that renders byte-identically from the pinned Chromium and fonts.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const STUB_SCREEN = /figma-stub\/([a-z0-9-]+)\//g;

/** Screens whose stub assets the given tasks read (check copies and attached mode files). */
export function designScreens(tasks) {
  const screens = new Set();
  for (const task of tasks) for (const match of JSON.stringify(task).matchAll(STUB_SCREEN)) screens.add(match[1]);
  return [...screens].sort();
}

/** Screens of `fixtureDir` whose `figma-stub/<screen>/` lacks a PNG for any frame in `design/<screen>/screen.json`. */
export function missingDesignScreens(fixtureDir, screens) {
  return screens.filter((name) => {
    const screenFile = path.join(fixtureDir, 'design', name, 'screen.json');
    if (!fs.existsSync(screenFile)) return false;
    const { frames } = JSON.parse(fs.readFileSync(screenFile, 'utf8'));
    return frames.some((frame) => !fs.existsSync(path.join(fixtureDir, 'figma-stub', name, `${frame.id}.png`)));
  });
}

export const allDesignScreens = (fixtureDir) => {
  const design = path.join(fixtureDir, 'design');
  if (!fs.existsSync(design)) return [];
  return fs.readdirSync(design, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(design, entry.name, 'screen.json')))
    .map((entry) => entry.name).sort();
};

/**
 * When any of `tasks` reads stub assets, generates every screen that lacks them: a Figma MCP mode copies
 * the whole stub into the run, and its content enters the reuse key, so the set must not depend on which
 * tasks ran first. Throws when an export fails.
 */
export function ensureDesignAssets(fixtureDir, tasks, log = console.log) {
  if (!designScreens(tasks).length) return [];
  const missing = missingDesignScreens(fixtureDir, allDesignScreens(fixtureDir));
  for (const name of missing) exportScreen(fixtureDir, name, log);
  return missing;
}

export function exportScreen(fixtureDir, name, log = console.log) {
  log(`Generating design assets for ${name} (about 30 s) ...`);
  const result = spawnSync(process.execPath, [path.join(fixtureDir, 'design', 'tools', 'export-frames.mjs'), name], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`export-frames ${name} failed:\n${`${result.stdout}${result.stderr}`.split('\n').slice(-20).join('\n')}`);
}
