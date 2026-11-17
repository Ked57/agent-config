#!/usr/bin/env node
// Generates the design mockups and Figma stub bundles (fixtures/vue-primevue/figma-stub/<screen>/).
//   npm run eval:design-assets                  every screen that lacks its assets
//   npm run eval:design-assets -- <screen> ...  these screens, regenerated even when present
// `npm run eval` and `npm run eval:mutants` generate missing assets on their own; run this after a
// Chromium, font or template change, then commit the changed layout.json and baselines.json.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allDesignScreens, exportScreen, missingDesignScreens } from './lib/design-assets.mjs';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'vue-primevue');
const all = allDesignScreens(FIXTURE);
const named = process.argv.slice(2);
const unknown = named.filter((name) => !all.includes(name));
if (unknown.length) {
  console.error(`Unknown screen(s): ${unknown.join(', ')}. Screens: ${all.join(', ')}`);
  process.exit(2);
}
const screens = named.length ? named : missingDesignScreens(FIXTURE, all);
if (!screens.length) console.log('Every screen has its design assets.');
for (const name of screens) exportScreen(FIXTURE, name);
