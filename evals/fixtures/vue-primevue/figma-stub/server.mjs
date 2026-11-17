#!/usr/bin/env node
// Offline stand-in for Figma's MCP server (stdio, JSON-RPC 2.0, newline-delimited). Serves the read-only
// design tools get_design_context, get_variable_defs, get_screenshot and get_metadata for the frames
// listed in files.json, from layer trees exported from a rendered design. No network, no writes, no
// Code Connect. See FIDELITY.md for how it differs from the real server.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { cropPng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILES = JSON.parse(fs.readFileSync(path.join(HERE, 'files.json'), 'utf8'));
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
// Above this many characters get_design_context returns the outline instead of code, as the real
// server does for large selections, so the agent fetches sections one by one.
const MAX_CODE_CHARS = 60_000;

const NODE_ID = {
  type: 'string',
  description: 'The ID of the node in the Figma document, eg. "123:456" or "123-456". This should be a valid node ID in the Figma document.'
};
const FILE_KEY = {
  type: 'string',
  description: 'The key of the Figma file to use. If the URL is provided, extract the file key from the URL. The given URL must be in the format https://figma.com/design/:fileKey/:fileName?node-id=:int1-:int2. The extracted fileKey would be `:fileKey`.'
};
const CLIENT_HINTS = {
  clientLanguages: { type: 'string', description: 'A comma separated list of programming languages used by the client in the current context in string form, e.g. `javascript`, `html,css,typescript`, etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which languages are being used. If you are unsure, it is better to list `unknown` than to make a guess.' },
  clientFrameworks: { type: 'string', description: 'A comma separated list of frameworks used by the client in the current context, e.g. `react`, `vue`, `django` etc. If you do not know, please list `unknown`. This is used for logging purposes to understand which frameworks are being used. If you are unsure, it is better to list `unknown` than to make a guess' }
};
const schema = (required) => ({ type: 'object', properties: { nodeId: NODE_ID, fileKey: FILE_KEY, ...CLIENT_HINTS }, required, additionalProperties: false });

const TOOLS = [
  {
    name: 'get_design_context',
    description: 'Generate UI code for a given node or the currently selected node in the Figma desktop app. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`. The response contains React + Tailwind code for the design and instructions for adapting it to the project.',
    inputSchema: schema(['nodeId', 'fileKey']),
    annotations: { readOnlyHint: true }
  },
  {
    name: 'get_variable_defs',
    description: 'Get the variables and styles used in a node, e.g. {\'icon/default/secondary\': #949494}. Variables are reusable values for colours, spacing and typography. If a URL is provided, extract the node id and file key from the URL as for get_design_context.',
    inputSchema: schema(['nodeId', 'fileKey']),
    annotations: { readOnlyHint: true }
  },
  {
    name: 'get_screenshot',
    description: 'Generate a screenshot for a given node. If a URL is provided, extract the node id and file key from the URL as for get_design_context.',
    inputSchema: schema(['nodeId', 'fileKey']),
    annotations: { readOnlyHint: true }
  },
  {
    name: 'get_metadata',
    description: 'Get metadata for a node or page in the Figma desktop app in XML format. Useful only for getting an overview of the structure: it only includes node IDs, layer types, names, positions and sizes. You can call get_design_context on the node IDs contained in this response. Without a node ID it returns the pages of the file.',
    inputSchema: schema(['fileKey']),
    annotations: { readOnlyHint: true }
  }
];

// ---------------------------------------------------------------------------------------------- lookup

const bundles = new Map();
function bundle(file) {
  if (!bundles.has(file)) bundles.set(file, JSON.parse(fs.readFileSync(path.join(HERE, file), 'utf8')));
  return bundles.get(file);
}

/** Pulls a file key and node id out of a Figma URL (design, file or proto links; node-id with - or :). */
function fromUrl(text) {
  const match = String(text ?? '').match(/figma\.com\/(?:design|file|proto|board)\/([A-Za-z0-9]+)(?:\/[^?\s]*)?(?:\?([^\s]*))?/);
  if (!match) return null;
  const node = new URLSearchParams(match[2] ?? '').get('node-id');
  return { fileKey: match[1], nodeId: node ?? undefined };
}

