#!/usr/bin/env node
// Exports a design screen from its hidden reference implementation (harness-only; never shipped):
//
//   node evals/fixtures/vue-primevue/design/tools/export-frames.mjs <screen> [--base <prepared app>]
//
// 1. Copies a prepared fixture (`--base`, or one prepared under $AGENT_CONFIG_EVALS_SANDBOX/design-export)
//    twice and applies `mutants/<task>/reference.patch` to one copy.
// 2. Renders every frame of `design/<screen>/screen.json` in the reference: the PNG (the mockup) and a
//    Figma-like bundle (layer tree and variables) go to `figma-stub/<screen>/`; the key-element boxes go
//    to `design/<screen>/layout.json`. A locator that finds nothing in the reference is an error.
// 3. Renders the same frames in the untouched copy and stores each frame's raw visual similarity to the
//    mockup in `design/<screen>/baselines.json` (the score's zero point).
// 4. Registers the frames in `figma-stub/files.json` for the MCP stub.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyForRun, loadFixture, preparePristine } from '../../../../lib/fixtures.mjs';
import { ensureBrowserTools } from '../../../../lib/browser.mjs';
import { sandboxRoot } from '../../../../lib/env.mjs';
import { loadTools, screenshot, withBrowser } from '../scorer/capture.mjs';
import { measure } from '../scorer/layout.mjs';
import { similarity } from '../scorer/visual.mjs';
import { collectTree } from './figma-tree.mjs';
import { colourTokensFor } from './figma-variables.mjs';

const DESIGN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.dirname(DESIGN);
const STUB = path.join(FIXTURE, 'figma-stub');

const writeJson = (file, value, compact = false) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, compact ? 0 : 2)}\n`);
};

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];
  if (!name || name.startsWith('-')) throw new Error('usage: export-frames.mjs <screen> [--base <prepared app dir>]');
  const baseIndex = args.indexOf('--base');
  const screenDir = path.join(DESIGN, name);
  const screen = JSON.parse(fs.readFileSync(path.join(screenDir, 'screen.json'), 'utf8'));
  const fixture = loadFixture('vue-primevue');
  const work = path.join(sandboxRoot(), 'design-export');
  const pristine = baseIndex >= 0 ? path.resolve(args[baseIndex + 1]) : preparePristine(fixture, path.join(work, 'cache'));
  const reference = path.join(work, `${name}-reference`);
  const untouched = path.join(work, `${name}-untouched`);
  copyForRun(fixture, pristine, reference);
  copyForRun(fixture, pristine, untouched);
  const patch = path.join(FIXTURE, 'mutants', screen.task, 'reference.patch');
  const applied = spawnSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: reference, encoding: 'utf8' });
  if (applied.status !== 0) throw new Error(`reference.patch does not apply: ${applied.stderr}`);

  process.env.EVAL_TOOLS_DIR ??= ensureBrowserTools(path.join(sandboxRoot(), '.cache'));
  const tools = await loadTools();
  const outDir = path.join(STUB, name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const layout = { generatedFrom: `mutants/${screen.task}/reference.patch`, frames: {} };
  const problems = [];

  await withBrowser({ app: reference, route: screen.route, tools }, async (open) => {
    for (const [index, frame] of screen.frames.entries()) {
      const { page, error, close } = await open(frame);
      try {
        if (error) throw new Error(`${frame.id}: reference cannot reach the state: ${error}`);
        fs.writeFileSync(path.join(outDir, `${frame.id}.png`), await screenshot(page));
        const boxes = await measure(page, screen.layout[frame.id] ?? []);
        for (const [id, found] of Object.entries(boxes)) if (!found) problems.push(`${frame.id}: layout element ${id} not found in the reference`);
        layout.frames[frame.id] = boxes;
        const { tree, colours } = await page.evaluate(collectTree, { idPrefix: String(20 + index) });
        Object.assign(tree, { id: frame.nodeId.replace('-', ':'), name: frame.name });
        writeJson(path.join(outDir, `${frame.id}.json`), {
          fileKey: screen.figma.fileKey,
          fileName: screen.figma.fileName,
          nodeId: frame.nodeId.replace('-', ':'),
          colourTokens: colourTokensFor(colours),
          tree
        }, true);
      } finally {
        await close();
      }
    }
  });
  if (problems.length) throw new Error(`curate design/${name}/screen.json "layout":\n${problems.join('\n')}`);
  writeJson(path.join(screenDir, 'layout.json'), layout);

  const baselines = { generatedFrom: 'untouched fixture', frames: {} };
  await withBrowser({ app: untouched, route: screen.route, tools }, async (open) => {
    for (const frame of screen.frames) {
      // Steps fail on the untouched app; the baseline is whatever the route shows.
      const { page, close } = await open(frame);
      try {
        const mockup = tools.PNG.sync.read(fs.readFileSync(path.join(outDir, `${frame.id}.png`)));
        baselines.frames[frame.id] = Math.round(similarity(mockup, tools.PNG.sync.read(await screenshot(page)), frame.masks ?? []).sim * 1e6) / 1e6;
      } finally {
        await close();
      }
    }
  });
  writeJson(path.join(screenDir, 'baselines.json'), baselines);

  const filesPath = path.join(STUB, 'files.json');
  const files = fs.existsSync(filesPath) ? JSON.parse(fs.readFileSync(filesPath, 'utf8')) : {};
  files[screen.figma.fileKey] = {
    name: screen.figma.fileName,
    pages: [{
      id: '0:1',
      name: screen.figma.pageName,
      frames: screen.frames.map((frame) => ({ nodeId: frame.nodeId.replace('-', ':'), name: frame.name, bundle: `${name}/${frame.id}.json`, screenshot: `${name}/${frame.id}.png` }))
    }]
  };
  writeJson(filesPath, files);
  console.log(`exported ${screen.frames.length} frames of ${name}: baselines ${JSON.stringify(baselines.frames)}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exit(1);
});
