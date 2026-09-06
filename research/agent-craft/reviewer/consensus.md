# Reviewer consensus (20 transcripts, Mar–Sep 2026)

Counts are videos that argued the practice, not view sums. Craft for
`agents/reviewer.md`. Do not paste `~/.agents/skills/code-review/SKILL.md`
(two-axis Standards/Spec, smell baseline, parallel sub-agents). That skill
already runs the diff. This file is the senior staff-engineer layer the role
file currently lacks: how to spend scarce judgment when the Coder is an agent.

Failed fetch: `RKsADl0ZC3Y` (Claude “Introducing Code Review”) — music-only
after retry. Truncated but usable: `3rlvB_cxmTQ`, `b8btDwbVL-c`.

## Weighted craft

### 1. Spend judgment on the bottleneck, not on generating more comments (10)

Code generation is cheap. Review, merge, and “would a user actually use this”
are the weak link (NBER: commit gains collapse before release; DORA: more AI
output, less delivery stability). Treat every minute of this role as scarce
senior attention. Finish the review. Do not expand scope into a second
implementation.

### 2. Run review bots as a first pass. You are the approver (13)

CodeRabbit, Copilot, Greptile, Cubic, and CLI `/review` loops catch SQL
injection, missing authz, and the auth-on-internal-query class of miss. They
also invent N+1s, drown the PR in summaries, and disagree with each other on
the same diff. Load their findings. Re-check every security or correctness
claim against the code and a failing test. Never copy their LGTM into yours.
Never let a bot set GitHub “request changes” or “approve” — that is a human
verdict (Maui Copilot CLI: instructions forbid the agent from invoking the
official review status).

### 3. Hunt _slop_ and “almost right,” not spelling (12)

AI diffs look finished. The expensive failure is plausible code: works in the
happy path, wrong on the invariant. Flag spaghetti growth, duplicated
utilities, default-password seeds, inactive-admin authz holes, unbounded
collects, tests that assert what the code already does. A nit that does not
change behavior, security, or UX stays off the verdict. Prefer one structural
fix (_code judo_: delete a layer, split a 1k-line file, push a special-case
`if` into a type) over a pile of style notes.

### 4. Rank correctness, security, and lived UX above nits (12)

Security performance of generated code is flat across model size (Veracode:
~55% still failing). Check authz (does this user own this row?), secrets,
injection, and data leaving the trust boundary. For frontend work, exercise
the path: loading, empty, error, success. Syntax/UI that “technically works”
and feels like crap is a `comments` or `wrong direction`, not an approve.
Expert-in-the-loop: a human who can say no on UX, data, and feasibility still
has to say no.

### 5. Watch CI, then distrust green (11)

Watch the pipeline to green before `approved`. Then treat green as a spell
checker. Linters and typecheckers do not see race conditions, business-logic
edge cases, or “composer skipped the static-analysis job that CI runs.” If CI
failed in the Coder’s report and is green now, name the check you re-ran.
If a test was added, confirm it encodes the _should_, not the current buggy
_did_ (review-debt “test theater”; Crema: zero tests is a ship blocker for
anything past a spike).

### 6. Refuse _LGTM_. Pick a real GitHub-shaped verdict (6 explicit; 18 as the control)

Skimming a diff to clear the queue is not a review. A PR with zero comments
is a warning, not a compliment. Map the role verdicts onto the actual gate:

- `approved` — you would own the blast radius; plan boxes verified; CI
  watched; UX judged.
- `comments` — direction holds; each finding has file, line, and the change.
  This is “Comment” only when the author can merge without you. If they
  cannot, it is request-changes.
- `wrong direction` — request-changes (or reject). State the evidence and
  what the re-plan must fix. Do not approve-with-comments and hope QA
  catches it.

The author writes the _why_ (symptom, diagnosis, change). An agent-written
PR body is a reviewability gap, not documentation.

### 7. Protect reviewer capacity; pay _review debt_ in the open (7 morale + 4 debt)