const normaliseId = (id) => String(id).trim().replace(/-/g, ':');

/** Resolves `{ fileKey, nodeId }` (either may be a URL) to `{ file, frame, node, png }`; throws a user-facing message. */
function resolve(args, { needNode = true } = {}) {
  const fromKey = fromUrl(args.fileKey);
  const fromNode = fromUrl(args.nodeId);
  const fileKey = fromKey?.fileKey ?? fromNode?.fileKey ?? args.fileKey ?? (Object.keys(FILES).length === 1 ? Object.keys(FILES)[0] : undefined);
  const rawNode = fromNode ? fromNode.nodeId : fromKey?.nodeId ?? args.nodeId;
  const file = FILES[fileKey];
  if (!file) throw new Error(`File not found: "${fileKey ?? ''}". Check the fileKey: it is the segment after /design/ in the Figma URL.`);
  if (!rawNode) {
    if (needNode) throw new Error('A nodeId is required. Copy a link to a frame or layer in Figma, or pass the node-id from the URL (e.g. "1-2" or "1:2").');
    return { file, fileKey };
  }
  const nodeId = normaliseId(rawNode);
  for (const page of file.pages) {
    if (page.id === nodeId) return { file, fileKey, page };
    for (const frame of page.frames) {
      const data = bundle(frame.bundle);
      const node = find(data.tree, nodeId);
      if (node) return { file, fileKey, frame, data, node };
    }
  }
  throw new Error(`Node ${nodeId} not found in file ${fileKey}. Make sure the node id comes from a link to a layer in this file.`);
}

function find(node, id) {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return null;
}

// -------------------------------------------------------------------------------------------- metadata

const escapeXml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlTag = { FRAME: 'frame', TEXT: 'text', VECTOR: 'vector', INSTANCE: 'instance', RECTANGLE: 'rectangle' };

function metadataXml(node, parent = null, depth = 0) {
  const indent = '  '.repeat(depth);
  const x = parent ? node.x - parent.x : 0;
  const y = parent ? node.y - parent.y : 0;
  const attributes = `id="${node.id}" name="${escapeXml(node.name)}" x="${x}" y="${y}" width="${node.width}" height="${node.height}"`;
  const tag = xmlTag[node.type] ?? 'frame';
  if (!node.children?.length) return `${indent}<${tag} ${attributes} />`;
  return `${indent}<${tag} ${attributes}>\n${node.children.map((child) => metadataXml(child, node, depth + 1)).join('\n')}\n${indent}</${tag}>`;
}

// ------------------------------------------------------------------------------------------- variables

const RADIUS = { 4: 'radius/sm', 6: 'radius/md', 8: 'radius/lg', 12: 'radius/xl', 16: 'radius/2xl' };
const WEIGHT = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };

