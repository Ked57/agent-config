# Vue 3 + TypeScript + PrimeVue

Apply this policy only in repositories using Vue 3 + TypeScript. Before changing forms, inspect the repository dependencies and the target feature's existing patterns.

## Components

- Use `<script setup lang="ts">` unless the repository has an established exception.
- Use typed `defineProps` and `defineEmits`.
- Keep templates declarative; keep business logic, API access, and complex state transitions in composables, services, or domain modules.
- Use `computed` only for derived state; it must have no side effects.
- Use `watch` and `watchEffect` only for scoped side effects or synchronisation.

## Forms and validation

Before modifying validation:

1. Inspect `package.json` and the target module's current usage.
2. Reuse the validation stack already used by that feature: vee-validate + Yup uses Yup; vee-validate + Zod uses Zod.
3. If both are available, follow the dominant local pattern.
4. Do not introduce a validation dependency or mix Yup and Zod in one form flow without explicit approval.

Use existing form state, error display, i18n, and PrimeVue patterns. Keep schema keys, field paths, types, and bindings aligned.

## UI, accessibility, and tests

- Reuse established PrimeVue components, the repository token preset, and local UI primitives. For original UI composition patterns, read `frontend-design` EXAMPLES.md.
- Use i18n for user-facing text unless the local convention explicitly differs.
- Represent loading, empty, error, and success states where relevant.
- Prefer user-facing selectors: role, then label, then visible text; use stable test IDs only when needed.
- Ensure semantic elements, labels, and accessible names make those selectors possible.
- Use the repository's designated component-test runner. For Cypress Component Testing, keep assertions user-facing and deterministic.
- Cover changed conditional validation, disabled/read-only states, default/synchronisation behaviour, and submit success/error paths where relevant.
