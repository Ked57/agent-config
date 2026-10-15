# Vue 3 + TypeScript + PrimeVue

Apply this policy only in repositories using Vue 3 + TypeScript. Before changing forms, inspect the repository dependencies and the target feature's existing patterns.

## Components

- Use `<script setup lang="ts">` unless the repository has an established exception.
- Use typed `defineProps` and `defineEmits`.
- Keep parent-owned props, including nested objects, read-only; request updates through the established event/model contract. Preserve documented tightly coupled ownership exceptions and test emitted updates and the parent-visible result.
- Pass reactive composable inputs as refs or getters and preserve reactivity through destructuring; test upstream changes after mount. Follow the installed Vue version's props-destructure behaviour (changed in 3.5); passing a destructured value directly still loses its reactive source.
- Keep templates declarative; keep business logic, API access, and complex state transitions in composables, services, or domain modules.
- Use `computed` only for derived state; it must have no side effects.
- Use `watch` and `watchEffect` only for scoped side effects or synchronisation; invalidate stale async work so only the current result updates the UI. Use cleanup supported by the installed Vue version (`onWatcherCleanup` needs 3.5+ and synchronous registration; callback `onCleanup` is an alternative).
- Give stateful or reorderable `v-for` items stable keys from domain identity; test that edits follow the item through reorder/removal. Static stateless lists need no invented ID.
- Dispose manually owned listeners, timers, subscriptions, and effects when their component/composable scope ends; synchronously created setup watchers already stop automatically.

## Forms and validation

- Before changing validation, inspect dependencies and the feature's usage; reuse its schema stack (Yup or Zod with vee-validate), following the dominant local pattern when both exist.
- Keep schema keys, field paths, types, bindings, error display, i18n, and existing form-state patterns aligned; introduce a validation dependency or mix schema stacks only with explicit approval.

## UI, accessibility, and tests

- When PrimeVue is installed, reuse its established components, the repository token preset, and local UI primitives. For original UI composition patterns, read `frontend-design` EXAMPLES.md.
- When customising PrimeVue dialogs, preserve accessible names, trigger state, configured keyboard dismissal, and focus behaviour; verify keyboard opening, navigation, and focus after close in the rendered UI with `better-accessibility`, matching the installed version and intentional dismissal restrictions.
- Use i18n for user-facing text unless the local convention explicitly differs.
- Represent loading, empty, error, and success states where relevant.
- Prefer user-facing selectors: role, then label, then visible text; use stable test IDs only when needed.
- Ensure semantic elements, labels, and accessible names make those selectors possible.
- Use the repository's designated component-test runner. For Cypress Component Testing, keep assertions user-facing and deterministic.
- Cover changed conditional validation, disabled/read-only states, default/synchronisation behaviour, and submit success/error paths where relevant.
- Verify changed SFC scripts and templates with the repository's `vue-tsc`-backed typecheck. If absent, report the gate gap and route tooling work through `fullstack-typescript-quality`; a Vite build alone does not check types.
