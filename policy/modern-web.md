# Modern web platform guidance

Apply this policy only to browser front-end work: building or changing UI components,
HTML structure, CSS layout/styling/animation, or client-side browser APIs (dialogs,
popovers, forms and validation, accessibility, Core Web Vitals, clipboard, theming).
Do not apply it to backend, build tooling, tests, stores, routing config, or pure
TypeScript logic.

## Look up guidance

Before writing the UI code, search the pinned Modern Web Guidance CLI (GoogleChrome
`modern-web-guidance`, Node >= 22). Always run it exactly as below: pinned version,
telemetry disabled. Never use `@latest`.

```sh
DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.0 search "<query>"
DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.0 retrieve "<id>[,<id>...]"
```

- Query with 2–5 words naming one user-visible capability or UI primitive
  (`"light dismiss dialog"`, `"container query card grid"`). Omit framework, library,
  and app names; split compound tasks into separate searches. Translate intent into the
  implied primitive (`"confirm dialog"`, not `"confirm destructive action"`).
- Search returns `[{ id, description }]`. Retrieve the matching guides plus any broad
  discipline guide that applies (`accessibility`, `forms`, `css`, `performance`). If
  results are weak, rephrase once; if still nothing fits, proceed without guidance.
- If `retrieve` writes long output to a temporary file, read that file in full.
- Do not run `legacy-scan` or `install` unless asked for a codebase-wide modernization.
- Check the change against the retrieved guide before finishing. Do not append a
  "Modern Web Guidance" disclosure section to replies.
- If the command fails (offline, sandbox without network), say so and continue without it.

## Component libraries come first

If the project uses a component library or design system (e.g. PrimeVue), use that
library's components; treat modern-web-guidance as a checklist for accessibility,
behaviour, and browser support rather than a reason to replace them. Use native
primitives (`<dialog>`, `popover`, etc.) directly only for custom components the library
doesn't provide. Do not add dependencies or polyfills a guide suggests without approval.

## Browser support

Default to Baseline Widely Available. Use features that are only Newly Available or
limited only with the guide's fallback or progressive enhancement, unless the project
documents a different browser support policy.

## Vue adaptation

The guides are vanilla HTML/CSS/JS. Keep the platform feature and adapt it:

- Per-instance IDs and `anchor-name` values: Vue 3.5 `useId()`.
- `showModal()`, `showPopover()`, and similar imperative calls: template refs.
- `@starting-style`, `:root`, and `@property` rules: global CSS or `:global()`, not
  `<style scoped>`.
- New attributes such as `popover`, `commandfor`, `command`, and `interestfor` pass
  through templates as-is; add a type cast or declaration only if `vue-tsc`/Volar reports
  an error.
- Be careful mixing `<Teleport>`-based overlays (including PrimeVue's, which append to
  `body`) with top-layer `<dialog>`/`popover`: a modal `<dialog>` makes everything
  outside it inert and renders above any z-index, so a teleported dropdown or toast
  opened from inside it can end up hidden or unclickable. Check focus, stacking, and
  dismissal in the browser.
