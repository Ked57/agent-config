import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function skillFiles(dir = path.join(root, 'skills')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return skillFiles(full);
    return entry.name === 'SKILL.md' ? [full] : [];
  });
}

// Package arguments of `npm i|install|add`, `pnpm|yarn|bun add` commands, stopping at
// shell separators or the closing backtick of inline code.
function installedPackages(markdown) {
  const names = [];
  const command = /\b(?:npm\s+(?:i|install|add)|pnpm\s+(?:add|i|install)|yarn\s+add|bun\s+(?:add|i|install))\b([^`\n&|;]*)/g;
  for (const match of markdown.matchAll(command)) {
    for (const arg of match[1].trim().split(/\s+/)) {
      if (arg && !arg.startsWith('-')) names.push(arg.replace(/(?<=.)@[^/]*$/, ''));
    }
  }
  return names;
}

test('installedPackages reads fenced and inline install commands', () => {
  assert.deepEqual(installedPackages('Install: `npm i -g agent-browser && agent-browser install`'), ['agent-browser']);
  assert.deepEqual(installedPackages('```sh\npnpm add -D @scope/pkg@1.2.3 other\n```'), ['@scope/pkg', 'other']);
});

test('every npm package a skill tells the reader to install was verified to exist', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(root, 'tests/verified-npm-packages.json'), 'utf8'));
  const unverified = skillFiles().flatMap((file) =>
    installedPackages(fs.readFileSync(file, 'utf8'))
      .filter((name) => !allowlist.packages.includes(name))
      .map((name) => `${path.relative(root, file)}: ${name}`)
  );
  assert.deepEqual(unverified, [], 'verify with `npm view <name>` and add to tests/verified-npm-packages.json');
});

test('every skill routing.md routes to is installed by this repository', async () => {
  const { externalPlugins } = await import('../bin/external-plugins.mjs');
  const installed = new Set([
    ...fs.readdirSync(path.join(root, 'skills')).filter((name) => fs.existsSync(path.join(root, 'skills', name, 'SKILL.md'))),
    ...externalPlugins.flatMap((entry) => entry.skills ?? [])
  ]);
  const routing = fs.readFileSync(path.join(root, 'policy/routing.md'), 'utf8');
  const skillSection = routing.slice(routing.indexOf('## 2. Skills'), routing.indexOf('## Exit'));
  const routed = [...skillSection.matchAll(/→ `([a-z0-9-]+)`/g)].map((match) => match[1]);
  assert.ok(routed.includes('emil-design-eng'));
  assert.deepEqual(routed.filter((name) => !installed.has(name)), []);
});

// Agents read the Vue policy whenever they route a Vue task but skip bare skill names on
// functional UI work, so the policy carries the explicit load step for emil-design-eng.
test('the Vue policy tells agents to read emil-design-eng before template or style edits', () => {
  const vue = fs.readFileSync(path.join(root, 'policy/vue-primevue.md'), 'utf8');
  assert.match(vue, /Before writing or changing template markup or styles, read `~\/\.agents\/skills\/emil-design-eng\/SKILL\.md`/);
});