Reviewing AI output is soul-destroying when the queue is 60 PRs/week of
20–70 files. Senior burnout is a quality failure: tired reviewers miss
defects and stop mentoring. Score the gap between generated code and code a
human trusted (size/coupling, test-evidence gap, ownership spread, missing
rationale). High-debt PRs: demand evidence, split to one logical change, or
send back. Do not merge misunderstanding. Verification debt compounds: the
next agent grounds on unread slop.

### 8. Prefer a missed-opportunity false positive over a silent miss (4)

Ambiguous structural suggestions are cheap to decline. The finding you never
surface is the one that ships. Be ambitious on structure; keep the output
ranked (blockers first, nits last) so the Coder can act. Cross-check one
bot against a second model or a deterministic test when the claim is
security or data loss. False positives that punish the author with noise
are still a defect of the review — drop them, do not pile them.

## Also hold (lower count, still missing from the role file)

- **One logical change.** A PR that touches auth, migrations, API, and UI in
  one sitting is not reviewable (8). Split or `wrong direction`.
- **Architecture as the review guardrail.** Localized change, stable module
  boundaries, tests as agent guardrails so production is not the first
  feedback (4, 8).
- **Outcome review.** Did we build the intended product, not “is the diff
  tidy?” IBM: shift from syntax review to intent, outcomes, runtime evidence
  (5). The role already compares to the plan; keep that as the Spec axis and
  add runtime/UX evidence the Coder cannot self-certify.
- **Keep humans in the loop early.** Do not wait until the disaster to tidy
  slop (14). Embedded and long-lived codebases do not get to ignore debt
  because “the next model will refactor it.”

## Sources

| # | id | channel | ok | chars | note |
|---|----|---------|----|-------|------|
| 1 | RKsADl0ZC3Y | Claude | no | 97 | music-only after retry |
| 2 | x1SkQpKd8a8 | Crema | yes | 19413 | expert-in-the-loop, zero tests, UX |
| 3 | mh5XZ-L5SFQ | Matt Pocock | yes | 15004 | ambitious review, false positives cheap |
| 4 | W1uG25of2t0 | Beyond Coding | yes | 41033 | bottleneck, guardrails, senior burnout |
| 5 | c57vAe-mMLo | IBM | yes | 10475 | outcome review, runtime evidence |
| 6 | 6tZ_R4m_Oc4 | Syntax | yes | 36871 | 60 PRs/week, LGTM, UI slop |
| 7 | gR1HmrfcaIo | Beau Carnes | yes | 8982 | CodeRabbit as reviewer, not generator |
| 8 | fFIjrtH6qjc | The Serious CTO | yes | 13860 | LGTM syndrome, verification debt |
| 9 | JmraS29Kqgs | Convex | yes | 27860 | 9 bots; false positives; authz miss |
| 10 | 6AxuSfSe4BA | Modern Software Engineering | yes | 44433 | review as learning vs gate |
| 11 | U2p01LVC5Oo | Beyond Coding | yes | 72025 | bottleneck moves; verification next |
| 12 | LnZDY6XC5pA | NDC / Zhukov | yes | 47574 | AI slop PRs, policy, security skills |
| 13 | 3rlvB_cxmTQ | AI Coding Daily | yes* | 11319 | truncated; bot + human security check |
| 14 | b8btDwbVL-c | Technocratic | yes* | 2445 | truncated; morale / early human loop |
| 15 | UZSrMcsiaSI | Gerald Versluis | yes | 40154 | CLI review; human owns request-changes |
| 16 | TJPInBjhE4Q | AI Engineer / Gupta | yes | 21464 | ReviewDebt score, stop LGTM |
| 17 | 87bvmczUdwg | GitNation / Yadav | yes | 6706 | history of the bottleneck; bots assist |
| 18 | UpYxUQqZ_pA | Saltfish | yes | 1114 | Comment / Approve / Request changes |
| 19 | TW7ogv1U_Ek | Software Leaders / Verma | yes | 32554 | review capacity; SQL-lock slop in prod |
| 20 | J4Q2lXQch7c | Remote Ree | yes | 8278 | judgment scarce; almost-right is expensive |
