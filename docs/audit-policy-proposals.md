# Policy adoption from official documentation

Research and adoption date: 2026-10-15. The user requested all findings be applied.
All 19 rules below are adopted with their scopes and exceptions: TS1–TS6 in
`policy/typescript.md`, V1–V7 in `policy/vue-primevue.md`, and R1–R6 in
`policy/react.md`. The five gate refinements are adopted in
`fullstack-typescript-quality` and its `fullstack-typescript-tests` owner. Sources and
original rationale are retained below; wording in the active owners is authoritative.
The recommendations are our synthesis of the linked primary sources; the sources document
the mechanisms, not a universal requirement to adopt this particular policy wording.

Reviewed local sources: `policy/typescript.md`, `policy/vue-primevue.md`,
`policy/react.md`, `policy/routing.md`, `skills/writing-for-agents/SKILL.md`,
`skills/fullstack-typescript-{quality,static,tests}/SKILL.md`, and `package.json`.

The existing packs already cover exhaustive unions, meaningful test layers, framework
conventions, derived state, Effect dependencies/cleanup, memoisation, accessible names,
and loading/error states. Keep those meanings in their current owners. Apply the adopted rules only to the changed surfaces and contracts identified below.

## TypeScript: six additive one-liners

| ID | Candidate policy line | Why this adds something | Scope and gate | Primary evidence |
| --- | --- | --- | --- | --- |
| TS1 | Validate untrusted API, storage, and user data at the boundary with the existing parser before treating it as a domain type. | The pack restricts assertions but does not require runtime boundary validation. Static assertions disappear at runtime. | Changed external boundaries; test malformed, missing, and unsupported values with the existing unit/integration runner. Reuse existing validation; add no competing schema library. | [Type assertions have no runtime validation](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions). |
| TS2 | Await or return each promise, or attach a deliberate rejection handler to background work; `void` alone does not handle failure. | Makes the existing general failure-handling rule concrete at a common production failure seam. | Changed asynchronous paths; use existing type-aware ESLint rules if installed, plus rejection-path tests. `no-floating-promises` needs type-aware linting and may ignore `void` by default, so a green lint run alone is insufficient. | [no-floating-promises, especially ignoreVoid](https://typescript-eslint.io/rules/no-floating-promises/). |
| TS3 | Treat dictionary and positional array lookups as possibly missing and narrow the result before use. | Exhaustiveness and strictness do not necessarily expose missing indexed values. | Changed lookups; test absent keys and empty/out-of-range input. Evaluate `noUncheckedIndexedAccess` in a separate configuration change; enabling it across legacy code can require substantial migration. | [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html). |
| TS4 | Preserve the distinction between an omitted optional field and an explicit `undefined` when constructing updates or serialisable contracts. | Protects patch/merge and presence-check behaviour that an optional property type can obscure. | Contracts where presence has meaning; unit-test omission and explicit values. Evaluate `exactOptionalPropertyTypes` during configuration work rather than silently changing the whole project. JSON serialisation itself may erase `undefined`, so test the actual transport. | [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html). |
| TS5 | Express read-only ownership at shared domain boundaries with `readonly` properties or collections when callers must not mutate the value. | The current pure-function preference does not express ownership in signatures. | Shared inputs and returned domain snapshots; use existing typecheck and behaviour tests. `readonly` is a compile-time constraint, can be shallow, and does not freeze objects or eliminate mutable aliases. | [Readonly object properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties), [ReadonlyArray](https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type). |
| TS6 | For intentional negative type tests, use a narrowly placed `@ts-expect-error` with the expected failure explained so obsolete suppressions fail typecheck. | Adds a self-expiring contract test instead of an indefinitely silent type suppression. | Type contracts already tested by compilation; ensure the existing typecheck includes the test file. It proves that a diagnostic exists on the following line, not that it is the intended diagnostic; keep cases minimal. This does not authorise suppressing production errors. | [TypeScript 3.9: ts-expect-error comments](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#ts-expect-error-comments), [ban-ts-comment description support](https://typescript-eslint.io/rules/ban-ts-comment/). |

Highest-value starting subset: TS1–TS3. TS2 should refine the current async rule rather
than repeat it in a second section. TS4–TS6 should remain scoped to relevant contracts.

## Vue 3 / PrimeVue: seven additive one-liners

| ID | Candidate policy line | Why this adds something | Scope and gate | Primary evidence |
| --- | --- | --- | --- | --- |
| V1 | Verify changed Vue SFC scripts and templates with the repository's `vue-tsc`-backed typecheck; a Vite build alone does not check types. | Concrete omission in the generic quality skill's `tsc --noEmit` default: it does not establish that Vue templates are checked. | Vue SFC repositories; run the real existing typecheck script. If none supports SFCs, report the gate gap and route a tooling change through the quality skill. Do not pretend a bundler pass provides this evidence. | [Vue TypeScript overview: Vite transpilation and vue-tsc](https://vuejs.org/guide/typescript/overview.html#overview). |
| V2 | In asynchronous watchers, invalidate stale work when the source changes and verify that only the current result updates the UI. | Existing watcher scoping does not prevent old responses from replacing newer results. | Changed search/filter/route-driven requests; use controllable responses resolved in reverse order, plus an unmount path where relevant. Use cleanup compatible with the installed Vue version; `onWatcherCleanup` requires Vue 3.5+ and synchronous registration, while callback `onCleanup` is an alternative. | [Watcher side-effect cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup). |
| V3 | Keep parent-owned props read-only, including nested objects, and request parent changes through the established event or model contract. | Typed props/emits do not stop hidden nested mutation of parent state. | Changed child-parent editing flows; component-test the emitted update and the parent-visible result. Preserve deliberate, documented tightly coupled ownership where it already exists. | [One-way data flow and object/array prop mutation](https://vuejs.org/guide/components/props.html#one-way-data-flow). |
| V4 | Pass reactive inputs to composables as refs or getters and preserve reactivity when destructuring reactive state. | Prevents stale UI that types and the initial-render happy path can both miss. | Changed composable inputs; change the upstream value after mount and assert the rendered update. Do not blanket-ban `defineProps` destructuring: its compiler behaviour differs before and from Vue 3.5; passing a destructured value directly to a function still loses the reactive source. | [Reactive destructuring limitations](https://vuejs.org/guide/essentials/reactivity-fundamentals.html#limitations-of-reactive), [Reactive props destructure](https://vuejs.org/guide/components/props.html#reactive-props-destructure). |
| V5 | Give stateful or reorderable `v-for` items stable keys from domain identity and test that edits follow the item through reordering. | React already has a key rule; Vue currently has none. | Lists with child state, form input, insertion, deletion, or sorting; component-test an edited item after reorder/removal. Static stateless lists do not need an invented domain ID. | [Maintaining state with key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key). |
| V6 | Dispose listeners, timers, subscriptions, and manually owned effects when the component or composable scope ends. | Vue has no equivalent of the React pack's explicit lifecycle cleanup rule. | Changed integrations; mount/unmount/remount and verify a single active handler or subscription using existing tests. Vue automatically stops watchers created synchronously in setup; do not add redundant cleanup solely for those. | [Composables: side effects](https://vuejs.org/guide/reusability/composables.html#side-effects), [Stopping watchers](https://vuejs.org/guide/essentials/watchers.html#stopping-a-watcher). |
| V7 | When customising PrimeVue dialogs, preserve the accessible name, trigger state, keyboard dismissal, and focus behaviour, and verify the rendered interaction. | Labels and semantic selectors are covered, but a third-party component's accessibility contract can break during slot/headless customisation. | Changed dialogs; use role/name selectors, open with keyboard, exercise Tab/Escape as configured, and verify focus after close. Match the installed component version and intentional dismissal restrictions. Component reuse alone does not prove accessibility. | [PrimeVue Dialog accessibility](https://primevue.dev/dialog/#accessibility). |

V1 is the most concrete quality-gate improvement. V2 and V4 protect common long-lived
product flows. V7 belongs beside the existing PrimeVue reuse rule with a pointer to
`better-accessibility`, rather than copying that skill's entire checklist into this pack.

## React: six additive one-liners

| ID | Candidate policy line | Why this adds something | Scope and gate | Primary evidence |
| --- | --- | --- | --- | --- |
| R1 | Keep render logic repeatable and update props, state, and hook inputs through their owners rather than mutating shared values. | Declarative components and limited Effects do not explicitly cover render-time mutation and immutable snapshots. | Changed components/hooks; rerender with the same inputs and assert unchanged observable behaviour and unmodified inputs where mutation is a risk. Existing React lint rules can help; they are not a complete proof. | [Components and hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure). |
| R2 | Use a functional state updater when the next value depends on pending previous state, and keep the updater free of side effects. | Covers batching and stale-closure failures absent from the current state-design rules. | Changed queued/async counters, selections, or toggles; test overlapping updates or rapid interaction. A direct value update remains appropriate when replacing state with an independent value. | [Queueing a series of state updates](https://react.dev/learn/queueing-a-series-of-state-updates). |
| R3 | Preserve the repository's Strict Mode checks and fix repeat-render or cleanup defects they expose. | Existing Effect cleanup instructions do not require retaining the mechanism that detects missed cleanup or impurity. | Repositories already using Strict Mode; run applicable component tests and remount affected integrations. The extra checks are development-only; retain production/browser checks for timing and integration behaviour. Enabling Strict Mode in an older app is a separate scoped change. | [StrictMode checks](https://react.dev/reference/react/StrictMode). |
| R4 | Route render failures through the established error boundary and give users a recovery path; handle event and async failures in their owning flow. | Existing loading/error-state wording does not distinguish render exceptions from rejected operations. | Changed routes or failure-prone feature boundaries; inject a rendering failure and a separate event/request failure and verify the intended recovery. Use the framework's existing boundary mechanism. Error boundaries do not catch every error class, so avoid treating them as universal handlers. | [Catching rendering errors with an error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary). |
| R5 | Keep each input controlled or uncontrolled for its lifetime, and initialise controlled values to the appropriate defined value. | Native semantics and forms reuse do not explicitly prevent model switches during async loading or reset. | Changed input defaults, loaded records, and resets; component-test loading→loaded→edited→reset. Preserve existing form-library ownership; do not impose controlled React state on a deliberately uncontrolled form. | [Input caveats and controlled-input troubleshooting](https://react.dev/reference/react-dom/components/input#caveats). |
| R6 | For server-rendered features, keep server output and the first client render consistent and fix hydration mismatches at their source. | The existing React pack does not cover SSR correctness. | SSR routes only; exercise the real server response followed by hydration with the existing browser runner. A client-only component test cannot prove this. Investigate locale/time/random/browser-only divergence; use framework-supported patterns for intentional client-only content. | [hydrateRoot caveats](https://react.dev/reference/react-dom/client/hydrateRoot#caveats). |

The current React Effect and memoisation sections are already specific and useful. Keep
their explanatory branching instead of compressing every case into one long sentence.
R1–R2 are broadly useful; R3–R6 trigger only on the stated lifecycle or product surface.

## Quality-gate ownership and practical adoption

These adopted framework gates apply to consuming application repositories. This
configuration repository contains Node tooling, not a TypeScript/Vue/React application:
its actual scripts are `check`, `test`, and `verify`, and `npm run verify` runs the first
two. Passing those scripts validates this tooling; it cannot validate the proposed
framework behaviours or prove that a consuming app's gates exist.

Keep enforcement in the current owners:

- `policy/shared-policy.md`: the definition of done and preservation of existing checks.
- Framework packs: concise behavioural invariants and the evidence specific to that framework.
- `fullstack-typescript-quality`: command discovery, the compiler gate, and `.agents/agent-config.json` routing.
- `fullstack-typescript-static`: lint/dead-code configuration, including any separately approved type-aware rules.
- `fullstack-typescript-tests`: test-layer and coverage conventions.

The following refinements are adopted in the quality owners:

1. **Executable contracts:** Map each required check to an existing runnable script and fail the setup audit when the command is absent, skipped, or passes despite a controlled violation.
2. **Framework coverage:** Prove that typecheck includes the changed file type; Vue SFCs require template-aware checking, and a transpilation-only build is insufficient.
3. **Temporal regressions:** For changed async UI, use controlled response ordering and unmount/remount tests to cover stale results and leaked work in the existing designated runner.
4. **Release evidence:** For changed critical journeys, run the existing production build and selected browser journey; unit coverage alone does not exercise bundling, routing, or hydration.
5. **Risk-based change scope:** Keep fast checks frequent and run the required full gate before completion; add new tools or compiler flags only through an explicit tooling task after inspecting the repository.

These gate lines are our policy synthesis of the failure modes documented above and the
repository's existing quality-skill contract. They introduce no universal coverage
percentage, complexity budget, performance budget, or new test runner. The current
numerical thresholds remain owned by their existing skills until separately reviewed.

## Compaction guardrails

Use one line for one testable invariant, with its trigger and exception on that line
when short. Keep ordered discovery and version-sensitive procedures as steps. Preserve
the distinction between an automatic route, an explicit-only skill, and a child skill
loaded by an owner; lack of an automatic router entry alone does not prove a skill is
unused.

For example, Vue's validation section can become the following two lines without
changing its existing meaning:

- Before changing validation, inspect the feature's dependencies and reuse its existing schema stack, following the dominant local pattern when both Yup and Zod are present.
- Keep schema keys, field paths, types, bindings, errors, and i18n aligned; introduce a validation dependency or mix schema stacks only with explicit approval.

Compaction is a wording change, not an excuse to remove discovery, exceptions,
verification, or ownership. `writing-for-agents` remains the authority for that editing
procedure.
