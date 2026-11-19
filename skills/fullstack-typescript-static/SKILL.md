---
name: fullstack-typescript-static
description: Loaded by fullstack-typescript-quality for ESLint gates (complexity, Halstead, size, gate protection, type-aware, framework, and test rules), suppression baselines, and Knip.
version: 1.1.0
---

# Full-stack TypeScript static analysis

Owned by `fullstack-typescript-quality`, which loads this skill for lint and dead-code gates. Keep rules here; point orchestration, commands, Git/CI, and the shared checklist back to the parent.

## ESLint gates

Apply to `*.ts` and to pure TypeScript / `<script>` blocks in React and Vue sources:

- Cyclomatic complexity under 22 (`complexity` with `max: 21`).
- Cognitive complexity under 22: reuse an existing single-rule cognitive plugin when present; otherwise enable only `sonarjs/cognitive-complexity` (threshold `21`) without the Sonar recommended suite and without a SonarQube server.
- Halstead via `quality-metrics/halstead` from the npm package `quality-metrics` (not `eslint-plugin-quality-metrics`, which does not exist); register it as `plugins: { "quality-metrics": qualityMetrics }` from `import qualityMetrics from "quality-metrics"`, and install its `ts-morph` peer. Configure `maxVolume` and `maxEffort` co-thresholds the plugin supports. The rule reports Difficulty; treat reported Difficulty ≥ 80 as failure when auditing or installing. Do not invent a `maxDifficulty` option.
- File length under 500 lines (`max-lines` with `max: 499`) and function length under 100 lines (`max-lines-per-function` with `max: 99`).
- `@typescript-eslint/no-explicit-any`, allowing `unknown`.
- `max-params` with `max: 4`. Do not add `max-depth` or `max-nested-callbacks`: cognitive complexity already weighs nesting, and more size rules push toward one-use helpers.

## Gate protection

Every other gate is one comment away from being switched off, so enable these on all linted files:

