import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { validateTaskSet } from '../evals/lib/config.mjs';
import { scoreLayout } from '../evals/fixtures/vue-primevue/design/scorer/layout.mjs';
import { scoreA11y } from '../evals/fixtures/vue-primevue/design/scorer/a11y.mjs';
import { normalise, similarity } from '../evals/fixtures/vue-primevue/design/scorer/visual.mjs';
import { cropPng } from '../evals/fixtures/vue-primevue/figma-stub/png.mjs';

// The vue-design task set: its Figma MCP stub (protocol, tools, leak control), the pure parts of the
// design scorer, and the wiring between task, screen data and stub. The browser half of the scorer is
// exercised by `npm run eval:mutants -- --set vue-design`.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'evals', 'fixtures', 'vue-primevue');
const STUB = path.join(FIXTURE, 'figma-stub');
const DESIGN = path.join(FIXTURE, 'design');
const taskSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'tasks', 'vue-design.json'), 'utf8'));
const screens = fs.readdirSync(DESIGN).filter((name) => fs.existsSync(path.join(DESIGN, name, 'screen.json')));

function stubFiles(dir = STUB) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? stubFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

test('figma stub holds only what a Figma file exposes: no source, component library, test ids or hidden checks', () => {
  const hidden = new Set(['Row actions', 'Date range', 'Mentions: SMS', 'noHorizontalOverflow', 'sameRow', 'stacked', 'visibleText', 'hiddenText', 'baselines', 'layout.json', '.design-score']);
  for (const name of screens) {
    const screen = JSON.parse(fs.readFileSync(path.join(DESIGN, name, 'screen.json'), 'utf8'));
    for (const specs of Object.values(screen.layout)) for (const spec of specs) if (spec.id.includes('-')) hidden.add(spec.id);
    for (const behaviour of screen.behaviour) hidden.add(behaviour.id);
  }
  const forbidden = [/primevue/i, /\.vue\b/, /data-pc-/, /data-testid/, /\baria-/, /(?<![A-Za-z0-9_-])p-[a-z]/, /tailwindcss-primeui/, /from ['"]/];
  const files = stubFiles().filter((file) => /\.(json|mjs|md|txt)$/.test(file));
  assert.ok(files.some((file) => file.endsWith('.json') && !file.endsWith('files.json')), 'no frame bundles found');
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(STUB, file);
    if (!file.endsWith('.mjs')) for (const pattern of forbidden) assert.doesNotMatch(text, pattern, `${relative} matches ${pattern}`);
    if (!file.endsWith('.mjs')) for (const string of hidden) assert.ok(!text.includes(string), `${relative} contains the hidden check string "${string}"`);
  }
  for (const file of stubFiles().filter((name) => name.endsWith('.mjs'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of [/primevue/i, /data-testid/, /\.\.\//]) assert.doesNotMatch(text, pattern, `${path.relative(STUB, file)} matches ${pattern}`);
  }
});

async function withStub(fn) {
  const server = spawn(process.execPath, [path.join(STUB, 'server.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: server.stdout });
  const waiting = new Map();
  lines.on('line', (line) => {
    const message = JSON.parse(line);
    waiting.get(message.id)?.(message);
    waiting.delete(message.id);
  });
  let next = 0;
  const call = (method, params) => new Promise((resolve) => {
    next += 1;
    waiting.set(next, resolve);
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: next, method, params })}\n`);
  });
  try {
    return await fn(call);
  } finally {
    server.kill();
  }
}

const file = Object.keys(JSON.parse(fs.readFileSync(path.join(STUB, 'files.json'), 'utf8')))[0];

test('figma stub speaks MCP over stdio and lists exactly the four read-only design tools', async () => {
  await withStub(async (call) => {
    const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.ok(init.result.capabilities.tools);
    const { result } = await call('tools/list', {});
    assert.deepEqual(result.tools.map((tool) => tool.name).sort(), ['get_design_context', 'get_metadata', 'get_screenshot', 'get_variable_defs']);
    for (const tool of result.tools) {
      assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(), ['clientFrameworks', 'clientLanguages', 'fileKey', 'nodeId']);
      assert.equal(tool.annotations.readOnlyHint, true);
    }
    const unknown = await call('tools/call', { name: 'add_code_connect_map', arguments: {} });
    assert.ok(unknown.error);
  });
});

test('figma stub resolves frame links and node ids and returns metadata, code, variables and screenshots', async () => {
  const link = `https://www.figma.com/design/${file}/Some-File?node-id=12-2&m=dev`;
  await withStub(async (call) => {
    const tool = async (name, args) => (await call('tools/call', { name, arguments: args })).result;
    const pages = await tool('get_metadata', { fileKey: file });
    assert.match(pages.content[0].text, /<canvas id="0:1"[^>]*>\n\s+<frame id="12:2"/);
    const outline = await tool('get_metadata', { fileKey: link, nodeId: '12-2' });
    assert.match(outline.content[0].text, /^<frame id="12:2" name="[^"]+" x="0" y="0" width="1440" height="\d+">/);
    const child = outline.content[0].text.match(/<frame id="(\d+:\d+)" name="Card\/Revenue"/)[1];
    const fromUrl = await tool('get_metadata', { nodeId: link });
    assert.equal(fromUrl.content[0].text, outline.content[0].text);
    const code = await tool('get_design_context', { fileKey: file, nodeId: child.replace(':', '-'), clientLanguages: 'typescript', clientFrameworks: 'vue' });
    assert.match(code.content[0].text, /export default function \w+\(\) \{/);
    assert.match(code.content[0].text, new RegExp(`data-node-id="${child}"`));
    assert.match(code.content[1].text, /React\+Tailwind code MUST be converted/);
    const frame = await tool('get_design_context', { fileKey: file, nodeId: '12:2' });
    assert.match(frame.content[0].text, /too large/);
    const variables = JSON.parse((await tool('get_variable_defs', { fileKey: file, nodeId: child })).content[0].text);
    assert.match(Object.keys(variables).join(' '), /color\/surface\/\d+/);
    assert.match(Object.values(variables).join(' '), /Font\(family: "Inter"/);
    const shot = await tool('get_screenshot', { fileKey: file, nodeId: child });
    assert.equal(shot.content[0].type, 'image');
    assert.equal(shot.content[0].mimeType, 'image/png');
    assert.equal(Buffer.from(shot.content[0].data, 'base64').readUInt32BE(16), 268);
    const missing = await tool('get_screenshot', { fileKey: file, nodeId: '999:1' });
    assert.equal(missing.isError, true);
    const wrongFile = await tool('get_metadata', { fileKey: 'nope' });
    assert.equal(wrongFile.isError, true);
  });
});

function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  const chunk = (type, body) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), body])) >>> 0);
    return Buffer.concat([length, Buffer.from(type), body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('cropPng cuts a region out of an RGBA PNG', () => {
  const source = png(10, 8, (x, y) => [x * 20, y * 30, 0, 255]);
  const cropped = cropPng(source, { x: 2, y: 3, width: 4, height: 2 });
  assert.equal(cropped.readUInt32BE(16), 4);
  assert.equal(cropped.readUInt32BE(20), 2);
  const again = cropPng(cropped, { x: 0, y: 0, width: 1, height: 1 });
  const raw = zlib.inflateSync(again.subarray(again.indexOf('IDAT') + 4, again.length - 16));
  assert.deepEqual([...raw.subarray(1, 5)], [40, 90, 0, 255]);
});

const image = (width, height, pixel) => {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
};
const page = (shiftX = 0, shiftY = 0, colour = [16, 185, 129, 255], height = 256) => image(256, height, (x, y) => {
  const inCard = x >= 40 + shiftX && x < 200 + shiftX && y >= 40 + shiftY && y < 120 + shiftY;
  const stripe = inCard && (y - shiftY) % 8 < 3;
  return stripe ? colour : inCard ? [255, 255, 255, 255] : [248, 250, 252, 255];
});

test('visual similarity: identical is 1, a 2 px shift is free, larger shifts cost, wrong colours or missing content cost everything', () => {
  const mockup = page();
  assert.equal(similarity(mockup, page()).sim, 1);
  assert.equal(similarity(mockup, page(2, 0)).sim, 1);
  const shifted = similarity(mockup, page(8, 8)).sim;
  const recoloured = similarity(mockup, page(0, 0, [99, 102, 241, 255])).sim;
  const empty = similarity(mockup, image(256, 256, () => [248, 250, 252, 255])).sim;
  assert.ok(shifted > 0.6 && shifted < 0.9, `shifted ${shifted}`);
  assert.ok(recoloured < 0.5, `recoloured ${recoloured}`);
  assert.ok(empty < shifted, `empty ${empty}`);
  assert.ok(similarity(mockup, page(0, 0, undefined, 512)).heightRatio === 0.5);
  assert.equal(normalise(empty, empty), 0);
  assert.equal(normalise(1, empty), 1);
  assert.equal(normalise(0, 0.5), 0);
});

test('layout score: position and size credit times style credit per element, order and coverage per frame', () => {
  const box = (x, y, extra = {}) => ({ x, y, width: 100, height: 20, fontSize: 14, fontWeight: 400, lineHeight: 20, color: [15, 23, 42], background: [255, 255, 255], radius: 0, padding: [0, 0, 0, 0], border: null, ...extra });
  const reference = { a: box(0, 0), b: box(0, 40), c: box(200, 40) };
  assert.equal(scoreLayout(reference, reference).score, 1);
  // Within 4 px and 4 % is exact enough.
  assert.equal(scoreLayout(reference, { a: box(4, 0), b: box(0, 43, { width: 104 }), c: box(200, 40) }).score, 1);
  // 14 px off: half the position credit; 24 px off: none.
  const off = scoreLayout(reference, { a: box(0, 0), b: box(0, 54), c: box(200, 64) });
  assert.equal(off.elements.b, 0.75);
  assert.equal(off.elements.c, 0.5);
  // Style is multiplicative: one weight step (100) off keeps half, a wrong text colour or background none.
  const styled = scoreLayout(reference, { a: box(0, 0, { fontWeight: 500 }), b: box(0, 40, { color: [2, 132, 199] }), c: box(200, 40, { background: [209, 250, 229] }) });
  assert.equal(styled.elements.a, 0.5);
  assert.equal(styled.elements.b, 0);
  assert.equal(styled.elements.c, 0);
  // A border the reference does not have, or a missing one, costs the whole style credit.
  assert.equal(scoreLayout(reference, { ...reference, a: box(0, 0, { border: [226, 232, 240] }) }).elements.a, 0);
  const missing = scoreLayout(reference, { a: reference.a, b: null, c: reference.c });
  assert.equal(missing.coverage, 2 / 3);
  const swapped = scoreLayout(reference, { a: box(0, 80), b: box(0, 40), c: box(200, 40) });
  assert.ok(swapped.order < 1);
  assert.equal(scoreLayout(reference, { a: null, b: null, c: null }).score, 0);
});

test('a11y score: penalty per violated rule by impact, scaled by layout coverage', () => {
  assert.equal(scoreA11y([], 1), 1);
  assert.equal(scoreA11y([], 0), 0);
  assert.ok(Math.abs(scoreA11y([{ id: 'a', impact: 'critical' }, { id: 'b', impact: 'serious' }, { id: 'c', impact: 'minor' }], 1) - 0.58) < 1e-9);
  assert.equal(scoreA11y(Array.from({ length: 5 }, () => ({ impact: 'critical' })), 1), 0);
});

test('vue-design task set is valid and wired to its screens, mockups and stub frames', () => {
  assert.deepEqual(validateTaskSet(taskSet), []);
  const [first] = taskSet.tasks;
  assert.match(validateTaskSet({ ...taskSet, tasks: [{ ...first, checks: [{ ...first.checks[0], browserTools: 'yes' }] }] }).join('\n'), /browserTools must be true or false/);
  assert.match(validateTaskSet({ ...taskSet, tasks: [{ ...first, checks: [{ ...first.checks[0], weight: 0 }] }] }).join('\n'), /weight must be a positive number/);
  const files = JSON.parse(fs.readFileSync(path.join(STUB, 'files.json'), 'utf8'));
  const nodes = new Set(Object.values(files).flatMap((entry) => entry.pages.flatMap((pageEntry) => pageEntry.frames.map((frame) => frame.nodeId))));
  for (const task of taskSet.tasks) {
    for (const check of task.checks) {
      assert.equal(check.browserTools, true, `${task.id}/${check.id} needs browserTools`);
      for (const from of Object.keys(check.copy)) assert.ok(fs.existsSync(path.join(FIXTURE, from)), `${task.id}: ${from} missing`);
    }
    assert.deepEqual(task.checks.map((check) => check.id), ['visual', 'layout', 'behaviour', 'a11y']);
    for (const [, nodeId] of task.prompt.matchAll(/node-id=(\d+-\d+)/g)) assert.ok(nodes.has(nodeId.replace('-', ':')), `${task.id}: prompt links unknown node ${nodeId}`);
    for (const from of Object.keys(task.modes?.['screenshot-only']?.files ?? {})) assert.ok(fs.existsSync(path.join(FIXTURE, from)), `${task.id}: ${from} missing`);
  }
  for (const name of screens) {
    const screen = JSON.parse(fs.readFileSync(path.join(DESIGN, name, 'screen.json'), 'utf8'));
    const layout = JSON.parse(fs.readFileSync(path.join(DESIGN, name, 'layout.json'), 'utf8'));
    const baselines = JSON.parse(fs.readFileSync(path.join(DESIGN, name, 'baselines.json'), 'utf8'));
    for (const frame of screen.frames) {
      assert.ok(fs.existsSync(path.join(STUB, name, `${frame.id}.png`)), `${name}/${frame.id}.png missing`);
      assert.ok(nodes.has(frame.nodeId.replace('-', ':')), `${name}/${frame.id} not in files.json`);
      assert.ok(baselines.frames[frame.id] > 0 && baselines.frames[frame.id] < 1, `${name}/${frame.id} baseline`);
      assert.deepEqual(Object.keys(layout.frames[frame.id] ?? {}).sort(), (screen.layout[frame.id] ?? []).map((spec) => spec.id).sort(), `${name}/${frame.id}: layout.json is stale, re-run export-frames`);
    }
    for (const behaviour of screen.behaviour) if (behaviour.frame) assert.ok(screen.frames.some((frame) => frame.id === behaviour.frame), `${name}/${behaviour.id}: unknown frame`);
  }
});
