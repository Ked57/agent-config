# Design screens (`vue-design` task set)

Harness-only material for the `vue-design` tasks: the agent gets a design hand-off (Figma frame links read
through the offline Figma MCP stub, or PNG mockups) and builds the screen in the `vue-primevue` fixture.
Nothing in this directory reaches the agent: the scorer and screen data are copied into the worked app only
while the checks run (`.design-score/`), after the diff is taken.

```
design/
  scorer/          capture.mjs (build, serve, render a frame), visual.mjs, layout.mjs, kit.mjs, responsive.mjs, behaviour.mjs, a11y.mjs, score.mjs (entry)
  tools/           export-frames.mjs (reference → mockups, layout.json, baselines, Figma bundles), figma-tree.mjs, figma-variables.mjs
  <screen>/        screen.json (hand-written), layout.json and baselines.json (generated)
  FIGMA-STUB-FIDELITY.md   how the stub differs from Figma's MCP server
../figma-stub/     server.mjs, png.mjs, files.json, <screen>/<frame>.png + <frame>.json  (copied into the run: visible to the agent)
../mutants/D<n>-<screen>/  reference.patch (the hidden reference implementation), m*.patch, manifest.json
```

## Metric

A task scores the weighted mean of six `json-score` checks, each in 0..1 (`weight` on the check):
**combined = (0.4 visual + 0.3 layout + 0.1 components + 0.15 responsive + 0.1 behaviour + 0.1 a11y) / 1.15.**
Fixture gates (lint, typecheck, test, build) zero the run as for every task. One render pass (cached by a hash
of the app, scorer and screen data) serves all checks. Every frame opens in a fresh Chromium context:
the frame's viewport at deviceScaleFactor 1, `?query`, fixed clock (2026-11-16T12:00Z), UTC, en-US, reduced
motion, animations, transitions and the caret off, fonts and a quiet DOM awaited, viewport grown to the page
height (a full-page screenshot would otherwise resize it and close open overlays), then the frame's state steps,
then the viewport is grown again if the state made the page taller (sticky and fixed bars end up at the page end).
A field left focused and invalid by the steps is blurred, so focusing the first error does not replace the error
border a frame draws with a focus ring.
A frame whose steps fail scores 0 on visual, layout and a11y, and its behaviour tests fail.

Visual and layout judge at design-review precision (tolerances in `scorer/visual.mjs` `VISUAL` and
`scorer/layout.mjs` `LAYOUT`, tuned on D1: the reference 1.0, everything 8 px off ≈ 0.26 visual, a weak
real solution ≈ 0.75 combined, a lazy one ≈ 0.45). `ramp(e; a, b)` is 1 for an error `e ≤ a`, linear to 0 at `b`.

- **visual** (per frame, mean over all frames, equal weights): render and mockup are laid on the mockup's width
  and the taller height (padded with the page background). Every 32 px tile with content in either image
  (luminance variance > 4, or a flat tile whose colour is > 3 ΔE76 from the page background) is matched to
  its best position in the other within ±8 px horizontally and ±16 px vertically. Tile credit =
  structure × colour × shift, where structure = `ramp` of mean SSIM over 8 × 8 luminance windows (0 at 0.80,
  full at 0.97), colour = 1 − `ramp`(worst ΔE76 of the aligned 8 px sub-blocks; full ≤ 2, 0 at 8) and shift =
  1 at ≤ 2 px, down to ½ at 16 px. `sim` = mean tile credit × heightRatio, and
  `score = clamp((sim − base) / (1 − base))`, where `base` is the untouched fixture's `sim` for that frame
  (`baselines.json`), so "nothing built" scores 0 and the mockup itself 1.
- **layout** (per frame, mean over frames): key elements from `screen.json` `layout`, located by ARIA role and
  accessible name or by visible text, against the reference's elements in `layout.json`. An element found by its
  text is measured by the text's own box, without its container's padding, border and radius (the same text may
  sit in a table cell or in a span inside it). Element credit =
  mean(position, size) × style. Position = `ramp`(worse of |dx|, |dy| of the top-left corner; 4 px, 24 px);
  size = the worse of width and height, `ramp`((|error| − 2 px) / reference; 4 %, 15 %). Style is the
  product of: font size `ramp`(0, 2 px), weight `ramp`(0, 200), line height `ramp`(1, 6 px), text colour,
  background (first opaque one up the tree) and border colour each `ramp`(ΔE76; 3, 15) (a border on one side
  only = 0), corner radius `ramp`(1, 6 px) and padding `ramp`(Σ|error| of the four sides; 2, 12 px). Frame score
  = 0.8 × mean element credit (missing = 0) + 0.2 × reading-order agreement × share found.