- `linterOptions.reportUnusedDisableDirectives: "error"`.
- `@eslint-community/eslint-comments/no-unlimited-disable` and `require-description`.
- `@eslint-community/eslint-comments/no-restricted-disable` listing the gate rules: `complexity`, `sonarjs/cognitive-complexity`, `quality-metrics/halstead`, `max-lines`, `max-lines-per-function`, `max-params`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`, `no-warning-comments`, `@eslint-community/eslint-comments/no-restricted-disable`, `@eslint-community/eslint-comments/no-unlimited-disable`.
- `@typescript-eslint/ban-ts-comment`: ban `ts-ignore` and `ts-nocheck`; allow `ts-expect-error` only with a description.
- `no-warning-comments` with `terms: ["istanbul ignore", "v8 ignore", "c8 ignore"]` and `location: "anywhere"`, so code cannot leave the coverage gate silently.

Generated files (for example `components.d.ts`) belong in `ignores`, not under disable comments.

## Existing codebases

Enable new rules on the whole codebase and freeze current violations in the same change with ESLint
bulk suppressions (ESLint 9.24+): run `eslint --suppress-all` once to write `eslint-suppressions.json`.

- New violations fail; unpruned suppressions fail by default (do not pass `--pass-on-unpruned-suppressions`).
- After the initial baseline, only shrink it with `eslint --prune-suppressions`. Never rerun `--suppress-all` or `--suppress-rule` to absorb a new violation.
- CI fails when the total suppression count exceeds the merge-base count. A missing merge-base `eslint-suppressions.json` is the adoption baseline, not a count of zero: the change that adds the file passes, and every later change still fails when the count grows.
- Where the project scopes gates to declared quality perimeters, the gate rules a perimeter already passed stay at zero suppressions in it; newly added rules are baselined there like everywhere else.

## Type-aware rules

Enable `typescript-eslint` type information (`parserOptions.projectService`, with `extraFileExtensions: [".vue"]` for Vue):

- `@typescript-eslint/switch-exhaustiveness-check` with `considerDefaultExhaustiveForUnions: false`, so a `default:` does not hide a new union member.
- `@typescript-eslint/consistent-type-assertions` with `objectLiteralTypeAssertions: "never"`, and `@typescript-eslint/no-non-null-assertion`. Ban `as unknown as` with `no-restricted-syntax` (`TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]`).
- `@typescript-eslint/no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-return`, `no-unsafe-argument`: untrusted `any` (`JSON.parse`, `response.json()`) must pass the boundary parser.
- `@typescript-eslint/no-floating-promises` with `ignoreVoid: false`, `no-misused-promises`, `return-await`.
- `import-x/first`, unless the formatter already hoists imports (for example `@trivago/prettier-plugin-sort-imports`); `no-restricted-syntax` on `ImportExpression` outside router and deliberate lazy-loading files.
- `no-restricted-imports` banning `**/*.mock` from production files where the `<domain>.mock.ts` convention exists.

## Framework rules

Only when the framework is a dependency.

Vue (`eslint-plugin-vue`):

- `vue/block-lang` (`script: { lang: "ts" }`), `vue/component-api-style` (`["script-setup"]`).
- `vue/define-props-declaration` and `vue/define-emits-declaration` (`"type-based"`).
- `vue/no-mutating-props` (`shallowOnly: false`).
- `vue/no-side-effects-in-computed-properties`, `vue/no-async-in-computed-properties`.
- `vue/no-setup-props-reactivity-loss` only below Vue 3.5; on 3.5+ it reports valid `defineProps` destructuring.
- `vue/require-v-for-key`.
- `vue/no-restricted-html-elements` for raw `button`, `input`, `select`, `textarea`, `dialog` when PrimeVue or local primitives replace them, each with a message naming the replacement.
- `@intlify/vue-i18n/no-raw-text` when `vue-i18n` is installed; `eslint-plugin-vuejs-accessibility` `flat/recommended`.
- `no-restricted-imports` on the schema library the project does not use when one of Yup or Zod is established.

React:

- `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` as errors, plus the React Compiler rules of the installed `eslint-plugin-react-hooks` recommended config.
- `react/no-array-index-key`; `jsx-a11y` recommended.
- With React Compiler enabled: `no-restricted-imports` warning on `useMemo`, `useCallback`, and `memo`.

## Test rules

Scope each plugin to its runner's files with `files` globs.

- Vitest files (`@vitest/eslint-plugin`): `no-focused-tests`, `no-disabled-tests`, `expect-expect`, `valid-expect`, `no-conditional-expect`, `no-conditional-in-test`, `no-standalone-expect`, `no-identical-title`, `valid-title`, `require-to-throw-message`, `no-large-snapshots`, `no-interpolation-in-snapshots`, `max-nested-describe`, `prefer-hooks-on-top`, `no-duplicate-hooks`.
- Testing Library files (`eslint-plugin-testing-library`, framework config): `prefer-screen-queries`, `no-node-access`, `no-container`, `prefer-user-event`, `await-async-queries`, `await-async-utils`, `await-async-events`, `no-wait-for-side-effects`, `no-wait-for-multiple-assertions`, `prefer-find-by`, `prefer-presence-queries`, `no-debugging-utils`.
- Cypress files (`eslint-plugin-cypress`): `no-unnecessary-waiting`, `unsafe-to-chain-command`, `no-assigning-return-values`, `no-async-tests`, `no-async-before`, `no-force`, `no-pause`, `no-debug`, `assertion-before-screenshot`, `no-xpath`, `no-chained-get`. Leave `require-data-selectors` off: selectors go role, label, then text.
- Custom: ban `wrapper.vm` and component-instance access in tests; in component specs ban `cy.get` with a CSS class selector; in Vitest files ban component mounting (`@vue/test-utils`, `@testing-library/vue`, `@testing-library/react`) when Cypress Component Testing owns component behaviour.

## Installation

Install only what is missing, with the project's package manager:

```sh
npm install -D eslint typescript-eslint eslint-plugin-sonarjs quality-metrics ts-morph knip @eslint-community/eslint-plugin-eslint-comments eslint-plugin-import-x
```

By framework and runner, when absent: `eslint-plugin-vue`, `eslint-plugin-vuejs-accessibility`, `@intlify/eslint-plugin-vue-i18n`, `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `@vitest/eslint-plugin`, `eslint-plugin-testing-library`, `eslint-plugin-cypress`. Pick a version whose peer ranges match the installed ESLint, TypeScript, and runner.

## Knip

Configure Knip for dead code and use its full capability set (unused files, exports, dependencies, and related findings it supports). Wire Knip into `verify:full` and CI through the parent skill; keep it out of pre-commit and `verify:fast` by default.
