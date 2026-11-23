---
name: mockup-hillclimb
description: >-
  Implement a mockup (Figma frame or screenshot) through a judged hill-climb: an
  implementer subagent builds it, a fresh judge subagent reviews every round against the
  mockup and the repository's conventions, and you orchestrate until the stop rules end
  the loop. Use when the user asks to hill-climb, judge-loop, or score a mockup
  implementation.
---

# Mockup hill-climb

You are the **orchestrator**. You write the inputs, start the subagents, capture the app,
keep the ledger and decide when to stop. You never edit the UI code and you never judge it:
an orchestrator that does either stops being independent of the work it scores.

## Roles and models

- **Implementer**: one subagent for the whole loop, resumed each round. Start it on model
  {{models.implementer}} unless the user specified otherwise.
- **Judge**: a fresh subagent every round, never resumed. Start each judge on model
  {{models.judge}} unless the user specified otherwise.

A model may come from another provider than yours; use whatever your harness offers to
start a subagent on it. If a role's model reads `unset` and the user named none, or the
named model cannot be started, stop and say so. A substitute judge changes what the
verdicts mean.

Information stays split for the whole run:

| | Sees | Never sees |
|---|---|---|
| Implementer | mockup, inventory, fix lists | verdict counts, round number, stop rules, judge output |
| Judge | mockup, captures, diff, inventory, scenario script, `JUDGE.md` | earlier rounds, the ledger, any target |

## 1. Brief

Collect, and ask the user only for what is missing:

- every mockup frame, with its state and viewport width;
- differences from the mockup the user wants on purpose, recorded as **accepted
  deviations**;
- how to run the app and reach each screen.

Create a working directory outside the repository (the harness scratchpad when it has
one). Every file below lives there. Done when each frame has a state, a width and a route.

## 2. Convention inventory

Before any code is written, list how the repository already handles each concern the
mockup leaves open. Read the code yourself; the inventory is fact-finding, so it does not
bias you. For each area, record the convention with the file that shows it, or `none`:

- forms: when validation runs, where errors and required markers show, submit pending and
  disabled states, server errors, success feedback, unsaved-changes guard;
- async data: loading (skeleton or spinner, show delay), empty, first-run, no-results,
  end-of-list, error and retry, optimistic updates;
- navigation: active item, page title, breadcrumbs, URL state for tabs and filters, scroll
  and focus after navigation, 404 and permission pages;
- overlays: dialogs (focus trap, Escape, outside click, scroll lock, focus return), toasts,
  dropdown and tooltip placement;
- motion: duration and easing tokens, enter and exit patterns, reduced motion;
- keyboard and accessibility: focus style, label pattern, live-region announcements;
- content: date, number and plural formatting, i18n and RTL support, truncation;
- destructive actions: confirmation or undo;
- themes and devices: dark mode, touch targets, breakpoints;
- shared components and design tokens the screen should reuse.

Write it to `inventory.md`. Done when every area has a convention with a file, or `none`.

## 3. Scenario script

Write `scenarios.md`: the ordered steps you will drive in the running app every round. One
scenario per mockup frame at its width and state, then one per inventory area the screen
touches. For example: submit the empty form, enter invalid data, force a server error,
throttle the network, use only the keyboard, open and close each overlay, press back, turn
on reduced motion, load worst-case data, resize through 600, 768, 1024, 1280 and 1920 px.
For each step, name the capture: a screenshot, or a short recording for motion.

The script is fixed once round 1 starts. Done when every frame and every touched inventory
area has a scenario.

## 4. Start the implementer

Brief it with the mockup, `inventory.md` and the accepted deviations. It follows
`figma-to-code` when the mockup is a Figma frame, then `manual-qa`. Where the mockup is
silent it follows the inventory; where the inventory says `none` it uses the repository's
existing components and tokens. Ask it to reply only when the build runs.

## 5. Each round

1. **Capture.** Run every step of `scenarios.md` in the app with `agent-browser`, after the
   page's fonts have loaded. Keep the captures of this round in their own folder.
2. **Judge.** Start a fresh judge. Its prompt is: read
   `~/.agents/skills/mockup-hillclimb/JUDGE.md` and follow it. Give it the mockup images, this round's captures, the branch diff,
   `inventory.md`, `scenarios.md` and the accepted deviations. Nothing else.
3. **Record.** Add the judge's findings to `ledger.json` under the round number, then apply
   the stop rules below.
4. **Feed back.** Send the implementer the findings that block (below), plus `taste-gap`
   findings raised for the first time this round, `wrong` before `minor`. Send each
   finding's location, observed, expected and fix only. Tell it that every frame and
   state of the mockup must still match after the fixes. Ask it to reply when the build
   runs again.

## Ledger and stop rules

A finding's identity is its checklist item and location, or its location for taste
findings.

A finding **blocks** when it is:

- source `mockup` with verdict `wrong` or `minor`;
- source `convention` (the build differs from the inventory);
- source `floor` (inaccessible, no feedback for an action, content lost or hidden, broken
  behaviour).

`taste-gap` findings are sent to the implementer once, in the round they first appear,
and never block. `taste-override` and `taste-nit` findings never block and go to the
report. A finding that passed earlier and fails now without the diff touching its area is
**noise**: it blocks only if the next round raises it again.

Stop at the first rule that fires:

- **Done**: two consecutive rounds with zero blocking findings.
- **Stuck**: the blocking count has not dropped for two rounds.
- **Circling**: a finding returns after being fixed, or two fixes keep undoing each other.
- **Cap**: six rounds.

## Report

Say which rule stopped the loop and after how many rounds, with the blocking count per
round. List the blocking findings left, the `taste-override` and `taste-nit` suggestions
deduplicated across rounds, the accepted deviations, and every scenario that could not be
captured. Done is only claimed under the Done rule.
