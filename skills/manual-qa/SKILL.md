---
name: manual-qa
description: >-
  Exercise changed behavior in the running system and report what actually
  happened. Use after implementing a change to a browser UI, native app, HTTP
  API, or CLI, and when the user asks for manual QA, hands-on verification, or
  a browser check.
---

# Manual QA

Hands-on verification of a running surface. A test-suite pass or code inspection is
not a manual result.

Load `~/.agents/skills/better-accessibility/SKILL.md` for keyboard, focus, or assistive
technology checks and `~/.agents/skills/figma-design-to-code/SKILL.md` when an exact
visual spec is in play.

Browser UI is driven with `agent-browser`. Load `~/.agents/skills/agent-browser/SKILL.md`
and follow it. If `agent-browser` is missing, UI scenarios are `blocked`: tell the user
to run `npm i -g agent-browser && agent-browser install`.

## Work

1. **Prepare.** Confirm the running build matches the changes. Start the local service
   using repository instructions when needed. Identify the entry point, test account/data,
   and observable success criteria. Use disposable fixtures and respect existing user
   authorization; report missing access or actions outside scope instead of inventing it.
   For browser UI, confirm `agent-browser` runs.
2. **Exercise.** For browser UI, follow `agent-browser` through the affected user
   journeys. For native apps, use the app itself. For APIs, make direct requests with
   representative inputs and inspect status, response, and resulting state. For tooling,
   invoke the CLI directly. Choose the actual surface under test; an API response alone
   does not verify a browser interaction.
3. **Explore.** Check the happy path and relevant failure, boundary, and recovery cases.
   For UI changes, include applicable loading/empty/error states, keyboard and focus,
   narrow/wide layouts, and persistence after refresh or navigation. Test neighboring
   behavior only where the change could affect it. On browser UI, when they apply,
   capture React inspection (component tree, props/state, re-renders on React apps),
   Core Web Vitals on the changed journey, a profiler trace when the change is
   performance-sensitive or the page feels slow, and snapshot or screenshot diffs when
   hunting regressions. Commands live in `agent-browser skills get core`.
4. **Record.** Capture exact actions, expected and actual results, and evidence:
   screenshots, URLs, sanitized request/response excerpts, or console output. Reproduce
   failures where safe, distinguishing product defects from environment failures. Protect
   credentials and personal data in artifacts.
5. **Retest.** Repair observed defects, then verify the new build and repeat failed cases
   plus affected neighboring paths. Do not weaken acceptance criteria. Close the
   `agent-browser` session you started. Clean up only fixtures and processes you created.

Done when each required scenario has a recorded `pass`, `fail`, or `blocked` result.

## Report

Identify the build/environment and give each scenario: steps, expected result, actual
result, `pass`, `fail`, or `blocked`, and an evidence link or excerpt. For browser UI,
include React inspection, Web Vitals, profiler, and regression diffs when they apply; state when
they were skipped. For failures, include impact and reproduction details; for blocked
cases, name the missing capability/input. List untested paths explicitly. Overall status
is `pass` when all required scenarios pass, `fail` when a defect is observed, or
`blocked` when required verification remains unavailable. If no runnable surface applies,
return `not applicable` with a concrete reason.

Never claim a manual check was performed without executing it, or treat a blocked
scenario as passed.
