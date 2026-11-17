# Pruning: firing record and context cost (2026-11-17)

Nothing here has been removed. This lists what each component costs in every session and how often it
fired, so the user can decide what to drop.

## Evidence

- **Firing, history:** 227 full-config runs from the two A/B rounds (Opus 5.5, a few Haiku; no
  prompt prefixes or ablations), from `~/agent-config-evals`.
- **Firing, smoke:** two `npm run eval:smoke` runs on Sonnet 5.5, before and after the `manual-qa`
  narrowing, plus four single runs (P1 on the old config with Sonnet; B6, K5 and L1 on Opus after the
  narrowing).
- **Context cost:** a "Reply with the single word ok." session from an empty cwd in an isolated home
  (the arm template home, `claude-haiku-5-5`, Claude Code 2.1.311), first-turn prompt tokens
  (`input + cache_creation + cache_read`). Variants disable one plugin or delete one skill directory.
  Repeat probes vary by about ±35 tokens, so single skills below about 50 tokens read as zero.

## Context cost per session

| Variant | Prompt tokens | Config cost |
|---|---|---|
| Bare Claude Code (built-ins only) | 17,216 | — |
| Full config | 21,998 | **+4,782 (+28%)** |

| Contributor | Tokens saved when removed | What loads |
|---|---|---|
| `~/.claude/CLAUDE.md` bridge → `~/.agents/AGENTS.md` (shared policy) | 1,511 | the completion contract, every session |
| `emilkowalski-ui` (8 skills) | 969 | 8 skill descriptions |
| `mattpocock-skills` | 829 | 27 skill and command entries |
| repo skills (7) | 653 | `agent-browser` 289, `fullstack-typescript-*` about 270 together, `manual-qa` 47, `codex-review` 46 |
| `pstack` | 308 | 1 model-invocable skill (`setup-pstack`), 2 agents, slash-command entries |
| `taste-skill` | 290 | 1 skill (`design-taste-frontend`, the longest description: 927 characters) |
| Policies `routing`, `typescript`, `vue-primevue`, `react`, `domain-module` | 0 | read on demand |

The parts sum to 4,560; the remaining about 220 tokens are the slash-command and agent listings that
change with them. The context cost is about 5% of a 100k-token session and is paid even by sessions
that never use a skill.

## Firing record

| Component | History (227 runs) | Smoke and checks (Sonnet unless noted) | Verdict on never firing |
|---|---|---|---|
| `routing` | 227 | every run | — |
| `typescript.md` | 198 | every TS task | — |
| `vue-primevue.md` | 104 (all Vue tasks) | every Vue task | — |
| `manual-qa` | 174 (77%; backend included) | after narrowing: 4 of 5 UI tasks, 0 of 7 non-UI; Opus B6 0 (was 4/4), K5 0 (was 3/3), L1 1 (was 7/7) | narrowed, see below |
| `agent-browser` | 20 | through `manual-qa` on UI tasks | correct: it is loaded by `manual-qa` |
| `emil-design-eng` | 13 (mostly before the `fix/skill-bugs` routing fix) | every UI task but C3 (3 of 4 before, 4 of 5 after); C3 missed it in both runs | fixed by `fix/skill-bugs`; C3 skips it though it reads the policy that asks for it |
| `animate` | 8 (C3, C4) | C3 both runs | — |
| `domain-module.md` | 4 (spurious, on design tasks) | 0 | correct: only an explicit request or existing convention routes there (K4) |
| `taste-skill` (`design-taste-frontend`) | 1 | P1 (no mockup) fired on both the old and new routing; D2 (mockup) never | **correct**: no earlier task asked for a designed page without a design. Routing now names the Claude skill and says to match a provided design instead |
| `react.md` | 0 | 0 | **correct**: no React fixture; all UI tasks are Vue |
| `pstack` | 0 without `/pstack:poteto-mode` | 0 | **correct by design**: 57 of 58 skills are slash-only. With the prefix: cost +71% (round 1) and +10% (round 2), no detectable quality change |
| `mattpocock-skills` | 0 | 0 | **correct by design**: descriptions trigger on user phrases ("diagnose", "grill me", "tdd") that synthetic prompts do not use |
| `break-ui`, `animation-performance`, `animation-vocabulary`, `find-animation-opportunities`, `improve-animations`, `review-animations` | 0 | 0 | correct: each is for an explicit request (stress test, audit, naming, review) that no task makes |
| `fullstack-typescript-*` (4) | 0 | 0 | correct: no task sets up quality tooling (K6 was never built) |
| `codex-review` | 0 | 0 | correct: a Cursor subagent workflow; Claude runs cannot reach it |

No trigger was found broken. The two clarifications made (`manual-qa`, `design-taste-frontend` in
`policy/routing.md`) are in the commit that adds the smoke.

## `manual-qa` narrowing

Removing `skills/manual-qa` alone changed nothing in round 2 (QA still counted in 7 of 8 ablated
runs), because `policy/shared-policy.md` item 4 and `policy/routing.md` demanded it for "a browser,
app, API, or CLI surface". All three places now ask for it only after a **user-facing UI** change
(browser page, component, style, native app screen); backend, API, CLI, library and documentation work
relies on automated checks unless the user asks for manual QA.

Cost effect on Opus is small on the two backend tasks rechecked (B6 $0.36 vs a $0.36 median before,
K5 $0.46 vs $0.48), consistent with round 2's −4% (CI −15% to +5%) for the skill ablation.

## Removal candidates

Ordered by tokens saved per session. "Fired" counts history plus smoke runs.

| Candidate | Tokens per session | Fired | For removal | Against |
|---|---|---|---|---|
| `mattpocock-skills` plugin | 829 | 0 unprompted | Largest never-fired pack; only user phrases or slash commands reach it | Useful on request (`/mattpocock-skills:diagnosing-bugs`, `tdd`, `grilling`); dropping it removes those commands |
| The 6 request-only `emilkowalski-ui` skills (all but `emil-design-eng`, `animate`) | about 700 of the pack's 969 (by description length) | 0 | Never fired; each serves a rare explicit request | They are what fires when such a request comes; the pack installs as one unit today (`bin/external-plugins.mjs` `emilSkills` would need a shorter list) |
| `pstack` plugin | 308 | 0 without the slash command | Cheap but never auto-fires; poteto-mode showed cost without measured gain | Only the slash command uses it, and the per-session cost is small |
| `fullstack-typescript-*` skills (4) | about 270 | 0 | Never fired in any run | They are this repo's TypeScript quality stack and the only owner of those gates |
| `codex-review` skill | about 46 | 0 | Unused by Claude and Codex | Near-zero cost; Cursor needs it |

Not candidates: `routing`, `typescript.md`, `vue-primevue.md`, `manual-qa`, `agent-browser`,
`emil-design-eng`, `animate` and `taste-skill` fire where routing expects them; `react.md` and
`domain-module.md` cost nothing until read.
