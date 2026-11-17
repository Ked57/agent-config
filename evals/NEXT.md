# Next (after round 2, 2026-11-17)

Proposal only. This section supersedes the round 1 plan below where they differ.

## What round 2 established

| Finding | Number | Consequence |
|---|---|---|
| The design set is the first metric off the ceiling | `main` scores 0.67–0.82 per screen (reference 1.00, untouched 0.00) | Quality comparisons are possible there |
| Run-to-run noise on a design task is as large as the effects seen | Two `main` reps differ by 0.09 on average per task (SD 0.107; rep 2 mean 0.80 vs rep 1 0.75) | One rep per arm cannot separate a +0.08 effect from noise; the `fix/skill-bugs` result (+0.08, CI −0.03 to +0.19) is not evidence of a gain |
| Synthetic backend tasks hit the ceiling a fourth time | `backend-legacy`: 93 of 94 hidden cases after one test correction | Stop building synthetic backend difficulty; use real-repo replay |
| Removing `skills/manual-qa` does not remove manual QA | Still counted as fired in 7 of 8 ablated runs; cost −4% (CI −15% to +5%) | The instruction lives in `policy/shared-policy.md`; ablate that |
| poteto-mode changes neither score nor cost detectably on the legacy set | d −0.01 (CI −0.03 to +0.01); cost +10% (CI −6% to +26%) | Needs tasks where the baseline fails |
| Screenshot-only costs less than the Figma link | −27% (CI −36% to −17%); score d +0.03 (CI −0.10 to +0.15) | Worth a properly powered rerun: the structured data may not pay for itself |

## Proposed next steps, in order

1. **Power the design comparisons** (about $60). Add 5–6 screens (to 11–12 tasks) and run 2 reps per
   arm. With per-run SD 0.107, two reps halve the within-task variance; at 12 tasks the MDE is about
   0.07–0.09. Rerun `main` vs `fix/skill-bugs` and figma-link vs screenshot-only on that design;
   `main` runs are reused across both.
2. **Ablate manual QA properly** (about $13 on `backend-legacy`, arm A reused): `--b-add` a copy of
   `policy/shared-policy.md` without "Definition of done" item 4 and a `routing.md` without the
   `manual-qa` line, plus `--b-remove skills/manual-qa`. Confirm from transcripts that QA stops.
