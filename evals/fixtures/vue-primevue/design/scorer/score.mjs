#!/usr/bin/env node
// Design-task scorer, run by a task's `json-score` checks with the worked app as the cwd:
//
//   node .design-score/scorer/score.mjs <visual|layout|components|responsive|behaviour|a11y> [--screen <dir>] [--mockups <dir>] [--json <file>] [--shots <dir>]
//
// One pass builds the app, renders every frame and computes all six components; the result is
// cached (keyed by the app's files, the scorer and the screen data) so the four checks share a pass.
// Writes `{ score, components, detail, findings }` for the requested component to $EVAL_SCORE_FILE:
// `findings` are what a design review would flag (see ../README.md "Findings").
// `--screen` defaults to ../screen and `--mockups` to ../mockups next to this script (the check's
// `copy` puts them there). DESIGN_SCORE_NO_CACHE=1 forces a fresh pass. See ../README.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTools, screenshot, withBrowser } from './capture.mjs';
import { similarity, normalise } from './visual.mjs';
import { measure, scoreLayout } from './layout.mjs';
import { runBehaviour } from './behaviour.mjs';
import { runAxe, scoreA11y } from './a11y.mjs';
import { KIT, kitInventory, scoreInventory } from './kit.mjs';
import { RESPONSIVE_HEIGHT, RESPONSIVE_WIDTHS, responsiveProblems, scoreWidth, sharedSpecs } from './responsive.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = ['visual', 'layout', 'components', 'responsive', 'behaviour', 'a11y'];
const SKIP = new Set(['node_modules', 'dist', '.git', '.design-score', '.vite']);

function hashTree(hash, root, skip = new Set()) {
  if (!fs.existsSync(root)) return;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        hash.update(path.relative(root, full));
        hash.update(fs.readFileSync(full));
      }
    }
  };
  walk(root);
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round = (value) => Math.round(value * 10000) / 10000;

/** Renders every frame of the screen in `app` and scores all components. */
export async function scoreScreen({ app, screenDir, mockupsDir, tools, shotsDir = null }) {
  const screen = JSON.parse(fs.readFileSync(path.join(screenDir, 'screen.json'), 'utf8'));
  const layoutRef = JSON.parse(fs.readFileSync(path.join(screenDir, 'layout.json'), 'utf8'));
  const baselines = JSON.parse(fs.readFileSync(path.join(screenDir, 'baselines.json'), 'utf8'));
  const result = { visual: { frames: {} }, layout: { frames: {} }, components: { frames: {} }, responsive: { widths: {} }, behaviour: { tests: {} }, a11y: { frames: {} } };
  const testsFor = (frameId) => screen.behaviour.filter((test) => test.frame === frameId);
  await withBrowser({ app, route: screen.route, tools }, async (open) => {
    for (const frame of screen.frames) {
      const { page, error, close } = await open(frame);
      try {
        if (error) {
          // A state the implementation can't reach scores 0 for this frame (visual, layout, a11y) and fails its tests.
          result.visual.frames[frame.id] = { score: 0, error };
          result.layout.frames[frame.id] = { score: 0, coverage: 0, error };
          result.components.frames[frame.id] = { score: 0, differences: [], error };
          result.a11y.frames[frame.id] = { score: 0, violations: [], error };
          for (const test of testsFor(frame.id)) result.behaviour.tests[test.id] = { pass: false, reason: `state not reached: ${error}` };
          continue;
        }
        const png = await screenshot(page);
        if (shotsDir) fs.writeFileSync(path.join(shotsDir, `${frame.id}.png`), png);
        const mockup = tools.PNG.sync.read(fs.readFileSync(path.join(mockupsDir, `${frame.id}.png`)));
        const raw = similarity(mockup, tools.PNG.sync.read(png), frame.masks ?? []);
        const base = baselines.frames[frame.id];
        result.visual.frames[frame.id] = { score: normalise(raw.sim, base), sim: raw.sim, ssim: raw.ssim, colour: raw.colour, heightRatio: raw.heightRatio, base };
        const layout = scoreLayout(layoutRef.frames[frame.id] ?? {}, await measure(page, screen.layout[frame.id] ?? []));
        result.layout.frames[frame.id] = { score: layout.score, coverage: layout.coverage, order: layout.order, missing: Object.keys(layout.elements).filter((id) => layout.elements[id] === 0), weak: Object.keys(layout.elements).filter((id) => layout.elements[id] > 0 && layout.elements[id] < 0.5), findings: layout.findings };
        const inventory = scoreInventory(layoutRef.components?.[frame.id] ?? {}, await page.evaluate(kitInventory, KIT));
        if (inventory.score !== null) result.components.frames[frame.id] = inventory;
        for (const test of testsFor(frame.id)) result.behaviour.tests[test.id] = await runBehaviour(page, test);
        const violations = await runAxe(page, tools.axeSource);
        result.a11y.frames[frame.id] = { score: scoreA11y(violations, layout.coverage), violations };
      } finally {
        await close();
      }
    }
    // Widths no frame shows, in the screen's default state (the desktop frame's query, no steps).
    const query = screen.frames.find((frame) => frame.id === 'desktop')?.query;
    for (const width of RESPONSIVE_WIDTHS) {
      const { page, error, close } = await open({ id: `w${width}`, viewport: { width, height: RESPONSIVE_HEIGHT }, ...(query ? { query } : {}) });
      try {
        const specs = sharedSpecs(screen);
        const problems = error ? [{ kind: 'unreached', detail: `page not reached: ${error}` }] : await responsiveProblems(page, specs);
        result.responsive.widths[width] = { score: scoreWidth(problems, specs.length), problems };
      } finally {
        await close();
      }
    }
    for (const test of screen.behaviour.filter((entry) => !entry.frame)) {
      const { page, error, close } = await open(test);
      try {
        result.behaviour.tests[test.id] = error ? { pass: false, reason: `state not reached: ${error}` } : await runBehaviour(page, test);
      } finally {
        await close();
      }
    }
  });
  result.visual.score = mean(Object.values(result.visual.frames).map((frame) => frame.score));
  result.layout.score = mean(Object.values(result.layout.frames).map((frame) => frame.score));
  // A screen whose reference uses no kit component has nothing to match.
  result.components.score = Object.keys(result.components.frames).length ? mean(Object.values(result.components.frames).map((frame) => frame.score)) : 1;
  result.responsive.score = mean(Object.values(result.responsive.widths).map((entry) => entry.score));
  result.behaviour.score = mean(Object.values(result.behaviour.tests).map((test) => (test.pass ? 1 : 0)));
  result.a11y.score = mean(Object.values(result.a11y.frames).map((frame) => frame.score));
  return result;
}

