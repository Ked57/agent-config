import assert from 'node:assert/strict';
import test from 'node:test';

import rule from '../skills/fullstack-typescript-static/no-comments.mjs';

function line(text, at) {
  return { type: 'Line', value: text, loc: { start: { line: at }, end: { line: at } } };
}

function block(text, at, lines = 1) {
  return { type: 'Block', value: text, loc: { start: { line: at }, end: { line: at + lines - 1 } } };
}

function reported(comments, { filename = '/repo/src/app.ts', options = [], templateComments } = {}) {
  const reports = [];
  const ast = templateComments ? { templateBody: { comments: templateComments } } : {};
  const context = {
    options,
    filename,
    sourceCode: { getAllComments: () => comments, ast },
    report: ({ loc }) => reports.push(loc.start.line),
  };
  rule.create(context).Program();
  return reports;
}

test('no-comments keeps tool directives, license headers, and the shebang', () => {
  const kept = [
    { type: 'Shebang', value: '/usr/bin/env node', loc: { start: { line: 1 }, end: { line: 1 } } },
    line(' eslint-disable-next-line no-console -- startup log', 3),
    block(' eslint-disable no-console ', 5),
    line(' @ts-expect-error -- wire data', 7),
    line(' prettier-ignore', 9),
    block(' v8 ignore next ', 11),
    block(' istanbul ignore file ', 13),
    block(' @__PURE__ ', 15),
    block(' #__NO_SIDE_EFFECTS__ ', 17),
    block(" webpackChunkName: 'sdk' ", 19),
    block(' @vite-ignore ', 21),
    line("/ <reference types='node' />", 23),
    line(' SPDX-License-Identifier: MIT', 25),
    block('! @license MIT ', 27),
    block('*\n * @license MIT\n ', 29, 3),
    line('# sourceMappingURL=app.js.map', 33),
  ];
  assert.deepEqual(reported(kept), []);
});

test('no-comments keeps a lone single-line WARNING and reports every other prose comment', () => {
  assert.deepEqual(reported([line(' WARNING: retrying this charges the customer twice.', 4)]), []);
  assert.deepEqual(reported([line(' WARNING: retrying charges twice.', 4), line(' more rationale', 5)]), [4, 5]);
  assert.deepEqual(reported([line(' WARNING:', 4), line(' warning: lower case', 6), block(' WARNING: block form ', 8)]), [4, 6, 8]);
  assert.deepEqual(reported([line(' Count the items', 1), block('* Count the items. ', 3), line(' TODO: later', 5)]), [1, 3, 5]);
  assert.deepEqual(reported([line(' This mentions @ts-ignore but is prose.', 1), line(' prettier-ignore-this-explanation', 2)]), [1, 2]);
});

test('no-comments allows JSDoc only under a configured public API path', () => {
  const comments = [block('* Counts items. ', 1), line(' prose', 3)];
  assert.deepEqual(reported(comments, { filename: '/repo/packages/sdk/src/count.ts', options: [{ publicApi: ['/packages/sdk/src/'] }] }), [3]);
  assert.deepEqual(reported(comments, { filename: '/repo/apps/web/src/count.ts', options: [{ publicApi: ['/packages/sdk/src/'] }] }), [1, 3]);
  assert.deepEqual(reported(comments, { filename: 'C:\\repo\\packages\\sdk\\src\\count.ts', options: [{ publicApi: ['/packages/sdk/src/'] }] }), [3]);
});

test('no-comments reports Vue template comments', () => {
  assert.deepEqual(reported([], { filename: '/repo/src/View.vue', templateComments: [block(' explain the view ', 2)] }), [2]);
});