- **behaviour**: Playwright expectations in `screen.json` `behaviour` (visible / hidden text, one row, stacked,
  no horizontal overflow), on a frame's state or their own steps. Score = passed / total.
- **components** (per frame, mean over the frames whose reference uses the kit): the design kit
  (`scorer/kit.mjs`) maps each PrimeVue root class to the kit component a designer places (`p-select` →
  "Dropdown", `p-tag` → "Status chip"). The reference's visible instances per kit component are counted at export
  (`layout.json` `components`); the render's are counted the same way. Score = Σ min(reference, render) / Σ reference,
  so a hand-built dropdown or a Badge where the design has a Status chip loses that instance's credit.
- **responsive** (per width, mean over widths): the default state (the desktop frame's `?query`, no steps) at
  600, 768, 1024, 1280 and 1920 × 900 px, widths no frame shows (`scorer/responsive.mjs`). A width scores 0 when
  the layout breaks there: the page scrolls sideways, an element sticks out of the viewport with no ancestor
  scrolling or clipping it horizontally (a table scrolling in its card is fine), or two key elements overlap by
  more than 30 % of the smaller one. Otherwise it scores the share of key elements found (the `screen.json`
  `layout` ids both the desktop and the mobile frame have), so an empty route scores 0. Nothing is compared with
  the design: any layout that adapts scores 1, and one that copies the frames' pixel widths loses the widths
  between them. Its 0.15 weight came out of components and behaviour, keeping the total at 1.15 so the drop of a
  mutant that only one check catches (D2 m6, font weights) is not diluted below the gate's 0.05.
- **a11y**: axe-core 4.14 (WCAG 2.0/2.1 A and AA rules) on every frame's state. Frame score = (1 − Σ penalty per
  violated rule: critical 0.25, serious 0.15, moderate 0.05, minor 0.02; floor 0) × the frame's layout coverage
  (an empty route has nothing to violate, so it must not score). Mean over frames; violations in `detail`.

State steps and locators are implementation-agnostic: `{ "click": { "role": "button", "name": "Row actions",
"nth": 0 } }`, `{ "choose": { "control": "Date range", "option": "Last 7 days" } }` (works with a native select,
a combobox or listbox that opens options, or a segmented control), `{ "fill": { "role": "textbox", "name": "Email",
"value": "" } }` (replaces a text field's value), `{ "text": "…" }` locators match whole
visible text (`"contains": true` for substrings), accessible names match from the start, case-insensitively.
`"within": { "role": "table" }` (any locator) limits a locator to that element, for words that also label
controls elsewhere, such as a status that is both a table tag and a filter chip.
When a name is not visible in the design, the task prompt states it in one neutral line.

Determinism: the same app renders byte-identical PNGs run after run (Inter is bundled in the template's
`public/fonts`, Chromium and axe are pinned in `evals/lib/browser.mjs` `BROWSER_TOOLS`), so any score
difference is real. Mockups and baselines must be regenerated after a Chromium, font or template change.

## Findings

Every check also writes `findings` to its score file: what a design review would flag, as
`{ category, frame, element, property, expected, rendered }`. The eval keeps them on the check record and
`npm run eval:defects -- <eval dir>` counts them per category (see `evals/README.md` "Design defects").

| Category | From | Flagged when |
|---|---|---|
| `missing` | layout | a key element is not found |
| `component` | components | a kit component's instance count differs from the reference (hand-built or swapped) |
| `spacing` | layout | top-left corner more than 4 px off; padding off by more than 2 px summed over the sides |
| `size` | layout | width or height off by more than 4 % (and 2 px) |
| `typography` | layout | font size, weight or line height off at all (line height: more than 1 px) |
| `colour` | layout | text colour, background or border colour more than 3 ΔE76 off; a border added or dropped |
| `radius` | layout | corner radius more than 1 px off |
| `state` | layout | a state frame's steps cannot be performed |
| `responsive` | responsive | at a width no frame shows: the page scrolls sideways, an element sticks out, a key element is missing or two overlap |
| `behaviour` | behaviour | a behaviour test fails |
| `a11y` | a11y | an axe rule is violated |

The thresholds are the full-credit edges of the layout tolerances: a finding is any property that loses credit.

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
4. Write `design/<screen>/screen.json`: `task`, `route`, `service` (the seed module, when it is not `src/services/<screen>.ts`), `figma` (`fileKey` of 22 letters and digits, file and
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
