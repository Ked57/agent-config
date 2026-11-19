# ESLint rule candidates

Working list for turning the TypeScript, Vue, React, and test policies into lint rules.

Status (2026-11-19): every rule below except the dropped ones is adopted in
`skills/fullstack-typescript-static/SKILL.md`; the legacy baseline and CI count check are there too.
Affected-test selection and the scoped coverage gate live in `skills/fullstack-typescript-tests/SKILL.md`.
This file keeps the reasoning and open questions; the skills are the source of truth. Add new candidates
here first, then move them into the skill with a controlled-violation check.

Already enforced by `fullstack-typescript-static`: `complexity`, `sonarjs/cognitive-complexity`,
`quality-metrics/halstead`, `max-lines`, `max-lines-per-function`, `@typescript-eslint/no-explicit-any`.

## Tier 1: keep the gates from being switched off

| Rule | Catches |
|---|---|
| `linterOptions.reportUnusedDisableDirectives: "error"` | Disable comments that no longer suppress anything |
| `@eslint-community/eslint-comments/no-unlimited-disable` | Bare `eslint-disable` with no rule names |
| `@eslint-community/eslint-comments/require-description` | Disable comments with no reason |
| `@eslint-community/eslint-comments/no-restricted-disable` | Disabling the gates themselves (`complexity`, `max-lines*`, `sonarjs/cognitive-complexity`, `no-explicit-any`, `ban-ts-comment`) |
| `@typescript-eslint/ban-ts-comment` | `ts-ignore` and `ts-nocheck`; `ts-expect-error` only with a description |
| `no-warning-comments` (terms `istanbul ignore`, `v8 ignore`, `c8 ignore`, location `anywhere`) | Code quietly excluded from coverage |

### Legacy projects

These rules break projects that already contain the comments they ban. Adopt them with a ratchet:

- Freeze the current violations with ESLint bulk suppressions (`eslint --suppress-all`, ESLint 9.24+).
  This writes `eslint-suppressions.json`. New violations fail; fixed ones are removed with
  `--prune-suppressions`, so the baseline only shrinks.
- `reportUnusedDisableDirectives` needs no baseline: `eslint --fix` removes unused directives.
- Guard the baseline against agents: a policy line (never regenerate, only prune), CODEOWNERS
  review on `eslint-suppressions.json`, and a CI check that no file's suppression count for a rule ever grows.

## Tier 2: from `policy/typescript.md` (type-aware, needs `projectService`)

| Policy line | Rule |
|---|---|
| Unions and enums handled exhaustively | `@typescript-eslint/switch-exhaustiveness-check` with `considerDefaultExhaustiveForUnions: false`, so a reflexive `default:` does not hide a new variant. Covers `switch` only; `Record<Union, X>` covers value maps through TypeScript. |
| Avoid broad assertions | `consistent-type-assertions` with `objectLiteralTypeAssertions: "never"` (forces `const x: T = {...}` or `satisfies`), `no-non-null-assertion`. `as unknown as X` needs a `no-restricted-syntax` selector. `as const` and narrow DOM casts stay allowed. |
| Validate untrusted data | `no-unsafe-assignment`, `-member-access`, `-call`, `-return`, `-argument` (catch `JSON.parse` and `res.json()` used as typed values) |
| Await every promise; `void` alone is not handling | `no-floating-promises` with `ignoreVoid: false`, `no-misused-promises`, `return-await` |
| Small functions | `max-params` (about 4) |
| Static imports first; dynamic only on purpose | `import/first`; `no-restricted-syntax` on `ImportExpression` outside router or lazy-loading files |
| `*.mock.ts` never imported by production | `no-restricted-imports` (`**/*.mock`) on non-test files; `eslint-plugin-boundaries` for model → service → UI layering |

Dropped: `max-depth` and `max-nested-callbacks`. Cognitive complexity already penalises nesting,
and more size rules push agents toward one-use helpers.

## Tier 3: framework packs (only when the framework is present)

### Vue (`policy/vue-primevue.md`)

| Rule | Catches |
|---|---|
| `vue/block-lang` (`script: { lang: "ts" }`) | SFCs that escape typechecking |
| `vue/component-api-style` (`["script-setup"]`) | Options API and `defineComponent({ setup() })` |
| `vue/define-props-declaration`, `vue/define-emits-declaration` (`type-based`) | Runtime prop/emit declarations with weaker types |
| `vue/no-mutating-props` (`shallowOnly: false`) | Writing to props, nested objects included, or `v-model` on a prop |
| `vue/no-side-effects-in-computed-properties`, `vue/no-async-in-computed-properties` | Impure or async computeds |
| `vue/no-setup-props-reactivity-loss` | Destructuring props once. Version-dependent: may report valid Vue 3.5+ `defineProps` destructuring; test before adopting. |
| `vue/require-v-for-key` | `v-for` without `:key`. Does not ban `:key="index"`; that stays a review item. |
| `@intlify/vue-i18n/no-raw-text` | Literal user-facing text in templates |
| `eslint-plugin-vuejs-accessibility` | Missing `alt`, unlabeled controls, click without keyboard, invalid ARIA |
| `vue/no-restricted-html-elements` | Raw `<button>`, `<input>`, `<select>`, `<dialog>` instead of PrimeVue components |
| `no-restricted-imports` on the non-chosen schema library | Mixing Yup and Zod |

