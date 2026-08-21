#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) ?? 'help';
const projectFlag = args.indexOf('--project');
if (projectFlag !== -1 && (!args[projectFlag + 1] || args[projectFlag + 1].startsWith('-'))) {
  console.error('Missing value for --project.');
  process.exit(1);
}
const projectRoot = path.resolve(projectFlag === -1 ? process.cwd() : args[projectFlag + 1]);

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relative = (file) => path.relative(projectRoot, file) || '.';
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const copy = (from, to) => write(to, read(from));

const marker = (name, contents) => `<!-- agent-config:begin ${name} -->\n${contents.trim()}\n<!-- agent-config:end ${name} -->\n`;
const replaceManagedBlock = (existing, name, contents) => {
  const start = `<!-- agent-config:begin ${name} -->`;
  const end = `<!-- agent-config:end ${name} -->`;
  const startIndex = existing.indexOf(start);
  const endIndex = existing.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;
  return `${existing.slice(0, startIndex)}${marker(name, contents)}${existing.slice(endIndex + end.length).replace(/^\n?/, '')}`;
};

const sharedPolicy = read(path.join(sourceRoot, 'policy/shared-policy.md'));
const managedSourceFiles = [
  'policy/shared-policy.md',
  'rules/typescript.mdc',
  'rules/domain-module.mdc',
  'rules/vue-primevue.mdc',
  'runtime/agent-check.mjs',
  'skills/fullstack-typescript-quality/SKILL.md'
];
const revision = sha256(managedSourceFiles.map((file) => read(path.join(sourceRoot, file))).join('\n--- agent-config source boundary ---\n')).slice(0, 12);
const packagePath = path.join(projectRoot, 'package.json');
const packageJson = exists(packagePath) ? JSON.parse(read(packagePath)) : null;
const dependencies = {
  ...(packageJson?.dependencies ?? {}),
  ...(packageJson?.devDependencies ?? {})
};
const isVue = Boolean(dependencies.vue || exists(path.join(projectRoot, 'vite.config.ts')) && exists(path.join(projectRoot, 'src/App.vue')));
const isTypeScript = Boolean(dependencies.typescript || exists(path.join(projectRoot, 'tsconfig.json')));
const runtime = exists(path.join(projectRoot, 'bun.lockb')) || exists(path.join(projectRoot, 'bun.lock')) ? 'bun' : 'npm';
const runScript = (name) => `${runtime} run ${name}`;
const scripts = packageJson?.scripts ?? {};
const firstScript = (...names) => names.find((name) => scripts[name]);
const commands = {};
const candidates = {
  format: ['format:check', 'format'],
  lint: ['lint'],
  typecheck: ['typecheck', 'check:types'],
  unit: ['test:unit', 'test'],
  component: ['test:component', 'cypress:component'],
  e2e: ['test:e2e', 'cypress:e2e'],
  build: ['build'],
  fast: ['verify:fast'],
  full: ['verify:full'],
  mutation: ['test:mutation:domain', 'test:mutation']
};
for (const [key, names] of Object.entries(candidates)) {
  const name = firstScript(...names);
  if (name) commands[key] = runScript(name);
}

const configured = (...names) => names.filter((name) => commands[name]);
const config = {
  version: 1,
  runtime,
  commands,
  routing: [
    ...(isTypeScript ? [{
      match: ['**/*.ts', '**/*.tsx'],
      except: ['**/*.cy.ts', '**/*.spec.ts', '**/*.test.ts'],
      required: configured('unit', 'fast'),
      recommended: configured('mutation')
    }] : []),
    ...(isVue ? [{
      match: ['**/*.vue'],
      required: configured('component', 'fast')
    }] : []),
    {
      match: ['src/domain/**', 'packages/domain/**', 'src/lib/permissions/**'],
      required: configured('unit', 'fast'),
      recommended: configured('mutation')
    }
  ]
};