3. **RacePlanr replay** (about one day of harness work, then about $30): load fixtures from a private
   path, give runs a Rust toolchain and their own cargo target dir, build three tasks (issue #102
   whole, #102 part B, #106), keep everything outside this public repo. This is the only credible
   test bed for poteto-mode. Details: `~/agent-config-evals/round2/r4a-raceplanr-feasibility.md`.
4. **Routing reach**: about 45% of haiku probe runs never read `routing.md`. Measure the same rate on
   Opus from saved transcripts (no spend) before changing `~/.agents/AGENTS.md`.
5. **Design-pack ablations** (`--b-remove plugin:taste-skill`, `emilkowalski-ui`) only after step 1
   shows the design set can detect 0.08.

## Known limits of the design metric

- Visual similarity is normalised against the untouched app and tolerant to small shifts; it rewards
  matching the mockup, not good design.
- Behaviour saturates on four of six screens.
- The Figma stub generates code from the rendered reference; real `get_design_context` output is
  messier, and asset URLs are placeholders. See `fixtures/vue-primevue/design/FIGMA-STUB-FIDELITY.md`.
- Mockups and baselines must be regenerated after a Chromium, font or template change.

---

# Round 1 plan: leave-one-out ablations

Proposal only. Nothing here has been run. It follows the two Phase 3 comparisons of 2026-11-16
(`~/agent-config-evals/2026-11-16T10-20-full-vs-bare` and `…-poteto-mode`).

## What the first comparisons say about ablations

| Finding | Number | Consequence |
|---|---|---|
| The hidden-test metric is at ceiling | 30 of 37 tasks score 1.0 in both arms; all 5 spec tasks do | A quality ablation on today's tasks will return "cannot conclude" or "no difference" |
| Removing the whole config moves the run score little | full − bare = +0.04, 95% CI −0.04 to +0.12, MDE 0.12 at 37 tasks | One component's effect is at most the whole config's, so it is below the MDE |
| Cost effects are large and tight | full +103% over bare (CI +75% to +139%); poteto-mode +71% (CI +19% to +120%) | Cost ablations are detectable now, at about 15–20 tasks |
| Few components ever fire | In 37 full-config runs: `routing` 100%, `typescript` 92%, `manual-qa` 81%, `vue-primevue` 38% (14 of 15 Vue tasks), `agent-browser` 3 runs, `animate` 2 runs. Everything else 0% | A component that never fires cannot change an outcome; removing it is a no-op by construction |
| `emil-design-eng` never fired where routing expects it | missed on 13 of 13 Vue UI tasks | A routing defect to fix, not an ablation to run |

So the order is: fix what cannot be measured, run the cost ablations that can, then quality ablations
once harder tasks exist.

## Step 0: make quality measurable (prerequisite)

Three attempts to build tasks a strong baseline fails did not work on these fixtures: explicit prompts
85 of 85 hidden cases, invariant-only prompts 84 of 84, spec-sized tasks 110 of 110. The baseline
misses come from somewhere else:

- **Robustness the prompt does not spell out.** B5 (concurrent duplicate webhooks) fails in both arms.
  H1 lost one case in the bare arm (the authentication and amount-validation case; cause not examined).
- **The completion contract.** Bare failed two fixture gates (a type error in its own test, an
  unformatted README). Full failed none.

Tasks worth building, in this order:

1. **Ten more "implied robustness" tasks** in the B5 mould on `ts-backend`: the prompt states the
   outcome and never mentions concurrency, retries, restarts or partial failure. Mutation-check each.
   About one day of agent work; no model spend beyond a $6 calibration pass.
2. **A fixture cut from a real repository** (a RacePlanr API slice with its own history), with tasks
   taken from closed issues and the tests that shipped with their fixes as hidden tests. This is the
   only route to spec-sized tasks at realistic difficulty, and the only fair test of `poteto-mode`.
3. **Bug-diagnosis tasks** (K7 was designed, not built): a planted root cause where patching the symptom
   passes the visible tests and fails a hidden regression test. This is what `mattpocock-skills:diagnosing-bugs`
   and `manual-qa` should change.

Target before any quality ablation: baseline run score between 0.4 and 0.7 on at least 15 tasks. At
SD(d) 0.25 that gives an MDE of about 0.19 at 15 tasks and 0.13 at 30.

## Step 1: cost ablations (runnable now)

Each is `--a main --b main --b-remove <component>`, 1 rep, concurrency 2. Quality is reported with
its MDE as a guard against regressions larger than 0.12–0.2; the question each one answers is cost.

| # | Remove | Why it is worth testing | Task set | Runs | Estimated cost | MDE |
|---|---|---|---|---|---|---|
| 1 | `skills/manual-qa` | Fired in 81% of runs. Vue library tasks cost $0.67 a run full against $0.14 bare, with near-identical scores; QA is the likely driver | `vue-primevue` (15) + `ts-backend` (13) | 56 | $30 | Cost: about ±25% of the ratio. Quality: 0.14 at 28 tasks |
| 2 | `policy/typescript.md` | Fired in 92% of runs; costs a read on every TypeScript task | `ts-backend-hard` (8) + `components-backend` K1–K3 (3) + `ts-backend` (13) | 48 | $28 | Cost: about ±20%. Quality: 0.15 at 24 tasks; K1–K3 strict-lint checks are the policy's own rules (3 tasks, descriptive only) |
| 3 | `policy/vue-primevue.md` | Fired on 14 of 15 Vue tasks; the library-fit checks are its rules | `vue-primevue` (15) | 30 | $13 | Cost: about ±35%. Quality: 0.19 at 15 tasks, at ceiling today |
| 4 | `policy/shared-policy.md` completion contract (ablate by `--b-add` of a copy without the "Definition of done" section) | The two gate failures in the bare arm point at it; it is also what triggers `manual-qa` | as #1 | 56 | $30 | as #1 |

Run #1 first: it is the largest suspected cost and its quality risk is the one the user cares about
(does skipping QA let defects through). Run #4 only if #1 shows a cost drop, to separate the skill
from the contract that invokes it. Total for #1–#3: about $71.

Cost MDEs are read off the Phase 3 bootstrap intervals (ratio CI half-width about 30 points at 37
tasks, scaling with 1/√tasks). They are estimates, not computed power.

## Step 2: quality ablations (after step 0)

| Remove | Task set it needs | Tasks | Estimated cost | MDE at SD(d) 0.25 |
|---|---|---|---|---|
| `skills/manual-qa` | bug-diagnosis tasks plus K5-style "only visible when run" defects | 15 | $20 | 0.19 |
| `policy/typescript.md` | K1–K3 plus 5 more rule-targeted tasks (the rule of at least 5 tasks) | 8 | $11 | 0.27; needs 15 tasks for 0.19 |
| `/pstack:poteto-mode` prefix on vs off | real-repo spec tasks (step 0, item 2), 2 reps | 10 | $70 | 0.25; the only comparison where 2 reps are worth paying for, because single runs are long |
| `plugin:mattpocock-skills` | bug-diagnosis tasks, with a `/mattpocock-skills:diagnosing-bugs` or `tdd` prefix arm, since it never fires unprompted | 10 | $15 | 0.25 |

## Not worth testing

| Component | Reason |
|---|---|
| `plugin:pstack` removal without a prefix | 57 of its 58 skills are slash-only; it fired in 0 of 37 runs. Removing it changes nothing |
| `plugin:taste-skill`, `emilkowalski-ui` (8 skills) | Never fired, and their outcome is visual. Needs a screenshot rubric first; then test with `--browser` and a judge, not hidden tests |
| `policy/react.md` | No React fixture |
| `policy/domain-module.md` | Fired 0 times; only K4 (explicit request) reaches it. One task cannot support a verdict |
| `skills/fullstack-typescript-*` | Never fired; K6 was not built because the skill names an npm package that does not exist (`quality-metrics/halstead`). Fix the skill first |
| `skills/codex-review`, Cursor bridges, Codex block | Cannot be exercised by a Claude-only suite |

## Defects found on the way, cheaper to fix than to ablate

1. Routing sends Vue UI work to `emil-design-eng`, which was never loaded on any of the 13 tasks
   that expect it.
2. `fullstack-typescript-static` requires a Halstead lint rule from a package that returns 404.
3. External plugin versions are not pinned; an isolated install today got pstack 0.15.42 where the
   live home has 0.15.32.