### React (`policy/react.md`)

- `react-hooks/exhaustive-deps` as an error, plus the React Compiler rules in recent
  `eslint-plugin-react-hooks` (set-state-in-effect, purity, immutability); confirm the installed version.
- `react/no-array-index-key`, `jsx-a11y`.
- With React Compiler on: `no-restricted-imports` warning on `useMemo`, `useCallback`, `memo`.
- To evaluate: `eslint-plugin-react-you-might-not-need-an-effect`.

## Tests

Gate files by runner with `files` globs so Vitest, Testing Library, and Cypress rules only apply where
they belong.

### Vitest (`@vitest/eslint-plugin`)

| Rule | Catches |
|---|---|
| `no-focused-tests`, `no-disabled-tests` | Leftover `.only` / `.skip` |
| `expect-expect` | Tests with no assertion |
| `valid-expect`, `valid-expect-in-promise` | `expect()` never resolved or matched |
| `no-conditional-expect`, `no-conditional-in-test` | Assertions that may silently not run; branching tests |
| `no-standalone-expect` | `expect` outside a test |
| `no-identical-title`, `valid-title` | Duplicate or empty names |
| `no-test-return-statement`, `no-done-callback` | Old async patterns that hide failures |
| `require-to-throw-message` | `toThrow()` that passes on any error |
| `no-restricted-matchers` (e.g. `toBeTruthy`, `toBeFalsy`) | Weak assertions |
| `prefer-strict-equal` | `toEqual` ignoring `undefined` fields (policy: omitted versus `undefined`) |
| `no-large-snapshots`, `no-interpolation-in-snapshots` | Snapshot dumps standing in for assertions |
| `max-nested-describe`, `prefer-hooks-on-top`, `no-duplicate-hooks` | Hard-to-read setup |
| `no-restricted-vi-methods` | Project-chosen bans, for example un-restored fake timers |

### Testing Library (`eslint-plugin-testing-library`, Vue config)

`prefer-screen-queries`, `no-node-access`, `no-container`, `prefer-user-event`, `await-async-queries`,
`await-async-utils`, `await-async-events`, `no-wait-for-side-effects`, `no-wait-for-multiple-assertions`,
`prefer-find-by`, `prefer-presence-queries`, `no-debugging-utils`. These enforce the policy's
user-facing selectors and deterministic async.

### Cypress (`eslint-plugin-cypress`)

| Rule | Catches |
|---|---|
| `no-unnecessary-waiting` | `cy.wait(5000)`; off in recent `recommended`, enable explicitly |
| `unsafe-to-chain-command` | Actions mid-chain that race |
| `no-assigning-return-values` | `const el = cy.get(...)` |
| `no-async-tests`, `no-async-before` | `async` test bodies mixing promises and Cypress chains |
| `no-force` | `{ force: true }` hiding real visibility/disabled bugs |
| `no-pause`, `no-debug` | Leftover debugging |
| `assertion-before-screenshot` | Screenshots before the UI settles |
| `no-xpath`, `no-chained-get` | Brittle selectors |

Do not enable `require-data-selectors`: the policy prefers role, label, then text over test IDs.

### Custom (`no-restricted-syntax` / `no-restricted-properties` / `no-restricted-imports`)

- Ban `wrapper.vm` and component-instance access in tests (tests behaviour, not internals).
- In Cypress CT, ban `cy.get` with CSS class selectors in favour of `cy.findByRole` / `findByLabelText`.
- In Vitest files, ban `@vue/test-utils` / `@testing-library/vue` mounting when Cypress CT owns
  component behaviour (one runner per behaviour).

## Not expressible in ESLint

- `tsconfig`: `noUncheckedIndexedAccess` (lookups may be missing), `exactOptionalPropertyTypes`
  (omitted versus `undefined`).
- Other tools: coverage, CRAP, mutation testing (the real check on assertion strength), Knip, `vue-tsc`.
- Review only: naming, behaviour-versus-implementation tests, narrating comments, index keys in Vue,
  controlled versus uncontrolled inputs, weakening the ESLint config itself (CODEOWNERS or a hook).

## Open questions

- Cost of type-aware linting in `verify:fast`.
- Which Tier 3 plugins to install by default versus only on request.
- Whether the suppression ratchet belongs in this skill or in the parent `fullstack-typescript-quality`.
