#!/usr/bin/env node
// Design-review findings of finished `vue-design` evals, counted by category:
//
//   npm run eval:defects -- <eval dir> [<eval dir> ...] [--out <file>]
//
// Each dir is an eval results dir (or a dir holding them); the first is the column the others are
// compared with. Writes DEFECTS.md into the first dir unless --out names a file. No model calls.
import fs from 'node:fs';
import path from 'node:path';
import { defectsReport, summarise } from './lib/defects.mjs';

/** Run records under `dir`: every `results/runs/*.json`, at any depth (a smoke dir holds one eval per set). */
function runRecords(dir) {
  const records = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (entry.name === 'runs' && path.basename(current) === 'results') {
        for (const file of fs.readdirSync(full).filter((name) => name.endsWith('.json'))) records.push(JSON.parse(fs.readFileSync(path.join(full, file), 'utf8')));
      } else if (!['app', 'node_modules', 'discarded', 'sandbox'].includes(entry.name)) visit(full);
    }
  };
  visit(dir);
  return records;
}

const args = process.argv.slice(2);
let out = null;
const dirs = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--out') out = path.resolve(args[(index += 1)]);
  else dirs.push(path.resolve(args[index]));
}
if (!dirs.length) {
  console.error('usage: npm run eval:defects -- <eval dir> [<eval dir> ...] [--out <file>]');
  process.exit(2);
}
const labelled = dirs.map((dir) => {
  const runs = runRecords(dir).filter((run) => (run.checks ?? []).some((check) => check.findings));
  if (!runs.length) throw new Error(`${dir}: no run records with design findings`);
  return { label: path.basename(dir), summary: summarise(runs) };
});
const report = defectsReport(labelled);
const file = out ?? path.join(dirs[0], 'DEFECTS.md');
fs.writeFileSync(file, report);
console.log(report);
console.log(`Written to ${file}`);
