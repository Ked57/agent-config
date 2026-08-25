#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const usage = 'Usage: node bin/agent-config.mjs <init|sync|check|status> [--project <path> | --user]';
const positional = [];
let projectArgument;
let userScope = false;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--project') {
    if (projectArgument !== undefined) {
      console.error(`--project may only be provided once.\n${usage}`);
      process.exit(1);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('-')) {
      console.error(`Missing value for --project.\n${usage}`);
      process.exit(1);
    }
    projectArgument = value;
    index += 1;
  } else if (arg === '--user') {
    if (userScope) {
      console.error(`--user may only be provided once.\n${usage}`);
      process.exit(1);
    }
    userScope = true;
  } else if (arg === '--help' || arg === '-h') {
    positional.push('help');
  } else if (arg.startsWith('-')) {
    console.error(`Unknown option: ${arg}\n${usage}`);
    process.exit(1);
  } else {
    positional.push(arg);
  }
}
if (userScope && projectArgument !== undefined) {
  console.error(`--user and --project cannot be used together.\n${usage}`);
  process.exit(1);
}
if (positional.length > 1) {
  console.error(`Unexpected arguments: ${positional.slice(1).join(' ')}\n${usage}`);
  process.exit(1);
}
const command = positional[0] ?? 'help';
const projectRoot = path.resolve(projectArgument ?? process.cwd());

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const createFileOperations = (root, label) => {
  const relativeToRoot = (file) => path.relative(root, file) || '.';
  const assertSafe = (file) => {
    const rootRelative = path.relative(root, file);
    if (path.isAbsolute(rootRelative) || rootRelative === '..' || rootRelative.startsWith(`..${path.sep}`)) {
      throw new Error(`Refusing to modify a path outside the ${label}: ${file}`);
    }
    let current = root;
    for (const segment of rootRelative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      try {
        if (fs.lstatSync(current).isSymbolicLink()) {
          throw new Error(`Refusing to modify symlinked ${label} path: ${relativeToRoot(current)}`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  };
  const writeFile = (file, content) => {
    assertSafe(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    assertSafe(file);
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.agent-config-${process.pid}-${crypto.randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, content, { flag: 'wx' });
      fs.renameSync(temporary, file);
    } finally {
      if (exists(temporary)) fs.rmSync(temporary);
    }
  };
  return {
    assertSafe,
    copy: (from, to) => writeFile(to, read(from)),
    relative: relativeToRoot,
    remove: (file) => {
      assertSafe(file);
      fs.rmSync(file);
    },
    write: writeFile
  };
};
const projectFiles = createFileOperations(projectRoot, 'project');
const { assertSafe: assertSafeTarget, copy, relative, remove, write } = projectFiles;
const findExactLine = (value, line) => {
  let index = value.indexOf(line);
  while (index !== -1) {
    const isLineStart = index === 0 || value[index - 1] === '\n' || value[index - 1] === '\r';
    const lineEnd = index + line.length;
    const isLineEnd = lineEnd === value.length
      || value[lineEnd] === '\n'
      || (value[lineEnd] === '\r' && (lineEnd + 1 === value.length || value[lineEnd + 1] === '\n'));
    if (isLineStart && isLineEnd) return index;
    index = value.indexOf(line, index + 1);
  }
  return -1;
};

const marker = (name, contents) => `<!-- agent-config:begin ${name} -->\n${contents.trim()}\n<!-- agent-config:end ${name} -->\n`;
const replaceManagedBlock = (existing, name, contents) => {
  const start = `<!-- agent-config:begin ${name} -->`;
  const end = `<!-- agent-config:end ${name} -->`;
  const startIndex = findExactLine(existing, start);
  const endIndex = findExactLine(existing, end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;
  return `${existing.slice(0, startIndex)}${marker(name, contents)}${existing.slice(endIndex + end.length).replace(/^\r?\n/, '')}`;
};
const lineMarker = (name, contents) => `# agent-config:begin ${name}\n${contents.trim()}\n# agent-config:end ${name}\n`;
const replaceLineManagedBlock = (existing, name, contents) => {
  const start = `# agent-config:begin ${name}`;
  const end = `# agent-config:end ${name}`;
  const startIndex = findExactLine(existing, start);
  const endIndex = findExactLine(existing, end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;
  return `${existing.slice(0, startIndex)}${lineMarker(name, contents)}${existing.slice(endIndex + end.length).replace(/^\r?\n/, '')}`;
};

const sharedPolicy = read(path.join(sourceRoot, 'policy/shared-policy.md'));
const managedSourceFiles = [
  'policy/shared-policy.md',
  'policy/typescript.md',
  'policy/react.md',
  'policy/domain-module.md',
  'policy/vue-primevue.md',
  'skills/fullstack-typescript-quality/SKILL.md'
];
const revision = sha256(managedSourceFiles.map((file) => read(path.join(sourceRoot, file))).join('\n--- agent-config source boundary ---\n')).slice(0, 12);
const userHome = os.homedir();
const configuredCodexHome = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(userHome, '.codex');
const userFiles = createFileOperations(userHome, 'user home');
const codexHomeRelative = path.relative(userHome, configuredCodexHome);
const codexHomeIsInsideUserHome = !path.isAbsolute(codexHomeRelative)
  && codexHomeRelative !== '..'
  && !codexHomeRelative.startsWith(`..${path.sep}`);
const codexFiles = codexHomeIsInsideUserHome
  ? userFiles
  : createFileOperations(configuredCodexHome, 'Codex home');
const userPolicy = [
  sharedPolicy,
  read(path.join(sourceRoot, 'policy/typescript.md')),
  read(path.join(sourceRoot, 'policy/react.md')),
  read(path.join(sourceRoot, 'policy/vue-primevue.md')),
  read(path.join(sourceRoot, 'policy/domain-module.md'))
].join('\n\n');
const packagePath = path.join(projectRoot, 'package.json');
const packageJson = !userScope && exists(packagePath) ? JSON.parse(read(packagePath)) : null;
const dependencies = {
  ...(packageJson?.dependencies ?? {}),
  ...(packageJson?.devDependencies ?? {})
};
const sourceRoots = ['src', 'app', 'apps', 'pages', 'components', 'packages']
  .map((directory) => path.join(projectRoot, directory))
  .filter((directory) => exists(directory) && fs.statSync(directory).isDirectory());
const ignoredSourceDirectories = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt']);
const sourceFiles = [];
const collectSourceFiles = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredSourceDirectories.has(entry.name)) collectSourceFiles(path.join(directory, entry.name));
    } else if (entry.isFile()) {
      sourceFiles.push(path.join(directory, entry.name));
    }
  }
};
for (const directory of sourceRoots) collectSourceFiles(directory);
const hasExtension = (...extensions) => sourceFiles.some((file) => extensions.includes(path.extname(file)));
const sourceContains = (pattern) => sourceFiles.some((file) => {
  if (!['.js', '.jsx', '.mjs', '.ts', '.tsx', '.mts', '.vue'].includes(path.extname(file))) return false;
  return pattern.test(read(file));
});
const hasTypeScriptSource = hasExtension('.ts', '.tsx', '.mts') || sourceFiles.some((file) => path.extname(file) === '.vue' && /<script\b[^>]*\blang\s*=\s*["']ts["']/.test(read(file)));
const hasVueSource = hasExtension('.vue') || sourceContains(/from\s*['"]vue(?:\/|['"])/);
const hasReactSource = Boolean(dependencies.react || dependencies['react-dom'] || dependencies.next)
  && (hasExtension('.tsx', '.jsx') || sourceContains(/from\s*['"]react(?:\/|['"])/) || sourceContains(/require\(\s*['"]react(?:\/|['"])/));
const domainModuleParts = new Map();
for (const file of sourceFiles) {
  const match = file.match(/^(.*\/domain\/.*)\.(model|interface|service|mock)\.ts$/);
  if (match) domainModuleParts.set(match[1], (domainModuleParts.get(match[1]) ?? new Set()).add(match[2]));
}
const hasDomainConvention = [...domainModuleParts.values()].some((parts) => parts.size === 4);
const isVue = hasVueSource;
const isReact = hasReactSource;
const isTypeScript = hasTypeScriptSource;
const declaredRuntime = typeof packageJson?.packageManager === 'string'
  ? /^(npm|pnpm|yarn|bun)@/.exec(packageJson.packageManager)?.[1]
  : undefined;
const runtime = declaredRuntime
  ?? (exists(path.join(projectRoot, 'bun.lockb')) || exists(path.join(projectRoot, 'bun.lock')) ? 'bun'
    : exists(path.join(projectRoot, 'pnpm-lock.yaml')) ? 'pnpm'
      : exists(path.join(projectRoot, 'yarn.lock')) ? 'yarn'
        : 'npm');
const runScript = (name) => `${runtime} run ${name}`;
const scripts = packageJson?.scripts ?? {};
const firstScript = (...names) => names.find((name) => scripts[name]);
const commands = {};
const candidates = {
  format: ['format:check'],
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
const requiredChecks = (...specific) => [...new Set(configured(
  ...specific,
  ...(commands.fast ? ['fast'] : ['format', 'lint', 'typecheck', 'unit'])
))];
const config = {
  version: 1,
  runtime,
  commands,
  routing: [
    ...(isTypeScript ? [{
      match: ['**/*.ts', '**/*.tsx'],
      except: ['**/*.cy.ts', '**/*.spec.ts', '**/*.test.ts'],
      required: requiredChecks('unit'),
      recommended: configured('mutation')
    }] : []),
    ...(isReact ? [{
      match: ['**/*.tsx', '**/*.jsx'],
      required: requiredChecks('component')
    }] : []),
    ...(isVue ? [{
      match: ['**/*.vue'],
      required: requiredChecks('component')
    }] : []),
    {
      match: ['src/domain/**', 'packages/domain/**', 'src/lib/permissions/**'],
      required: requiredChecks('unit'),
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
const prettierIgnoreFile = target('.prettierignore');
const prettierIgnoreContents = '.agents/\n.cursor/rules/\nAGENTS.md\nCLAUDE.md';
const policyDirectory = target('.agents', 'policy');
const skillDirectory = target('.agents', 'skills', 'fullstack-typescript-quality');
const legacyGeneratedFileHashes = new Map([
  ['.cursor/rules/10-agent-config-typescript.mdc', '9a85ebe11e8c80867e17dab4fe8275f4881b2f2a2e722367c9bd0ee86543815d'],
  ['.cursor/rules/20-agent-config-domain-module.mdc', '61a6642ed1ba8bcb688ecdc2be987c42f90f277ff72dfb5985ed91b4876c51e7'],
  ['.cursor/rules/30-agent-config-vue-primevue.mdc', '124883ad626885aa3d0244eee7cbad3d854cf9e4c7777834ddb1ed395baf92c2'],
  ['.agents/scripts/agent-check.mjs', '48536eb05c360225af97230a10edb66dfa352e01c316d19e06b761d935b74fa0']
]);
const legacyGeneratedFiles = [...legacyGeneratedFileHashes.keys()].map((file) => target(...file.split('/')));
const managedFiles = [
  [path.join(policyDirectory, 'typescript.md'), path.join(sourceRoot, 'policy/typescript.md'), isTypeScript],
  [path.join(policyDirectory, 'react.md'), path.join(sourceRoot, 'policy/react.md'), isReact],
  [path.join(policyDirectory, 'domain-module.md'), path.join(sourceRoot, 'policy/domain-module.md'), hasDomainConvention],
  [path.join(policyDirectory, 'vue-primevue.md'), path.join(sourceRoot, 'policy/vue-primevue.md'), isVue],
  [path.join(skillDirectory, 'SKILL.md'), path.join(sourceRoot, 'skills/fullstack-typescript-quality/SKILL.md'), true]
];

const claudeBridgePolicy = 'Read and follow `AGENTS.md`.\n\nProject-specific quality routing is in `.agents/agent-config.json`. Before reporting implementation work complete, run the required verification for the changed files.';
const cursorBridgePolicy = 'Read and follow the repository `AGENTS.md`.\n\nUse `.agents/agent-config.json` to identify the required verification for changed files. Repository-specific rules take precedence over global preferences.';
const cursorBridgeFile = target('.cursor', 'rules', '00-agent-config.mdc');

const userPolicyFile = path.join(configuredCodexHome, 'AGENTS.md');
const claudeUserFile = path.join(userHome, '.claude', 'CLAUDE.md');
const cursorPluginDirectory = path.join(userHome, '.cursor', 'plugins', 'local', 'agent-config');
const cursorPluginManifest = path.join(cursorPluginDirectory, '.cursor-plugin', 'plugin.json');
const cursorUserRule = path.join(cursorPluginDirectory, 'rules', '00-agent-config.mdc');
const portableSkillSource = path.join(sourceRoot, 'skills', 'fullstack-typescript-quality', 'SKILL.md');
const userSkillFiles = [
  path.join(userHome, '.agents', 'skills', 'fullstack-typescript-quality', 'SKILL.md'),
  path.join(userHome, '.claude', 'skills', 'fullstack-typescript-quality', 'SKILL.md')
];
const userLockFile = path.join(userHome, '.agent-config', 'agent-config.lock.json');
const userPolicyIntro = 'This managed block is the portable personal baseline shared by Codex, Claude Code, and Cursor. Repository-specific instructions take precedence when they conflict.';
const claudeUserBridge = `@${userPolicyFile}\n\nRepository-specific instructions take precedence over this personal baseline.`;
const cursorUserRuleContents = `---
description: Load the personal cross-harness agent policy.
alwaysApply: true
---

Before doing any work, read and follow \`${userPolicyFile}\`.

Repository-specific instructions take precedence when they conflict. If the file cannot be read, report that before continuing.`;
const cursorPluginManifestContents = `${JSON.stringify({
  name: 'agent-config',
  version: '1.0.0',
  description: 'Personal cross-harness agent policy bridge.'
}, null, 2)}\n`;
const userStandaloneFiles = [
  { key: 'cursor:plugin-manifest', destination: cursorPluginManifest, contents: cursorPluginManifestContents },
  { key: 'cursor:user-rule', destination: cursorUserRule, contents: cursorUserRuleContents },
  ...userSkillFiles.map((destination, index) => ({
    key: index === 0 ? 'portable-skill' : 'claude:portable-skill',
    destination,
    contents: read(portableSkillSource)
  }))
];

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

const displayUserFile = (file) => {
  const homeRelative = path.relative(userHome, file);
  return !path.isAbsolute(homeRelative) && homeRelative !== '..' && !homeRelative.startsWith(`..${path.sep}`)
    ? path.join('~', homeRelative)
    : file;
};
const writeUserBlock = (file, operations, name, contents, header = '') => {
  if (!exists(file)) {
    operations.write(file, `${header}${marker(name, contents)}`);
    console.log(`Created ${displayUserFile(file)}`);
    return true;
  }
  const existing = read(file);
  const replacement = replaceManagedBlock(existing, name, contents);
  if (replacement !== null) {
    if (existing !== replacement) {
      operations.write(file, replacement);
      console.log(`Updated ${displayUserFile(file)}`);
    }
    return true;
  }
  const start = `<!-- agent-config:begin ${name} -->`;
  const end = `<!-- agent-config:end ${name} -->`;
  if (existing.includes(start) || existing.includes(end)) {
    console.warn(`Preserved unmanaged ${displayUserFile(file)}; repair the ${name} managed block manually.`);
    return false;
  }
  const next = `${existing.trimEnd()}\n\n${marker(name, contents)}`;
  operations.write(file, next);
  console.log(`Added managed policy to ${displayUserFile(file)}`);
  return true;
};

const writePrettierIgnore = () => {
  if (!exists(prettierIgnoreFile)) {
    write(prettierIgnoreFile, lineMarker('prettier-ignore', prettierIgnoreContents));
    console.log(`Created ${relative(prettierIgnoreFile)}`);
    return true;
  }
  const replacement = replaceLineManagedBlock(read(prettierIgnoreFile), 'prettier-ignore', prettierIgnoreContents);
  if (replacement === null) {
    console.warn(`Preserved unmanaged ${relative(prettierIgnoreFile)}; add the prettier-ignore managed block manually.`);
    return false;
  }
  if (read(prettierIgnoreFile) !== replacement) {
    write(prettierIgnoreFile, replacement);
    console.log(`Updated ${relative(prettierIgnoreFile)}`);
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
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isTrustedLock = (lock) => lock?.source === 'Ked57/agent-config'
  && lock.version === 1
  && typeof lock.revision === 'string'
  && /^[a-f0-9]{12}$/.test(lock.revision)
  && typeof lock.installedAt === 'string'
  && !Number.isNaN(Date.parse(lock.installedAt))
  && typeof lock.detected?.runtime === 'string'
  && typeof lock.detected?.typescript === 'boolean'
  && typeof lock.detected?.vue === 'boolean'
  && (lock.detected.react === undefined || typeof lock.detected.react === 'boolean')
  && Array.isArray(lock.managedFiles)
  && lock.managedFiles.every((file) => typeof file === 'string')
  && new Set(lock.managedFiles).size === lock.managedFiles.length;
const isTrustedUserLock = (lock) => lock?.source === 'Ked57/agent-config'
  && lock.scope === 'user'
  && lock.version === 1
  && typeof lock.revision === 'string'
  && /^[a-f0-9]{12}$/.test(lock.revision)
  && typeof lock.installedAt === 'string'
  && !Number.isNaN(Date.parse(lock.installedAt))
  && Array.isArray(lock.managedFiles)
  && lock.managedFiles.every((file) => typeof file === 'string')
  && new Set(lock.managedFiles).size === lock.managedFiles.length;
const validateProjectConfig = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['root must be a JSON object'];
  if (value.version !== 1) errors.push('version must be 1');
  if (value.runtime !== undefined && (typeof value.runtime !== 'string' || !value.runtime.trim())) {
    errors.push('runtime must be a non-empty string when provided');
  }
  if (!isRecord(value.commands)) {
    errors.push('commands must be an object');
  } else {
    for (const [name, commandValue] of Object.entries(value.commands)) {
      if (!name || typeof commandValue !== 'string' || !commandValue.trim()) {
        errors.push(`commands.${name || '<empty>'} must be a non-empty string`);
      }
    }
  }
  if (!Array.isArray(value.routing)) {
    errors.push('routing must be an array');
    return errors;
  }
  const commandNames = new Set(isRecord(value.commands) ? Object.keys(value.commands) : []);
  for (const [index, route] of value.routing.entries()) {
    if (!isRecord(route)) {
      errors.push(`routing[${index}] must be an object`);
      continue;
    }
    for (const field of ['match', 'required']) {
      if (!Array.isArray(route[field]) || (field === 'match' && route[field].length === 0)
        || route[field].some((item) => typeof item !== 'string' || !item)) {
        errors.push(`routing[${index}].${field} must be ${field === 'match' ? 'a non-empty' : 'an'} array of non-empty strings`);
      }
    }
    for (const field of ['except', 'recommended']) {
      if (route[field] !== undefined && (!Array.isArray(route[field])
        || route[field].some((item) => typeof item !== 'string' || !item))) {
        errors.push(`routing[${index}].${field} must be an array of non-empty strings when provided`);
      }
    }
    for (const field of ['required', 'recommended']) {
      if (!Array.isArray(route[field])) continue;
      for (const name of route[field]) {
        if (typeof name === 'string' && !commandNames.has(name)) {
          errors.push(`routing[${index}].${field} references unknown command: ${name}`);
        }
      }
    }
  }
  return errors;
};

const install = () => {
  if (!exists(projectRoot) || !fs.statSync(projectRoot).isDirectory()) throw new Error(`Project directory not found: ${projectRoot}`);
  let safe = true;
  const previousLock = readLock();
  const trustedPreviousLock = isTrustedLock(previousLock);
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
  safe = writePrettierIgnore() && safe;

  for (const legacyFile of legacyGeneratedFiles) {
    const name = relative(legacyFile);
    const expectedHash = legacyGeneratedFileHashes.get(name);
    if (ownedManagedFiles.has(name) && exists(legacyFile)) {
      if (sha256(read(legacyFile)) === expectedHash) {
        remove(legacyFile);
        console.log(`Removed legacy managed ${name}`);
      } else {
        console.warn(`Preserved changed legacy ${name}; it no longer matches the agent-config-generated content.`);
      }
    }
  }

  for (const [destination, source, enabled] of managedFiles) {
    const name = relative(destination);
    if (!enabled) {
      if (ownedManagedFiles.has(name) && exists(destination)) {
        if (sha256(read(destination)) === sha256(read(source))) {
          remove(destination);
          console.log(`Removed no-longer-applicable ${name}`);
        } else {
          console.warn(`Preserved changed ${name}; it no longer applies but does not match the agent-config-generated content.`);
        }
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
      detected: { runtime, typescript: isTypeScript, react: isReact, vue: isVue },
      managedFiles: nextManagedFiles
    };
    write(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Wrote ${relative(lockFile)}`);
  }

  if (!safe) process.exitCode = 2;
};

const status = () => {
  console.log(`Project: ${projectRoot}`);
  console.log(`Detected: runtime=${runtime}, typescript=${isTypeScript}, react=${isReact}, vue=${isVue}, domainConvention=${hasDomainConvention}`);
  console.log(`Source policy revision: ${revision}`);
  const statusFiles = [policyFile, claudeFile, cursorBridgeFile, prettierIgnoreFile, configFile, lockFile, ...managedFiles.filter(([, , enabled]) => enabled).map(([destination]) => destination)];
  for (const file of statusFiles) {
    console.log(`${exists(file) ? 'present' : 'missing'} ${relative(file)}`);
  }
};

const check = () => {
  const expected = [policyFile, claudeFile, cursorBridgeFile, prettierIgnoreFile, configFile, path.join(skillDirectory, 'SKILL.md'), lockFile];
  if (isTypeScript) expected.push(path.join(policyDirectory, 'typescript.md'));
  if (isReact) expected.push(path.join(policyDirectory, 'react.md'));
  if (hasDomainConvention) expected.push(path.join(policyDirectory, 'domain-module.md'));
  if (isVue) expected.push(path.join(policyDirectory, 'vue-primevue.md'));
  const missing = expected.filter((file) => !exists(file));
  if (missing.length) {
    for (const file of missing) console.error(`Missing ${relative(file)}`);
    process.exitCode = 1;
    return;
  }

  try {
    for (const file of expected) assertSafeTarget(file);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  let projectConfig;
  try {
    projectConfig = JSON.parse(read(configFile));
  } catch (error) {
    console.error(`Invalid ${relative(configFile)}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const configErrors = validateProjectConfig(projectConfig);
  if (configErrors.length) {
    for (const error of configErrors) console.error(`Invalid ${relative(configFile)}: ${error}`);
    process.exitCode = 1;
    return;
  }

  const stale = [];
  if (!read(policyFile).includes(marker('shared-policy', sharedPolicy).trim())) stale.push(relative(policyFile));
  if (!read(claudeFile).includes(marker('claude-bridge', claudeBridgePolicy).trim())) stale.push(relative(claudeFile));
  if (!read(cursorBridgeFile).includes(marker('cursor-bridge', cursorBridgePolicy).trim())) stale.push(relative(cursorBridgeFile));
  if (!read(prettierIgnoreFile).includes(lineMarker('prettier-ignore', prettierIgnoreContents).trim())) stale.push(relative(prettierIgnoreFile));
  for (const [destination, source, enabled] of managedFiles) {
    if (enabled && read(destination) !== read(source)) stale.push(relative(destination));
  }
  if (stale.length) {
    for (const file of stale) console.error(`Outdated managed content: ${file}`);
    process.exitCode = 1;
    return;
  }

  const lock = readLock();
  if (!isTrustedLock(lock)) {
    console.error(`Invalid managed lock metadata: ${relative(lockFile)}`);
    process.exitCode = 1;
    return;
  }
  if (lock.revision !== revision) {
    console.error(`Outdated agent-config policy: installed ${lock.revision}, source ${revision}`);
    process.exitCode = 1;
    return;
  }
  const installedManagedFiles = [...lock.managedFiles].sort();
  const expectedManagedFiles = managedFiles
    .filter(([, , enabled]) => enabled)
    .map(([destination]) => relative(destination))
    .sort();
  if (JSON.stringify(installedManagedFiles) !== JSON.stringify(expectedManagedFiles)) {
    console.error(`Invalid managed file ownership in ${relative(lockFile)}; run sync to repair it.`);
    process.exitCode = 1;
    return;
  }
  console.log(`agent-config check passed for ${projectRoot}`);
};

const readUserLock = () => {
  if (!exists(userLockFile)) return null;
  try {
    return JSON.parse(read(userLockFile));
  } catch {
    return null;
  }
};

const installUser = () => {
  if (!exists(userHome) || !fs.statSync(userHome).isDirectory()) throw new Error(`User home directory not found: ${userHome}`);
  let safe = true;
  const previousLock = readUserLock();
  const trustedPreviousLock = isTrustedUserLock(previousLock);
  const ownedManagedFiles = new Set(trustedPreviousLock ? previousLock.managedFiles : []);
  const nextManagedFiles = [];

  safe = writeUserBlock(
    userPolicyFile,
    codexFiles,
    'user-policy',
    `${userPolicyIntro}\n\n${userPolicy}`,
    '# Personal agent instructions\n\n'
  ) && safe;
  safe = writeUserBlock(
    claudeUserFile,
    userFiles,
    'claude-user-bridge',
    claudeUserBridge,
    '# Claude Code personal instructions\n\n'
  ) && safe;

  for (const { key, destination, contents } of userStandaloneFiles) {
    if (exists(destination) && !ownedManagedFiles.has(key)) {
      if (read(destination) === contents) {
        console.log(`Adopted matching generated ${displayUserFile(destination)}`);
      } else {
        console.warn(`Preserved unmanaged ${displayUserFile(destination)}; move it or merge it manually before agent-config can manage this path.`);
        safe = false;
        continue;
      }
    }
    const action = exists(destination) ? 'Synced' : 'Created';
    userFiles.write(destination, contents);
    nextManagedFiles.push(key);
    console.log(`${action} ${displayUserFile(destination)}`);
  }

  if (exists(userLockFile) && !trustedPreviousLock) {
    console.warn(`Preserved unmanaged ${displayUserFile(userLockFile)}; move it or merge it manually before agent-config can manage this path.`);
    safe = false;
  } else {
    const lock = {
      version: 1,
      source: 'Ked57/agent-config',
      scope: 'user',
      revision,
      installedAt: new Date().toISOString(),
      managedFiles: nextManagedFiles
    };
    userFiles.write(userLockFile, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Wrote ${displayUserFile(userLockFile)}`);
  }

  if (!safe) process.exitCode = 2;
};

const statusUser = () => {
  console.log(`User home: ${userHome}`);
  console.log(`Codex home: ${configuredCodexHome}`);
  console.log(`Source policy revision: ${revision}`);
  for (const file of [
    userPolicyFile,
    claudeUserFile,
    ...userStandaloneFiles.map(({ destination }) => destination),
    userLockFile
  ]) {
    console.log(`${exists(file) ? 'present' : 'missing'} ${displayUserFile(file)}`);
  }
};

const checkUser = () => {
  const expected = [
    userPolicyFile,
    claudeUserFile,
    ...userStandaloneFiles.map(({ destination }) => destination),
    userLockFile
  ];
  const missing = expected.filter((file) => !exists(file));
  if (missing.length) {
    for (const file of missing) console.error(`Missing ${displayUserFile(file)}`);
    process.exitCode = 1;
    return;
  }

  try {
    codexFiles.assertSafe(userPolicyFile);
    for (const file of expected.filter((candidate) => candidate !== userPolicyFile)) userFiles.assertSafe(file);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const stale = [];
  const expectedUserPolicy = marker('user-policy', `${userPolicyIntro}\n\n${userPolicy}`).trim();
  if (!read(userPolicyFile).includes(expectedUserPolicy)) stale.push(displayUserFile(userPolicyFile));
  if (!read(claudeUserFile).includes(marker('claude-user-bridge', claudeUserBridge).trim())) {
    stale.push(displayUserFile(claudeUserFile));
  }
  for (const { destination, contents } of userStandaloneFiles) {
    if (read(destination) !== contents) stale.push(displayUserFile(destination));
  }
  if (stale.length) {
    for (const file of stale) console.error(`Outdated managed content: ${file}`);
    process.exitCode = 1;
    return;
  }

  const lock = readUserLock();
  if (!isTrustedUserLock(lock)) {
    console.error(`Invalid managed lock metadata: ${displayUserFile(userLockFile)}`);
    process.exitCode = 1;
    return;
  }
  if (lock.revision !== revision) {
    console.error(`Outdated agent-config policy: installed ${lock.revision}, source ${revision}`);
    process.exitCode = 1;
    return;
  }
  const installedManagedFiles = [...lock.managedFiles].sort();
  const expectedManagedFiles = userStandaloneFiles.map(({ key }) => key).sort();
  if (JSON.stringify(installedManagedFiles) !== JSON.stringify(expectedManagedFiles)) {
    console.error(`Invalid managed file ownership in ${displayUserFile(userLockFile)}; run sync --user to repair it.`);
    process.exitCode = 1;
    return;
  }
  console.log(`agent-config user check passed for ${userHome}`);
};

try {
  if (command === 'init' || command === 'sync') userScope ? installUser() : install();
  else if (command === 'check') userScope ? checkUser() : check();
  else if (command === 'status') userScope ? statusUser() : status();
  else if (command === 'help') {
    console.log(`${usage}\n\ninit/sync installs managed configuration without overwriting project-owned instructions or routing. Use --user for personal configuration shared across repositories.`);
  } else {
    console.error(`Unknown command: ${command}\n${usage}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
