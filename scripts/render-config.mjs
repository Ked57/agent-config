#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const check = process.argv.includes('--check');
const source = JSON.parse(fs.readFileSync(path.join(root, 'mcp/servers.json'), 'utf8'));
const servers = source.servers;
const resolveCommand = (server) => path.resolve(root, server.command);

const cursor = { mcpServers: {} };
const claude = { mcpServers: {} };
let codex = '# Generated from mcp/servers.json. Merge into ~/.codex/config.toml.\n';

for (const [name, server] of Object.entries(servers)) {
  const target = server.transport === 'stdio'
    ? { command: resolveCommand(server), args: server.args ?? [] }
    : { url: server.url };
  cursor.mcpServers[name] = target;
  claude.mcpServers[name] = target;

  codex += `\n[mcp_servers.${JSON.stringify(name)}]\n`;
  if (server.transport === 'stdio') {
    codex += `command = ${JSON.stringify(resolveCommand(server))}\n`;
    if ((server.args ?? []).length) codex += `args = ${JSON.stringify(server.args)}\n`;
  } else {
    codex += `url = ${JSON.stringify(server.url)}\n`;
  }
}

const outputs = new Map([
  ['cursor-mcp.json', `${JSON.stringify(cursor, null, 2)}\n`],
  ['claude-mcp.json', `${JSON.stringify(claude, null, 2)}\n`],
  ['codex-mcp.toml', codex]
]);
const outDir = path.join(root, 'out');
if (!check) fs.mkdirSync(outDir, { recursive: true });

let valid = true;
for (const [file, contents] of outputs) {
  const target = path.join(outDir, file);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) {
      console.error(`Out of date: ${path.relative(root, target)}`);
      valid = false;
    }
  } else {
    fs.writeFileSync(target, contents);
    console.log(`Wrote ${path.relative(root, target)}`);
  }
}
if (!valid) process.exitCode = 1;