function* walk(node) {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

const textStyleName = (style) => `text/${style.fontSize}/${(WEIGHT[style.fontWeight] ?? 'Regular').toLowerCase().replace(' ', '-')}`;
const fontValue = (style) => `Font(family: "${style.fontFamily}", style: ${WEIGHT[style.fontWeight] ?? 'Regular'}, size: ${style.fontSize}, weight: ${style.fontWeight}, lineHeight: ${style.lineHeightPx}, letterSpacing: ${style.letterSpacing})`;

/** The variables and styles a node and its children use, named the way the design file names them. */
function variablesOf(root, colourTokens) {
  const variables = {};
  for (const node of walk(root)) {
    for (const paint of [...(node.fills ?? []), ...(node.strokes ?? []), ...(node.style?.fills ?? [])]) if (colourTokens[paint.color]) variables[colourTokens[paint.color]] = paint.color;
    for (const key of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'itemSpacing', 'counterAxisSpacing']) {
      const value = node[key];
      if (value && value % 4 === 0 && value <= 64) variables[`spacing/${value / 4}`] = String(value);
    }
    if (RADIUS[node.cornerRadius]) variables[RADIUS[node.cornerRadius]] = String(node.cornerRadius);
    if (node.cornerRadius >= 999) variables['radius/full'] = '9999';
    if (node.style) variables[textStyleName(node.style)] = fontValue(node.style);
  }
  return Object.fromEntries(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
}

// ---------------------------------------------------------------------------------------------- code

const px = (value) => `${Math.round(value * 100) / 100}px`;
const cssVar = (token) => `--${token.replace(/\//g, '-')}`;

function colourClass(prefix, paint, tokens) {
  const value = tokens[paint.color] ? `var(${cssVar(tokens[paint.color])},${paint.color})` : paint.color;
  const alpha = paint.opacity !== undefined && paint.opacity < 1 ? `/${Math.round(paint.opacity * 100)}` : '';
  return `${prefix}-[${prefix === 'text' ? 'color:' : ''}${value}]${alpha}`;
}

const assetUrl = (seed) => {
  const hex = crypto.createHash('sha256').update(seed).digest('hex');
  return `https://www.figma.com/api/mcp/asset/${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};
const identifier = (name, used) => {
  const base = `img${name.replace(/[^A-Za-z0-9]+(.)?/g, (_, next) => (next ? next.toUpperCase() : '')).replace(/^./, (first) => first.toUpperCase())}`;
  let candidate = base;
  for (let index = 1; used.has(candidate); index += 1) candidate = `${base}${index}`;
  used.add(candidate);
  return candidate;
};

const ALIGN = { MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'between', BASELINE: 'baseline' };

/** A frame's children are stacked when they do not overlap vertically: then code uses a column. */
function stacked(node) {
  const children = node.children ?? [];
  for (let index = 1; index < children.length; index += 1) if (children[index].y < children[index - 1].y + children[index - 1].height - 1) return false;
  return true;
}

function frameClasses(node, parent, tokens) {
  const classes = [];
  const layout = node.layoutMode ?? (node.children?.length > 1 && stacked(node) ? 'VERTICAL' : null);
  if (layout === 'HORIZONTAL' || layout === 'VERTICAL') {
    classes.push('flex', layout === 'HORIZONTAL' ? 'flex-row' : 'flex-col');
    if (node.layoutWrap === 'WRAP') classes.push('flex-wrap');
    if (node.counterAxisAlignItems && node.counterAxisAlignItems !== 'MIN') classes.push(`items-${ALIGN[node.counterAxisAlignItems]}`);
    if (node.primaryAxisAlignItems && node.primaryAxisAlignItems !== 'MIN') classes.push(`justify-${ALIGN[node.primaryAxisAlignItems]}`);
    const gap = node.itemSpacing ?? (node.layoutMode ? 0 : Math.max(0, Math.round((node.children[1].y - node.children[0].y - node.children[0].height))));
    if (gap) classes.push(`gap-[${px(gap)}]`);
  } else if (layout === 'GRID') {
    classes.push('grid', `grid-cols-[repeat(${node.gridColumnCount},minmax(0,1fr))]`);
    if (node.itemSpacing) classes.push(`gap-x-[${px(node.itemSpacing)}]`);
    if (node.counterAxisSpacing) classes.push(`gap-y-[${px(node.counterAxisSpacing)}]`);
  } else {
    classes.push('relative');
  }
  const padding = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((value) => value ?? 0);
  if (padding.every((value) => value === padding[0]) && padding[0]) classes.push(`p-[${px(padding[0])}]`);
  else {
    if (padding[0] === padding[2] && padding[0]) classes.push(`py-[${px(padding[0])}]`);
    else for (const [index, side] of ['t', 'b'].entries()) if (padding[index * 2]) classes.push(`p${side}-[${px(padding[index * 2])}]`);
    if (padding[1] === padding[3] && padding[1]) classes.push(`px-[${px(padding[1])}]`);
    else for (const [index, side] of ['r', 'l'].entries()) if (padding[index * 2 + 1]) classes.push(`p${side}-[${px(padding[index * 2 + 1])}]`);
  }
  const parentInner = parent ? parent.width - (parent.paddingLeft ?? 0) - (parent.paddingRight ?? 0) : null;
  if (parentInner !== null && Math.abs(node.width - parentInner) <= 1 && parent.layoutMode !== 'HORIZONTAL') classes.push('w-full');
  else classes.push(`w-[${px(node.width)}]`);
  if (!node.children?.length) classes.push(`h-[${px(node.height)}]`);
  classes.push('shrink-0');
  for (const fill of node.fills ?? []) classes.push(colourClass('bg', fill, tokens));
  if (node.strokes?.length) {
    const sides = node.strokeSides ? node.strokeSides.map((side) => `border-${side[0].toLowerCase()}`) : ['border'];
    classes.push(...sides.map((side) => (node.strokeWeight === 1 ? side : `${side}-[${px(node.strokeWeight)}]`)), colourClass('border', node.strokes[0], tokens), 'border-solid');
  }
  if (node.cornerRadius) classes.push(node.cornerRadius >= 999 ? 'rounded-full' : `rounded-[${px(node.cornerRadius)}]`);
  for (const effect of node.effects ?? []) classes.push(`shadow-[${effect.css.replace(/\s+/g, '_')}]`);
  return classes;
}

function textClasses(node, tokens) {
  const style = node.style;
  const classes = [
    `font-['${style.fontFamily}:${(WEIGHT[style.fontWeight] ?? 'Regular').replace(' ', '_')}',sans-serif]`,
    `font-${{ 100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black' }[style.fontWeight] ?? 'normal'}`,
    `text-[${px(style.fontSize)}]`,
    `leading-[${px(style.lineHeightPx)}]`,
    'not-italic',
    'shrink-0'
  ];
  if (style.letterSpacing) classes.push(`tracking-[${px(style.letterSpacing)}]`);
  if (style.textAlignHorizontal === 'RIGHT') classes.push('text-right');
  if (style.textAlignHorizontal === 'CENTER') classes.push('text-center');
  for (const fill of style.fills ?? []) classes.push(colourClass('text', fill, tokens));
  classes.push('whitespace-pre-wrap');
  return classes;
}

const escapeJsx = (text) => String(text).replace(/[{}<>]/g, (char) => `{'${char}'}`);

function jsx(node, parent, tokens, assets, depth) {
  const indent = '  '.repeat(depth);
  const attributes = `data-node-id="${node.id}" data-name="${escapeXml(node.name)}"`;
  if (node.type === 'TEXT') return `${indent}<p className="${textClasses(node, tokens).join(' ')}" ${attributes}>${escapeJsx(node.characters)}</p>`;
  if (node.type === 'VECTOR' || node.type === 'INSTANCE') {
    const name = identifier(node.name, assets.used);
    assets.list.push(`const ${name} = "${assetUrl(`${node.id}:${node.name}`)}";`);
    const labels = (node.children ?? []).map((child) => {
      const left = child.x - node.x;
      const top = child.y - node.y;
      return `${indent}  <p className="absolute left-[${px(left)}] top-[${px(top)}] ${textClasses(child, tokens).join(' ')}" data-node-id="${child.id}">${escapeJsx(child.characters)}</p>`;
    });
    return `${indent}<div className="relative shrink-0 w-[${px(node.width)}] h-[${px(node.height)}]" ${attributes}>\n${indent}  <img alt="" className="block max-w-none size-full" src={${name}} />${labels.length ? `\n${labels.join('\n')}` : ''}\n${indent}</div>`;
  }
  const children = (node.children ?? []).map((child) => jsx(child, node, tokens, assets, depth + 1));
  const classes = frameClasses(node, parent, tokens).join(' ');
  return children.length ? `${indent}<div className="${classes}" ${attributes}>\n${children.join('\n')}\n${indent}</div>` : `${indent}<div className="${classes}" ${attributes} />`;
}

function componentName(name) {
  const words = String(name).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const joined = words.map((word) => word[0].toUpperCase() + word.slice(1)).join('');
  return /^[A-Za-z]/.test(joined) ? joined : `Frame${joined}`;
}

function reactCode(node, tokens) {
  const assets = { list: [], used: new Set() };
  const body = jsx(node, null, tokens, assets, 2);
  return `${assets.list.join('\n')}${assets.list.length ? '\n\n' : ''}export default function ${componentName(node.name)}() {\n  return (\n${body}\n  );\n}\n`;
}

// The guidance the real server sends with generated code (see FIDELITY.md for its provenance).
const CODE_GUIDANCE = [
  'SUPER CRITICAL: The generated React+Tailwind code MUST be converted to match the target project\'s technology stack and styling system.',
  '1. Analyze the target codebase to identify: technology stack, styling approach, component patterns, and design tokens',
  '2. Convert React syntax to the target framework/library',
  '3. Transform all Tailwind classes to the target styling system while preserving exact visual design',
  '4. Follow the project\'s existing patterns and conventions',
  'DO NOT install any Tailwind as a dependency unless the user instructs you to do so.',
  '',
  'Node ids have been added to the code as data attributes, e.g. `data-node-id="1:2"`.',
  'Image assets are referenced through the constants at the top of the code. Do not add new icon packages: icons in the design may already exist in the project.',
  'Use get_screenshot on the same node for the visual reference before implementing.'
].join('\n');

// ------------------------------------------------------------------------------------------- tools

function callTool(name, args = {}) {
  const text = (value) => ({ type: 'text', text: value });
  if (name === 'get_metadata') {
    const target = resolve(args, { needNode: false });
    if (!target.node) {
      const pages = target.file.pages.filter((page) => !target.page || page === target.page);
      return { content: [text(pages.map((page) => `<canvas id="${page.id}" name="${escapeXml(page.name)}">\n${page.frames.map((frame) => {
        const root = bundle(frame.bundle).tree;
        return `  <frame id="${frame.nodeId}" name="${escapeXml(frame.name)}" x="0" y="0" width="${root.width}" height="${root.height}" />`;
      }).join('\n')}\n</canvas>`).join('\n'))] };
    }
    return { content: [text(metadataXml(target.node))] };
  }
  const target = resolve(args);
  if (!target.node) throw new Error('Pass the id of a frame or layer, not a page. Use get_metadata to list the frames of a page.');
  if (name === 'get_variable_defs') return { content: [text(JSON.stringify(variablesOf(target.node, target.data.colourTokens ?? {})))] };
  if (name === 'get_screenshot') {
    const screenshot = fs.readFileSync(path.join(HERE, target.frame.screenshot));
    const root = target.data.tree;
    const png = target.node === root ? screenshot : cropPng(screenshot, { x: target.node.x - root.x, y: target.node.y - root.y, width: target.node.width, height: target.node.height });
    return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] };
  }
  if (name === 'get_design_context') {
    const code = reactCode(target.node, target.data.colourTokens ?? {});
    if (code.length > MAX_CODE_CHARS) {
      return {
        content: [
          text(`The selection is too large to generate code for in one response (${target.node.children?.length ?? 0} direct children). Here is the sparse metadata of the node instead. Call get_design_context on the child node ids below (sections of the design), and get_screenshot for the visual reference.\n\n${metadataXml(target.node)}`)
        ]
      };
    }
    return { content: [text(code), text(CODE_GUIDANCE)] };
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---------------------------------------------------------------------------------------- transport

function reply(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(message) {
  const { id, method, params } = message;
  const respond = (result) => id !== undefined && reply({ jsonrpc: '2.0', id, result });
  const fail = (code, text) => id !== undefined && reply({ jsonrpc: '2.0', id, error: { code, message: text } });
  if (method === 'initialize') {
    const asked = params?.protocolVersion;
    return respond({
      protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'Figma MCP Server', version: '1.0.0' }
    });
  }
  if (method === 'ping') return respond({});
  if (method === 'tools/list') return respond({ tools: TOOLS });
  if (method === 'tools/call') {
    if (!TOOLS.some((tool) => tool.name === params?.name)) return fail(-32602, `Unknown tool: ${params?.name}`);
    try {
      return respond(callTool(params.name, params.arguments ?? {}));
    } catch (error) {
      return respond({ content: [{ type: 'text', text: String(error?.message ?? error) }], isError: true });
    }
  }
  if (method === 'resources/list') return respond({ resources: [] });
  if (method === 'prompts/list') return respond({ prompts: [] });
  if (method?.startsWith('notifications/')) return undefined;
  return fail(-32601, `Method not found: ${method}`);
}

const lines = readline.createInterface({ input: process.stdin });
lines.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return reply({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  for (const item of Array.isArray(message) ? message : [message]) handle(item);
});
