import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FILES = { prod: 'src/__probe__/probe.ts', test: 'src/__probe__/probe.test.ts' };
const NOT_A_GUARD = /^@eslint-community\/eslint-comments\//;

const PROBES = [
  { name: 'complexity', file: 'prod', marker: 'export function branchy', rule: /^complexity$/ },
  { name: 'cognitive-complexity', file: 'prod', marker: 'export function branchy', rule: /cognitive-complexity$/ },
  { name: 'max-params', file: 'prod', marker: 'export function manyParams', rule: /^max-params$/ },
  { name: 'no-explicit-any', file: 'prod', marker: 'export function anyValue', rule: /no-explicit-any$/ },
  { name: 'as-unknown-as', file: 'prod', marker: 'as unknown as', rule: /^no-restricted-syntax$/ },
  { name: 'floating-promise', file: 'prod', marker: 'Promise.resolve(1);', rule: /no-floating-promises$/ },
  { name: 'prose-comment', file: 'prod', marker: '// Count the items', rule: /./, unless: NOT_A_GUARD },
  { name: 'warning-comment-kept', file: 'prod', marker: '// WARNING:', none: true },
  { name: 'restricted-disable', file: 'prod', marker: '// eslint-disable-next-line complexity', rule: /eslint-comments\/no-restricted-disable$/ },
  { name: 'ts-ignore', file: 'prod', marker: '// @ts-ignore', rule: /ban-ts-comment$/ },
  { name: 'focused-test', file: 'test', marker: 'it.only(', rule: /no-focused-tests$|^no-restricted-/ },
  { name: 'retry-option', file: 'test', marker: '{ retry: 3 }', rule: /^no-restricted-/ },
  { name: 'timeout-argument', file: 'test', marker: '10_000', rule: /^no-restricted-/ },
  { name: 'fixed-sleep', file: 'test', marker: 'setTimeout(resolve, 50)', rule: /^no-restricted-/ },
  { name: 'timers-promises-import', file: 'test', marker: 'node:timers/promises', rule: /^no-restricted-/ },
  { name: 'own-module-mock', file: 'test', marker: 'vi.mock(', rule: /^no-restricted-/, info: true },
];

const lineOf = (file, marker) => fs.readFileSync(FILES[file], 'utf8').split('\n').findIndex((line) => line.includes(marker)) + 1;

function lint() {
  const result = spawnSync('eslint', ['--format', 'json', '--pass-on-unpruned-suppressions', FILES.prod, FILES.test], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try {
    return { reports: JSON.parse(result.stdout) };
  } catch {
    return { error: `eslint did not produce JSON (exit ${result.status}): ${(result.stderr || result.stdout).slice(-800)}` };
  }
}

function score(reports) {
  const errorsAt = (file, line) => {
    const report = reports.find((entry) => path.relative(process.cwd(), entry.filePath) === FILES[file]);
    return (report?.messages ?? []).filter((message) => message.severity === 2 && message.line === line);
  };
  const fatal = reports.flatMap((entry) => entry.messages.filter((message) => message.fatal).map((message) => `${path.basename(entry.filePath)}: ${message.message}`));
  const components = {};
  for (const probe of PROBES) {
    const errors = errorsAt(probe.file, lineOf(probe.file, probe.marker));
    const hit = errors.some((message) => message.ruleId && probe.rule?.test(message.ruleId) && !probe.unless?.test(message.ruleId));
    components[probe.name] = (probe.none ? errors.length === 0 : hit) ? 1 : 0;
  }
  const required = PROBES.filter((probe) => !probe.info);
  const total = required.reduce((sum, probe) => sum + components[probe.name], 0) / required.length;
  const missed = PROBES.filter((probe) => !components[probe.name]).map((probe) => probe.info ? `${probe.name} (info)` : probe.name);
  return { score: fatal.length ? 0 : total, components, detail: [...fatal, missed.length ? `missed: ${missed.join(', ')}` : 'every probe caught'].join('; ') };
}

const linted = lint();
const result = linted.error ? { score: 0, components: {}, detail: linted.error } : score(linted.reports);
fs.writeFileSync(process.env.EVAL_SCORE_FILE, JSON.stringify(result));
console.log(`${result.score.toFixed(2)} ${result.detail}`);