/** What a design review would flag for one component, as `{ category, frame?, element, property, expected, rendered }`. */
function findingsOf(result, component) {
  const part = result[component];
  const unreached = (frame, error) => ({ category: 'state', frame, element: 'frame', property: 'state', expected: 'reached', rendered: String(error).slice(0, 160) });
  if (component === 'layout') return Object.entries(part.frames).flatMap(([frame, entry]) => (entry.error ? [unreached(frame, entry.error)] : (entry.findings ?? []).map((finding) => ({ frame, ...finding }))));
  if (component === 'components') {
    return Object.entries(part.frames).flatMap(([frame, entry]) => (entry.error ? [] : entry.differences.map((difference) => ({
      category: 'component', frame, element: difference.component, property: 'instances', expected: difference.expected, rendered: difference.rendered
    }))));
  }
  if (component === 'responsive') {
    return Object.entries(part.widths).flatMap(([width, entry]) => entry.problems.map((problem) => ({
      category: 'responsive', frame: `${width}px`, element: problem.detail, property: problem.kind, expected: 'adapts', rendered: problem.kind
    })));
  }
  if (component === 'behaviour') return Object.entries(part.tests).filter(([, test]) => !test.pass).map(([id, test]) => ({ category: 'behaviour', element: id, property: 'test', expected: 'pass', rendered: String(test.reason).slice(0, 160) }));
  if (component === 'a11y') return Object.entries(part.frames).flatMap(([frame, entry]) => (entry.error ? [] : entry.violations.map((violation) => ({ category: 'a11y', frame, element: violation.id, property: violation.impact, expected: 'no violation', rendered: `${violation.nodes} node(s)` }))));
  return [];
}