const target = (...segments) => path.join(projectRoot, ...segments);
const policyFile = target('AGENTS.md');
const claudeFile = target('CLAUDE.md');
const cursorRuleDirectory = target('.cursor', 'rules');
const lockFile = target('.agents', 'agent-config.lock.json');
const configFile = target('.agents', 'agent-config.json');
const checkScript = target('.agents', 'scripts', 'agent-check.mjs');
const skillDirectory = target('.agents', 'skills', 'fullstack-typescript-quality');
const managedFiles = [
  [target('.cursor', 'rules', '10-agent-config-typescript.mdc'), path.join(sourceRoot, 'rules/typescript.mdc'), isTypeScript],
  [target('.cursor', 'rules', '20-agent-config-domain-module.mdc'), path.join(sourceRoot, 'rules/domain-module.mdc'), isTypeScript],
  [target('.cursor', 'rules', '30-agent-config-vue-primevue.mdc'), path.join(sourceRoot, 'rules/vue-primevue.mdc'), isVue],
  [checkScript, path.join(sourceRoot, 'runtime/agent-check.mjs'), true],
  [path.join(skillDirectory, 'SKILL.md'), path.join(sourceRoot, 'skills/fullstack-typescript-quality/SKILL.md'), true]
];

const claudeBridgePolicy = 'Read and follow `AGENTS.md`.\n\nProject-specific quality routing is in `.agents/agent-config.json`. Before reporting implementation work complete, run the required verification for the changed files.';
const cursorBridgePolicy = 'Read and follow the repository `AGENTS.md`.\n\nUse `.agents/agent-config.json` to identify the required verification for changed files. Repository-specific rules take precedence over global preferences.';
const cursorBridgeFile = target('.cursor', 'rules', '00-agent-config.mdc');

const writeBridge = (file, name, contents, header = '') => {
  if (!exists(file)) {
    write(file, `${header}${marker(name, contents)}`);
    console.log(`Created ${relative(file)}`);
    return true;
  }
  const replacement = replaceManagedBlock(read(file), name, contents);
  if (replacement === null) {
    console.warn(`Preserved unmanaged ${relative(file)}; add the ${name} managed block manually.`);
    return false;
  }
  if (read(file) !== replacement) {
    write(file, replacement);
    console.log(`Updated ${relative(file)}`);
  }
  return true;
};

const readLock = () => {
  if (!exists(lockFile)) return null;
  try {
    return JSON.parse(read(lockFile));
  } catch {
    return null;
  }
};

const install = () => {
  if (!exists(projectRoot) || !fs.statSync(projectRoot).isDirectory()) throw new Error(`Project directory not found: ${projectRoot}`);
  let safe = true;
  const previousLock = readLock();
  const trustedPreviousLock = previousLock?.source === 'Ked57/agent-config'
    && previousLock.version === 1
    && Array.isArray(previousLock.managedFiles);
  const ownedManagedFiles = new Set(trustedPreviousLock ? previousLock.managedFiles : []);
  const nextManagedFiles = [];

  const policyBlock = marker('shared-policy', sharedPolicy);
  if (!exists(policyFile)) {
    write(policyFile, `# Agent instructions\n\n${policyBlock}\n## Project architecture\n\nAdd repository-specific architecture, commands, and conventions here.\n`);
    console.log(`Created ${relative(policyFile)}`);
  } else {
    const replacement = replaceManagedBlock(read(policyFile), 'shared-policy', sharedPolicy);
    if (replacement === null) {
      console.warn(`Preserved unmanaged ${relative(policyFile)}; add the shared-policy managed block manually.`);
      safe = false;
    } else if (read(policyFile) !== replacement) {
      write(policyFile, replacement);
      console.log(`Updated ${relative(policyFile)}`);
    }
  }

  safe = writeBridge(claudeFile, 'claude-bridge', claudeBridgePolicy, '# Claude Code project entry point\n\n') && safe;
  safe = writeBridge(cursorBridgeFile, 'cursor-bridge', cursorBridgePolicy, '---\ndescription: Load shared project agent guidance.\nalwaysApply: true\n---\n\n') && safe;

  for (const [destination, source, enabled] of managedFiles) {
    const name = relative(destination);
    if (!enabled) {
      if (ownedManagedFiles.has(name) && exists(destination)) {
        fs.rmSync(destination);
        console.log(`Removed no-longer-applicable ${name}`);
      }
      continue;
    }
    if (exists(destination) && !ownedManagedFiles.has(name)) {
      console.warn(`Preserved unmanaged ${name}; move it or merge it manually before agent-config can manage this path.`);
      safe = false;
      continue;
    }
    const action = exists(destination) ? 'Synced' : 'Created';
    copy(source, destination);
    nextManagedFiles.push(name);
    console.log(`${action} ${name}`);
  }

  if (!exists(configFile)) {
    write(configFile, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Created ${relative(configFile)}`);
  } else {
    console.log(`Preserved project-owned ${relative(configFile)}`);
  }

  if (exists(lockFile) && !trustedPreviousLock) {
    console.warn(`Preserved unmanaged ${relative(lockFile)}; move it or merge it manually before agent-config can manage this path.`);
    safe = false;
  } else {
    const lock = {
      version: 1,
      source: 'Ked57/agent-config',
      revision,
      installedAt: new Date().toISOString(),
      detected: { runtime, typescript: isTypeScript, vue: isVue },
      managedFiles: nextManagedFiles
    };
    write(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Wrote ${relative(lockFile)}`);
  }

  if (!safe) process.exitCode = 2;
};

