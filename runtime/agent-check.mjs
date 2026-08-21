#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const configPath = path.resolve('.agents/agent-config.json');

if (!fs.existsSync(configPath)) {
  console.error('Missing .agents/agent-config.json. Run agent-config init first.');
  process.exitCode = 1;
} else {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const filesIndex = process.argv.indexOf('--files');
  const files = filesIndex === -1 ? [] : process.argv.slice(filesIndex + 1);

  if (files.length === 0) {
    console.log('Usage: node .agents/scripts/agent-check.mjs --files <changed-file> [...]');
    console.log(`Configured commands: ${Object.keys(config.commands ?? {}).join(', ') || '(none)'}`);
  } else {
    const globToRegExp = (glob) => new RegExp(`^${glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '§§')
      .replace(/\*/g, '[^/]*')
      .replace(/§§/g, '.*')}$`);
    const matches = (file, patterns = []) => patterns.some((pattern) => globToRegExp(pattern).test(file));
    const required = new Set();
    const recommended = new Set();

    for (const route of config.routing ?? []) {
      if (files.some((file) => matches(file, route.match) && !matches(file, route.except))) {
        for (const command of route.required ?? []) required.add(command);
        for (const command of route.recommended ?? []) recommended.add(command);
      }
    }

    if (required.size === 0 && config.commands?.fast) required.add('fast');

    console.log('Required verification:');
    for (const name of required) {
      const command = config.commands?.[name];
      console.log(command ? `- ${name}: ${command}` : `- ${name}: not configured`);
    }

    if (recommended.size > 0) {
      console.log('\nRecommended verification:');
      for (const name of recommended) {
        const command = config.commands?.[name];
        console.log(command ? `- ${name}: ${command}` : `- ${name}: not configured`);
      }
    }
  }
}