function report(result, component) {
  const part = result[component];
  if (result.error) return { score: 0, components: {}, detail: result.error, findings: [] };
  if (component === 'responsive') {
    const widths = Object.entries(part.widths);
    return {
      score: round(part.score),
      components: Object.fromEntries(widths.map(([width, entry]) => [`${width}px`, round(entry.score)])),
      detail: widths.map(([width, entry]) => `${width}px: ${entry.problems.length ? entry.problems.map((problem) => `${problem.kind} ${problem.detail}`).join('; ') : 'adapts'}`).join('\n'),
      findings: findingsOf(result, component)
    };
  }
  if (component === 'behaviour') {
    const failed = Object.entries(part.tests).filter(([, test]) => !test.pass);
    return {
      score: round(part.score),
      components: Object.fromEntries(Object.entries(part.tests).map(([id, test]) => [id, test.pass ? 1 : 0])),
      detail: failed.length ? failed.map(([id, test]) => `${id}: ${test.reason}`).join('\n') : 'all behaviour tests pass',
      findings: findingsOf(result, component)
    };
  }
  const frames = Object.entries(part.frames);
  const describe = {
    visual: (frame) => (frame.error ? `state not reached: ${frame.error}` : `sim ${frame.sim.toFixed(3)} (ssim ${frame.ssim.toFixed(3)}, colour ${frame.colour.toFixed(3)}, height ${frame.heightRatio.toFixed(3)}), base ${frame.base.toFixed(3)}`),
    components: (frame) => (frame.error ? `state not reached: ${frame.error}` : frame.differences.length ? frame.differences.map((difference) => `${difference.component} ${difference.rendered}/${difference.expected}`).join(', ') : 'every kit component as designed'),
    layout: (frame) => (frame.error ? `state not reached: ${frame.error}` : `coverage ${frame.coverage.toFixed(2)}, order ${frame.order.toFixed(2)}${frame.missing.length ? `, missing ${frame.missing.join(' ')}` : ''}${frame.weak.length ? `, off ${frame.weak.join(' ')}` : ''}`),
    a11y: (frame) => (frame.error ? `state not reached: ${frame.error}` : frame.violations.length ? frame.violations.map((violation) => `${violation.id} (${violation.impact}, ${violation.nodes})`).join(', ') : 'no violations')
  }[component];
  return {
    score: round(part.score),
    components: Object.fromEntries(frames.map(([id, frame]) => [id, round(frame.score)])),
    detail: frames.map(([id, frame]) => `${id}: ${round(frame.score)} ${describe(frame)}`).join('\n'),
    findings: findingsOf(result, component)
  };
}

async function main() {
  const args = process.argv.slice(2);
  const component = args[0];
  if (!COMPONENTS.includes(component) && component !== 'all') throw new Error(`usage: score.mjs <${COMPONENTS.join('|')}|all> [--screen dir] [--mockups dir] [--json file] [--shots dir]`);
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? path.resolve(args[index + 1]) : fallback;
  };
  const app = process.cwd();
  const screenDir = option('--screen', path.join(HERE, '..', 'screen'));
  const mockupsDir = option('--mockups', path.join(HERE, '..', 'mockups'));
  const shotsDir = option('--shots', null);
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

  const hash = crypto.createHash('sha256');
  for (const [root, skip] of [[app, SKIP], [HERE], [screenDir], [mockupsDir]]) {
    hash.update(`\0${root === app ? 'app' : path.basename(root)}\0`);
    hashTree(hash, root, skip);
  }
  const cacheDir = path.join(os.tmpdir(), 'design-score-cache');
  const cacheFile = path.join(cacheDir, `${hash.digest('hex').slice(0, 32)}.json`);
  let result = null;
  if (!process.env.DESIGN_SCORE_NO_CACHE && !shotsDir && fs.existsSync(cacheFile)) result = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (!result) {
    try {
      result = await scoreScreen({ app, screenDir, mockupsDir, tools: await loadTools(), shotsDir });
    } catch (error) {
      result = { error: String(error?.message ?? error).slice(0, 800) };
    }
    if (!result.error) {
      fs.mkdirSync(cacheDir, { recursive: true });
      const temp = `${cacheFile}.${process.pid}`;
      fs.writeFileSync(temp, JSON.stringify(result));
      fs.renameSync(temp, cacheFile);
    }
  }
  if (args.includes('--json')) fs.writeFileSync(option('--json'), `${JSON.stringify(result, null, 2)}\n`);
  if (component === 'all') {
    for (const name of COMPONENTS) console.log(`${name}: ${report(result, name).score}`);
    return;
  }
  const output = report(result, component);
  console.log(`${component}: ${output.score}\n${output.detail}`);
  if (process.env.EVAL_SCORE_FILE) fs.writeFileSync(process.env.EVAL_SCORE_FILE, JSON.stringify(output));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exit(1);
  });
}
