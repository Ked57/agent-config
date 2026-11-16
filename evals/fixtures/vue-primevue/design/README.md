# Design screens (`vue-design` task set)

Harness-only material for the `vue-design` tasks: the agent gets a design hand-off (Figma frame links read
through the offline Figma MCP stub, or PNG mockups) and builds the screen in the `vue-primevue` fixture.
Nothing in this directory reaches the agent: the scorer and screen data are copied into the worked app only
while the checks run (`.design-score/`), after the diff is taken.

```
design/
  scorer/          capture.mjs (build, serve, render a frame), visual.mjs, layout.mjs, behaviour.mjs, a11y.mjs, score.mjs (entry)
  tools/           export-frames.mjs (reference → mockups, layout.json, baselines, Figma bundles), figma-tree.mjs, figma-variables.mjs
  <screen>/        screen.json (hand-written), layout.json and baselines.json (generated)
  FIGMA-STUB-FIDELITY.md   how the stub differs from Figma's MCP server
../figma-stub/     server.mjs, png.mjs, files.json, <screen>/<frame>.png + <frame>.json  (copied into the run: visible to the agent)
../mutants/D<n>-<screen>/  reference.patch (the hidden reference implementation), m*.patch, manifest.json
```

## Metric

A task scores the mean of four `json-score` checks (`visual`, `layout`, `behaviour`, `a11y`), each in 0..1.
Fixture gates (lint, typecheck, test, build) zero the run as for every task. One render pass (cached by a hash
of the app, scorer and screen data) serves all four checks. Every frame opens in a fresh Chromium context:
the frame's viewport at deviceScaleFactor 1, `?query`, fixed clock (2026-11-16T12:00Z), UTC, en-US, reduced
motion, animations, transitions and the caret off, fonts and a quiet DOM awaited, viewport grown to the page
height (a full-page screenshot would otherwise resize it and close open overlays), then the frame's state steps.
A frame whose steps fail scores 0 on visual, layout and a11y, and its behaviour tests fail.

- **visual** (per frame, mean over all frames, equal weights): render and mockup are laid on the mockup's width
  and the taller height (padded with the page background). Every 32 px tile with content in either image is
  matched to its best position in the other within ±24 px horizontally and ±48 px vertically, then scored as
  mean SSIM over 8 × 8 luminance windows there, discounted by the move (half credit at 64 px). The colour term
  is 1 − mean ΔE76/20 of aligned 8 px blocks that are not background. `sim = (ssim + colour) / 2 × heightRatio`,
  and `score = clamp((sim − base) / (1 − base))`, where `base` is the untouched fixture's `sim` for that frame
  (`baselines.json`), so "nothing built" scores 0 and the mockup itself 1.
- **layout** (per frame, mean over frames): key elements from `screen.json` `layout`, located by ARIA role and
  accessible name or by visible text, against the reference's boxes in `layout.json`. Element credit is the
  mean of position (top-left within 16 px, linearly to 0 at 48 px), size (within max(16 px, 5%), to 0 at 3×)
  and type (font size within 1 px, to 0 at 3 px; weight 100 off = half). Frame score = 0.8 × mean element
  credit (missing = 0) + 0.2 × reading-order agreement × share found.
- **behaviour**: Playwright expectations in `screen.json` `behaviour` (visible / hidden text, one row, stacked,
  no horizontal overflow), on a frame's state or their own steps. Score = passed / total.
- **a11y**: axe-core 4.14 (WCAG 2.0/2.1 A and AA rules) on every frame's state. Frame score = (1 − Σ penalty per
  violated rule: critical 0.25, serious 0.15, moderate 0.05, minor 0.02; floor 0) × the frame's layout coverage
  (an empty route has nothing to violate, so it must not score). Mean over frames; violations in `detail`.

State steps and locators are implementation-agnostic: `{ "click": { "role": "button", "name": "Row actions",
"nth": 0 } }`, `{ "choose": { "control": "Date range", "option": "Last 7 days" } }` (works with a native select,
a combobox or listbox that opens options, or a segmented control), `{ "text": "…" }` locators match whole
visible text (`"contains": true` for substrings), accessible names match from the start, case-insensitively.
When a name is not visible in the design, the task prompt states it in one neutral line.

Determinism: the same app renders byte-identical PNGs run after run (Inter is bundled in the template's
`public/fonts`, Chromium and axe are pinned in `evals/lib/browser.mjs` `BROWSER_TOOLS`), so any score
difference is real. Mockups and baselines must be regenerated after a Chromium, font or template change.

## Run it by hand

```bash
# score a worked app (cwd = app) the way the checks do
mkdir -p .design-score && cp -r $F/design/scorer .design-score/scorer && cp -r $F/design/<screen> .design-score/screen \
  && cp -r $F/figma-stub/<screen> .design-score/mockups
EVAL_TOOLS_DIR=$SANDBOX/.cache/tools node .design-score/scorer/score.mjs all --json /tmp/score.json --shots /tmp/shots
```

`DESIGN_SCORE_NO_CACHE=1` forces a fresh pass. `EVAL_TOOLS_DIR` is `<sandbox>/.cache/tools` (the suite installs it
on the first check with `"browserTools": true`).

## Add a screen

1. Pick a route that the template does not have and the data the screen shows. Put fixed seed data in a new
   module under `template/src/services/` (it ships to every Vue task, so keep it inert: no imports from the app,
   nothing registered). Document any seed switch (like `?seed=empty`) in the module's header comment.
2. Build the reference in a scratch copy of the prepared fixture (stack conventions, PrimeVue where it fits,
   Tailwind tokens, accessible names for icon-only controls). Check lint and `vue-tsc`.
3. Save it as `mutants/D<n>-<screen>/reference.patch` against the template (`git diff` of the scratch copy, or
   `npm run eval:mutants -- --fixture vue-primevue --make-patch <app>`).
4. Write `design/<screen>/screen.json`: `task`, `route`, `figma` (`fileKey` of 22 letters and digits, file and
   page name), `frames` (id, `nodeId` like `13-2`, designer-style `name`, `viewport`, optional `query`, `steps`,
   `masks`), `layout` (6–25 key elements per frame) and `behaviour` tests. Copy `analytics/screen.json`'s shape.
5. Run `AGENT_CONFIG_EVALS_SANDBOX=<scratch sandbox> node evals/fixtures/vue-primevue/design/tools/export-frames.mjs <screen>`.
   It writes the mockups and Figma bundles to `figma-stub/<screen>/`, `layout.json`, `baselines.json` and the
   `files.json` entry, and fails when a layout locator finds nothing in the reference (fix the locator).
6. Look at every PNG in `figma-stub/<screen>/`: state frames must show their state (an open menu, a chosen
   option, the empty state).
7. Add the task to `evals/tasks/vue-design.json`: the copied-link prompt (one labelled link per frame, the route
   and data line, any accessible-name line), the `screenshot-only` mode prompt and `files`, and the four checks
   with `copy` pointing at `design/<screen>` and `figma-stub/<screen>` (copy D1's).
8. Write mutants `m1…` as patches that each break one thing (spacing, colour token, missing state, mobile layout,
   swapped components, type, accessibility, one "lazy but plausible" version) and a `manifest.json` with
   `scoreGate` (D1's gate is a good start).
9. Run `npm run eval:mutants -- --set vue-design --task D<n>-<screen> --json /tmp/gate.json`: the reference ≥ 0.95,
   the untouched fixture ≤ 0.1, every mutant at least `mutantMaxDrop` below; `checkScores` in the JSON show
   which component dropped.
10. Run `npm run verify` (it checks the stub for leaks and that `layout.json` matches `screen.json`).