const status = () => {
  console.log(`Project: ${projectRoot}`);
  console.log(`Detected: runtime=${runtime}, typescript=${isTypeScript}, vue=${isVue}`);
  console.log(`Source policy revision: ${revision}`);
  for (const file of [policyFile, claudeFile, cursorBridgeFile, configFile, checkScript]) {
    console.log(`${exists(file) ? 'present' : 'missing'} ${relative(file)}`);
  }
};

const check = () => {
  const expected = [policyFile, claudeFile, cursorBridgeFile, configFile, checkScript, path.join(skillDirectory, 'SKILL.md'), lockFile];
  if (isTypeScript) expected.push(target('.cursor', 'rules', '10-agent-config-typescript.mdc'), target('.cursor', 'rules', '20-agent-config-domain-module.mdc'));
  if (isVue) expected.push(target('.cursor', 'rules', '30-agent-config-vue-primevue.mdc'));
  const missing = expected.filter((file) => !exists(file));
  if (missing.length) {
    for (const file of missing) console.error(`Missing ${relative(file)}`);
    process.exitCode = 1;
    return;
  }

  const stale = [];
  if (!read(policyFile).includes(marker('shared-policy', sharedPolicy).trim())) stale.push(relative(policyFile));
  if (!read(claudeFile).includes(marker('claude-bridge', claudeBridgePolicy).trim())) stale.push(relative(claudeFile));
  if (!read(cursorBridgeFile).includes(marker('cursor-bridge', cursorBridgePolicy).trim())) stale.push(relative(cursorBridgeFile));
  for (const [destination, source, enabled] of managedFiles) {
    if (enabled && read(destination) !== read(source)) stale.push(relative(destination));
  }
  if (stale.length) {
    for (const file of stale) console.error(`Outdated managed content: ${file}`);
    process.exitCode = 1;
    return;
  }

  const lock = JSON.parse(read(lockFile));
  if (lock.revision !== revision) {
    console.error(`Outdated agent-config policy: installed ${lock.revision}, source ${revision}`);
    process.exitCode = 1;
    return;
  }
  console.log(`agent-config check passed for ${projectRoot}`);
};

if (command === 'init' || command === 'sync') install();
else if (command === 'check') check();
else if (command === 'status') status();
else {
  console.log(`Usage: node bin/agent-config.mjs <init|sync|check|status> [--project <path>]\n\ninit/sync installs managed configuration without overwriting project-owned instructions or routing.`);
}
