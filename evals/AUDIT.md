# Independent audit of the eval suite

Audited: `feat/eval-suite` at `d65b15d`, the saved results in `~/agent-config-evals/validation-*`, and
the original modern-web-guidance (MWG) eval. Branch: `audit/eval-suite`. Nine subagents ran the
streams in parallel; a usage-limit interruption cut streams 1, 5 and 7 short, so their sections say
what was and was not verified. Stream reports are included below nearly verbatim.

## Verdict

**Trustworthy**

- **Cost overhead of MWG.** Recomputed from raw results: +38.6% USD per run in the original eval
  (task-bootstrap 95% CI +24% to +55%, 15 of 15 tasks dearer) and +54.2% in the reproduction (CI +16%
  to +91%). These are one effect on two task mixes, not a range.
- **Judge blinding and position.** No arm tells in any of the 61 suite diffs. Slot 1 won 0.53 of
  decisive calls (CI 0.44 to 0.62, n=153). Judge sets were never mixed.
- **The original MWG quality result.** B−A = −0.04 on the 1–5 composite, CI −0.14 to +0.05, over 15
  tasks.

**Not trustworthy**

- **"Every run passed every check" on the Vue fixture.** Before fixes, 46 of 47 hand-built wrong
  solutions passed the task checks. The checks never discriminated on any of 126 real runs.
- **"Every hidden test passed" on ts-backend.** 6 of the 16 A/A runs originally failed and were
  turned into passes by editing two hidden tests and running `--recheck`, which overwrote the
  failures with no trail. The pagination edit was a fair correction. The webhook edit was tuning
  toward a pass: the prompt says a repeat delivery "should still get a 2xx", and three of
  the four saved solutions answer concurrent duplicates with HTTP 500 `SQLITE_BUSY`, which the
  loosened test accepts. The loosening did not break the core invariant: check-then-insert is still
  killed 10 of 10 times and no saved solution double-applies credits. A strict test would fail three
  of the four saved B5 runs.
- **Hidden tests as a measure of correctness.** Before fixes they killed 32 of 86 hand-written wrong
  solutions (37%). B9, B10, B11 and N1 have one saved real solution each.
- **The suite's "significant / not significant" verdicts.** The rule cannot return a positive at
  `--reps 1` or `--smoke`, treats reps of one task as independent, and cannot see effects below the
  single-pair noise floor at any sample size. The judge names a winner between runs of the same arm
  in 54–71% of pairs.
- **The MWG reproduction's quality verdict.** 10 pairs on 5 tasks, task-level CI on B−A of −0.80 to
  +0.46. It cannot exclude a +0.3 benefit.
- **Isolation from the live config.** The README says agents cannot see `~/.claude`. They can: results live
  under the home directory, so Claude Code walks up and loads the live `~/.claude/skills` (23 live
  skills in every saved init event) and reads `~/.claude/CLAUDE.md`, in both arms and in the judge.
  It is symmetric, so it does not bias A against B, and in a probe the `@` import to the live
  policy was not opened. But both arms ran with skills the eval did not install, and a live skill
  could shadow one under test (precedence not verified). Agents also share `/tmp`: in one A/A run
  arm A restored a file arm B had written there (identical bytes, so no effect that time).

**Does "don't adopt MWG" hold?** Yes as a decision, on the original eval: the cost is certain and
the net composite benefit is bounded near zero. "No quality gain" is overstated. The guidance helped
on F2-type tasks, hurt on F1-type tasks and was wasted on library-covered tasks; narrowed routing
was never tested.

## Mutation kill rates

| Checks | Wrong solutions killed before | After fixes | Notes |
|---|---|---|---|
| Vue task checks (15 tasks) | 1 of 47 | 36 of 47 | "After" uses the same mutants the fixes were designed from, so it overstates the gain |
| ts-backend hidden tests, all 12 | 32 of 86 (37%) | 62 of 86 (72%) | Required checks only |
| B1 comments | 2 of 5 | 5 of 5 | |
| B2 pagination | 1 of 6 | 5 of 6 | Survivor: full last page still returns a cursor |
| B3 N+1 | 2 of 4 | 4 of 4 | |
| B4 priority migration | 2 of 5 | 5 of 5 | |
| B5 webhook | 4 of 7 | 7 of 7 | Passes all four saved solutions 10 of 10 |
| B6 login rate limit | 7 of 11 | not fixed | Survivors: lock never expires, successes counted, case-sensitive key, unknown emails unlimited |
| B7 tenant isolation | 5 of 5 | unchanged | Task is a one-line fix; small mutation surface |
| B8 structured errors | 5 of 11 | not fixed | Survivors keep the old error shape on five routes |
| B9 background notifications | 0 of 9 | 1 of 9 | 9 of 9 counting the info-level delivery check |
| B10 service layer | 1 of 11 | 9 of 11 | "No refactor at all" passes the hidden test by design |
| B11 config validation | 2 of 8 | 5 of 8 | |
| N1 parse-duration | 1 of 4 | 4 of 4 | |

Stream 1a (B1–B4) did not deliver a written report; its rows come from its raw result files
(`before.txt`, `after.txt`), which also show every strengthened test passing the saved solutions
and failing the untouched fixture. Its pagination verdict: the loosened test accepted a 4xx for
`limit=500`, which the prompt allows, but before fixes it also passed five of six wrong paginations,
including one with no maximum at all. All 25 saved ts-backend runs (copies) still pass every required check under `--recheck` with the strengthened tests, and the new recheck trail (`audit.jsonl`, original checks kept) was written.

## What was fixed (commits on `audit/eval-suite`)

| Commit | Fix |
|---|---|
| `36d67bc` | Vue checks: pattern checks ignore comments (`"comments": true` opts out); 11 checks changed, 21 added; all 126 saved real runs still pass |
| `fa1364c` | Judge runs from an empty temp directory outside the home tree; the `diff` command line and timestamps are stripped from judge prompts; judge records keep per-call presentation order |
| `293bf06` | `template/.env.example` is now tracked (the `.env.*` ignore rule dropped it, so a clean checkout hashed to a different fixture than the one evaluated) |
| `8aabc38` | `--recheck` keeps the original checks and logs flips in `audit.jsonl`; `--resume` rejects changed arms, frozen flags and a changed fixture; smoke ports are allocated; ancestor agent config is reported as a warning. Most `run.mjs` paths were not exercised with a real agent run |
| `dcdb7ff` | Unverified draft of four harder hidden tests with reference and mutant patches (stream 7). Not wired into a task set |
| `2d7f207` | Strengthened hidden tests for B1–B5, B9–B11 and N1 |

## Still open, in priority order

1. **Agents run under the real home and share `/tmp`.** The suite now warns only. Move the results
   root outside the home (or use a mount namespace) and give each run a private `/tmp`. Correct the README.
2. **The decision rule.** Replace the floor-plus-sign-test rule with a task-level paired test that
   reports a CI and a minimum detectable effect, and say "cannot conclude" at one rep. Detecting 0.3
   needs about 8–10 tasks if effects are uniform and 25–29 with the task-to-task variation seen in
   the reproduction; extra reps barely help there.
3. **B6 and B8 hidden tests** still pass 4 and 6 wrong solutions. Proposed assertions are in the stream 1b section, unverified.
4. **B5 prompt against test.** Decide whether concurrent duplicates must get a 2xx. If yes, three of four saved solutions fail.
5. **B9** needs the delivery check made required; **B10** needs a check that a service layer exists; **N2** passes a two-line README.
6. **Ceiling effect.** Stream 7 is NOT DONE: no `ts-backend-hard` task set, no smoke run, and the draft tests are unverified.
7. **Vue checks** still accept 11 of 47 wrong solutions and no Vue task has a behavioural test.
8. **Re-measure** the ts-backend A/A noise floor: its judge read diffs that were about 75% snapshot JSON.
9. **Saved reports.** The original hidden tests and six original failures are unrecoverable. `--report-only` on the two Vue dirs
   switches the judge back to Opus unless `--judge-model claude-sonnet-5-5` is passed.
10. The README still describes ties, isolation and hidden-test history incorrectly; it was not updated.

## Notes on this audit

- "115 runs" is the 90 original MWG runs plus the 25 ts-backend runs. The four saved suite dirs hold 61.
- `--recheck` was not re-run on the saved result dirs: it rewrites them without a trail, which is one
  of the findings. Changed tests and checks were verified against copies of the saved solutions instead.
- Subagents symlinked the fixture cache's `node_modules` and Vitest left `.vite`, `.vitest-cache`
  and `.vite-temp` inside it; they were left in place. The suite now verifies a cached fixture and rebuilds it if modified (`8aabc38`), a path not yet exercised.
- No model calls were spent on agent runs. The temp-directory judge fix is therefore unconfirmed
  live: the first real judge run should show no `CLAUDE.md` attachment in its session log.

---

The sections below are the stream reports. Where one says a change is uncommitted or unverified, the tables above give the final state.


# Stream 1a: hidden tests B1–B4

NOT DONE: no written report. See the summary tables above.


# Stream 1b: hidden tests B5–B8

## Stream 1b: mutation test of ts-backend hidden tests B5-B8

Method: scratch copies in `/tmp/audit/stream1b/` (fixture cache `ts-backend-5fb139da4a97`, identical to the current template apart from `.env.example`; saved agent apps copied, shared `node_modules` copy). Each run copies the hidden test to `src/__hidden__/` and runs `vitest run src/__hidden__/<x>.test.ts` with `CI=1 NO_COLOR=1` (same as `runCommandCheck`). Mutants are hand-written wrong solutions, no agent runs. All mutants typecheck (`tsc --noEmit`).

Baseline (original hidden tests): untouched fixture FAILS all four; all 10 saved solutions PASS (4x B5, 4x B7 from `validation-ts-backend-aa`; B6, B8 from `-shakeout`).

### Kill rates

| Task | Mutants | Killed before | Killed after fix | Test changed |
|---|---|---|---|---|
| B5 webhook idempotency | 7 | 4/7 (57%) | 7/7 (100%) | yes |
| B6 login rate limit | 11 | 7/11 (64%) | NOT DONE (test not strengthened) | no |
| B7 tenant isolation | 5 | 5/5 (100%) | n/a | no |
| B8 structured errors | 11 | 5/11 (45%) | NOT DONE (test not strengthened) | no |

### B5-webhook-idempotency

| Mutant | What is wrong | Killed before | Killed after |
|---|---|---|---|
| M1-check-then-insert | SELECT event, apply credits, then INSERT (onConflictDoNothing), no transaction | Y (0/10 passes; credits 200 instead of 50) | Y (0/5) |
| M1b-check-then-insert-strict | same, plain INSERT (losers 500 on PK conflict after credits already applied) | Y (0/10) | Y (0/5) |
| M2-memory-set-instance | dedupe in a `Set` per `webhookRoutes(db)` instance, nothing persisted | **N** (5/5 pass) | Y |
| M2b-memory-set-module | dedupe in a module-level `Set` | **N** (5/5 pass) | Y |
| M3-apply-before-record | credits applied, then event recorded | Y | Y |
| M4-wrong-key | atomic, but keyed on `type:orgId:credits` instead of event id | **N** (3/3 pass) | Y |
| M5-duplicate-409 | duplicate answered with 409 | Y | Y |

Not built (not reachable through HTTP without fault injection, prompt does not state it): "event marked processed although applying failed"; "in-process mutex only, wrong across instances".

Test changes (`evals/fixtures/ts-backend/hidden/webhook-idempotency.test.ts`):
1. New test "applies a different event with an identical payload" (evt_d, evt_e same org and amount, evt_d retried, expect 100). Kills M4.
2. Concurrent test: after the burst, every non-2xx response must be 5xx and a sequential re-delivery of it must be 2xx, credits still 50. Kills no mutant in this set; restores "a repeated event still gets a 2xx" for the retry of a rejected delivery.
3. New test "does not apply a retry again after the server restarts": `vi.resetModules()`, re-import `../app`, `createApp({ db })` on the same database, re-deliver, expect 2xx and credits 50. Kills M2 and M2b. **Judgement call:** the prompt says "a repeated event must not be applied again" without mentioning restarts; I read that as unconditional (the task already has an info check "Persists processed events"). It also depends on the template's `createApp({ db })` signature. It is a separate `it`, easy to drop if the lead disagrees.

#### Webhook loosening verdict

- The test file has one commit (`9239bb8`), already in loosened form, so the loosening predates the first commit. Evidence it happened mid-run: `validation-ts-backend-aa.log` shows `B5__A__r1` (20:45) and `B5__B__r1` (20:46) with `checks=0/1`, then `B5__B__r2` (20:49) `checks=1/1` although B__r2 is the same design as the two failures. The saved `results/runs/B5*.json` now all say pass with empty detail (rechecked later), so the original failure text is gone. Original assertion inferred, not seen: all concurrent responses 2xx.
- Probe of the saved solutions under 2/4/8/16 concurrent duplicate deliveries (deterministic across sizes):

| Saved run | Design | Concurrent statuses (n=4) | Credits | After re-delivering the 500s |
|---|---|---|---|---|
| aa A__r1 | `db.transaction` + insert onConflictDoNothing | 200,500,500,500 (`SQLITE_BUSY: database is locked`) | 50 | 50, all 200 |
| aa B__r1 | same | 200,500,500,500 | 50 | 50 |
| aa B__r2 | same | 200,500,500,500 | 50 | 50 |
| aa A__r2 | `db.batch` with `changes() = 1` | 200,200,200,200 | 50 | 50 |

- Is the double-apply race reachable in-process on libSQL? Yes. M1 gives credits 100/200/400/800 for n=2/4/8/16, every time.
- Does the current (loosened) test still fail check-then-insert? Yes, 0/10 passes for M1 and M1b, both before and after my edit.
- Were the original failures real bugs? Real behaviour, not a test artefact: three of four saved solutions answer a concurrent duplicate with 500 and the error body leaks `SQLITE_BUSY`. It is not a double-apply, and a provider retry is then acknowledged. The prompt says nothing about concurrency, so I judge the loosening acceptable for a required check; it did not go too far on the core invariant.
- If the lead wants the strict reading ("every repeated event gets 2xx", including concurrent ones), runs **aa A__r1, B__r1, B__r2 would flip to fail** and A__r2 would pass. I did not make that change. Proposal: add it as a separate info-level check rather than in the required one (needs an edit to `evals/tasks/ts-backend.json`, not made).
- Procedural finding: the check changed between runs of the same A/A set, so r1 and r2 were first scored against different tests.

### B6-login-rate-limit (test NOT strengthened - NOT DONE)

| Mutant | What is wrong | Killed before |
|---|---|---|
| M1-never-expires | no window expiry, Retry-After constant 900 | **N** |
| M2-counts-successes | successful logins count as failures (6th good login locked) | **N** |
| M3-global-key | one counter for all emails | Y |
| M4-locks-after-4 | off by one, early | Y |
| M4b-locks-after-6 | off by one, late | Y |
| M5-no-retry-after | header missing | Y |
| M5b-retry-after-ms | header in milliseconds | Y |
| M6-case-sensitive-key | keyed on raw email, `Ada@acme.test` bypasses (login lowercases) | **N** |
| M7-known-users-only | unknown emails never limited | **N** |
| M8-correct-password-bypasses-lock | limiter consulted only after a failed password | Y |
| M9-limiter-per-request | state recreated per request | Y |

Proposed, not implemented or verified: (a) six correct logins in a row all 200 (M2); (b) five failures with mixed-case email, then 429 (M6); (c) six failures for an unknown email, sixth 429 (M7); (d) `vi.useFakeTimers({ toFake: ["Date"] })`, advance 15 min + 1 s, correct password gets 200 (M1). Caveat for (d): false-fails a valid solution that takes time from SQL rather than `Date.now()`.

### B7-tenant-isolation (test unchanged)

| Mutant | What is wrong | Killed before |
|---|---|---|
| M1-get-403 | 403 instead of 404 | Y |
| M2-admins-see-all | scoping skipped for admins | Y |
| M3-delete-then-check | GET fixed; DELETE deletes by id, then checks org | Y (own GET afterwards is 404) |
| M4-patch-unscoped-after-refactor | GET fixed; PATCH lookup lost its org filter | Y |
| M5-get-200-null | 200 `{task: null}` instead of 404 | Y |

Note: in the template only `GET /api/tasks/:id` is unscoped; PATCH and DELETE already filter by org, and all four saved solutions are the same one-line fix. The task is easy and the mutation surface small. Only globex-to-acme is tested, not the reverse; no plausible mutant found for that.

### B8-structured-errors (test NOT strengthened - NOT DONE)

| Mutant | What is wrong | Killed before |
|---|---|---|
| M1-unknown-route-plain-text | unknown route still "Not Found" text | Y |
| M2-validation-raw-dump | framework validation dump left | Y |
| M3-500-leaks-message | 500 message is the internal error message | Y |
| M10-500-leaks-in-details | 500 leaks via `details.cause` | Y |
| M8-validation-422 | validation status 422 | Y |
| M4-malformed-json-wrong-code | malformed JSON gets code `not_found`, not `validation_error` | **N** |
| M5-login-401-old-shape | login 401 still `{error: string}` | **N** |
| M6-blank-title-400-old-shape | PATCH blank title 400 still `{error: string}` | **N** |
| M7-task-404-old-shape | `GET /api/tasks/:id` 404 still `{error: string}` | **N** |
| M9-reopen-403-old-shape | PATCH reopen 403 still `{error: string}` | **N** |
| M11-project-tasks-404-plain-text | `GET /api/projects/:id/tasks` 404 plain text | **N** |

Cause: the test samples one route per status class, and the malformed-JSON test checks only `typeof code === "string"` and not the content type or the `validation_error` code the prompt requires. Proposed, not implemented or verified: use `expectError(response, 400, "validation_error")` for malformed JSON; add `expectError` calls for wrong-password login (401), PATCH `title: " "` (400 validation_error), GET/PATCH/DELETE `/api/tasks/nope` (404), GET/POST `/api/projects/nope/tasks` (404), member reopening `tsk_1` (403).

### Verification matrix

Edited `webhook-idempotency.test.ts` (the only hidden test changed), re-run at the end:

| Target | Result |
|---|---|
| untouched fixture | FAIL (all 4 tests fail) |
| aa B5 A__r1 | PASS 5/5 (10/10 across two rounds) |
| aa B5 A__r2 | PASS 5/5 (10/10) |
| aa B5 B__r1 | PASS 5/5 (10/10) |
| aa B5 B__r2 | PASS 5/5 (10/10) |
| B5 mutants M1, M1b, M2, M2b, M3, M4, M5 | FAIL 0/5 passes each |

No saved run flips to fail under the edited webhook test. The three runs that answer concurrent duplicates with 500 SQLITE_BUSY (A__r1, B__r1, B__r2) still pass, by design: the edited test accepts a 5xx on a concurrent duplicate provided its re-delivery is acknowledged and credits stay at 50.

`login-rate-limit`, `tenant-isolation` and `error-shape` hidden tests are byte-identical to the originals (`cmp`), so their baseline holds: fixture FAIL, saved B6 run PASS, 4 saved B7 runs PASS, saved B8 run PASS.

`npm run verify` after the edit: 82 pass, 0 fail.

### Artefacts

Mutant apps: `/tmp/audit/stream1b/m/<task>/<mutant>/`. Patches (diffs against the fixture): `/tmp/audit/stream1b/mutants/<task>/<mutant>.patch`. NOT copied into `evals/fixtures/ts-backend/mutants/`: the B5, B6 and B8 patches are 200-640 lines because they are built on full saved agent solutions (migration snapshots included); only the B7 patches (19-29 lines) and B5 M2/M2b (28-30 lines) are small. Regenerating the rest as minimal diffs is NOT DONE. Originals of the four hidden tests: `/tmp/audit/stream1b/hidden-orig/`.


# Stream 1c: hidden tests B9–N2

### Stream 1c: mutation test of ts-backend hidden tests (B9, B10, B11, N1) and N2 checks

Method: scratch apps in `/tmp/audit/stream1c/` (`base` = prepared fixture cache `ts-backend-be4e70ab2784`, `sol-<task>` = copy of the saved shakeout solution, `m/<mutant>` = hand-written wrong solution). Each hidden test was copied to `src/__hidden__/` and run with the exact check command (`vitest run src/__hidden__/<x>.test.ts`, `CI=1 NO_COLOR=1`, app `node_modules/.bin` on PATH). Raw results: `/tmp/audit/stream1c/results-before.txt` (original tests, saved as `hidden-orig/`) and `results-after.txt` (strengthened tests). Mutant patches: `/tmp/audit/stream1c/mutants/<task>/*.patch`.

#### Findings up front

1. **Each of B9, B10, B11, N1 has exactly one saved real solution** (`validation-ts-backend-shakeout`, arm A, r1); none in `validation-ts-backend-aa`. Every "passes real solutions" statement below rests on n=1. N2 has 4 saved runs (aa) and no hidden test.
2. **Original kill rates were low**: B9 required check 0/9 (info check 3/9), B10 1/11, B11 2/8, N1 1/4.
3. **B9 required check accepted "wrap the send in try/catch" and "delete the notification"**. Retry, backoff and the 5-attempt cap were not tested by any required check; the only delivery test is `level: info`.
4. **B10 "did nothing" passes the hidden test by design** and is rejected only by two static checks (`service-added`, `rules-moved`). A token refactor (move only the transition table constant to `src/services/task-rules.ts`, leave every rule in the route) passes ALL three checks. Still open.
5. **B11 hidden test can be passed with an error that names nothing**: Bun prints source lines around an uncaught `throw`, so `throw new Error("Invalid configuration")` placed below lines that read `process.env.PORT` etc. puts all three names in the output (mutant B11-m8, verified). Still open.

#### B9-background-notifications

Two test files: `background-notifications` (check `acceptance`, required) and `background-delivery` (check `delivery`, info).

| Mutant | What is wrong | Killed before (req / info) | Killed after (req / info) |
|---|---|---|---|
| m1-inline-try-catch | send still inline, error swallowed; no background job, no retry | N / Y | Y / Y |
| m2-fire-and-forget-no-retry | `void notify().catch()`; no retry | N / Y | N / Y |
| m3-notification-removed | notification deleted | N / Y | N / Y |
| m4-retry-no-backoff | 5 attempts, 0 ms delay | N / N | N / Y |
| m5-fixed-1s-delay | constant 1 s, not exponential | N / N | N / Y |
| m6-three-attempts | gives up after 3 | N / N | N / Y |
| m7-unlimited-retries | never gives up | N / N | N / Y |
| m8-sent-twice | immediate send plus queued job | N / N | N / Y |
| m9-backoff-100ms | backoff starts at 100 ms | N / N | N / Y |

Kill rate, required check: 0/9 before, 1/9 after. Either check: 3/9 before, 9/9 after.

Test changes:
- `hidden/background-notifications.test.ts`: added "answers before a slow mailer has finished" (transport takes 2 s; the 201/200 must arrive before it finishes).
- `hidden/background-delivery.test.ts`: added "sends exactly one email per assignment when the mailer works" and "backs off exponentially from about a second and gives up after 5 attempts" (always-failing transport: exactly 5 attempts, first wait 0.5-3 s, each wait > 1.15x the previous, no 6th attempt). The last test takes about 35 s (timeout 90 s; check timeout is 180 s).

Open: 8 of 9 mutants are only killed by the info-level check. I kept the retry/delivery assertions out of the required file because a valid design that starts its worker loop in `src/index.ts` (not in `createApp`) would never deliver under `createTestContext` and would fail for the wrong reason. If the lead accepts that risk, change in `evals/tasks/ts-backend.json`:

```json
{ "id": "delivery", "label": "Hidden test: delivered once, retried with backoff, 5 attempts", "type": "command", "copy": { "hidden/background-delivery.test.ts": "src/__hidden__/background-delivery.test.ts" }, "run": "vitest run src/__hidden__/background-delivery.test.ts", "expect": "pass", "level": "required", "timeoutSec": 180 }
```

Prompt under-specified: "up to 5 attempts" is read as 5 total (the saved solution does this); a solution doing 1 + 5 retries fails the new info test.

#### B10-task-service-layer

| Mutant | What is wrong | Killed before | Killed after |
|---|---|---|---|
| m0-no-refactor | untouched fixture | N (by design; fails static `service-added` + `rules-moved`) | N (same) |
| m1-token-refactor | only the transition table moved to `src/services/task-rules.ts` | N, passes all 3 checks | N, passes all 3 checks |
| m2-tenant-check-lost | org filter dropped from the task lookup | N | Y |
| m3-updatedAt-not-bumped | `updatedAt` no longer set | N | Y |
| m4-error-messages-changed | error bodies changed | N | Y |
| m5-done-with-assignee-in-same-patch | assign+done in one request now 409 | N | Y |
| m6-role-check-before-transition | 403 instead of 409 for member on impossible transition | N | Y |
| m7-done-rule-dropped | "assign before done" rule removed | Y | Y |
| m8-due-date-clear-rejected-on-done | `dueDate: null` on done task now 409 | N | Y |
| m9-fields-dropped | `isUrgent` no longer stored | N | Y |
| m10-renotify-same-assignee | emails on re-sending current assignee | N | Y |

Kill rate (hidden test): 1/11 before, 9/11 after. The two survivors cannot be killed by a behaviour test.

Test changes (`hidden/task-update-rules.test.ts`): four added tests pinning existing fixture behaviour: cross-org PATCH is 404 and leaves the task untouched; exact error bodies of all six rules; rule order and done-task edge cases; all fields stored, `updatedAt` bumped, one email, no email on same assignee.

Open (m1): `rules-moved` matches one literal formatting of one line. Proposed additional check (NOT verified against more than the one saved solution, whose route passes it by inspection):

```json
{ "id": "route-http-only", "label": "Route no longer updates tasks or notifies", "type": "pattern", "in": "final", "files": ["src/routes/tasks.ts"], "pattern": "notifyTaskAssigned|\\.update\\(tasks\\)|cannot be blank", "expect": "absent" }
```

#### B11-config-validation

| Mutant | What is wrong | Killed before | Killed after |
|---|---|---|---|
| m1-loglevel-unvalidated | bad LOG_LEVEL silently becomes info | N | Y |
| m2-database-url-default | DATABASE_URL keeps `file:data/dev.db` default | N | Y |
| m3-ttl-any-positive-number | accepts `0` and `1.5` | N | Y |
| m4-warn-only | prints the errors, starts anyway on 4000 | Y | Y |
| m5-first-error-only | reports only the first bad variable | Y | Y |
| m6-generic-usage-message | message lists all five names regardless | N | N |
| m7-port-default-3000 | wrong PORT default | N | N |
| m8-unnamed-error-source-dump | `Error("Invalid configuration")`; names appear only in Bun's source dump | N | N |

Kill rate: 2/8 before, 5/8 after.

Test changes (`hidden/config-validation.test.ts`): added six single-bad-variable startups (LOG_LEVEL=verbose, DATABASE_URL unset, WEBHOOK_SECRET unset, TOKEN_TTL_HOURS = 1.5 / 0 / soon), each must exit non-zero and name the variable; added "starts when only the required variables are set".

Open:
- m6, m8: need a negative assertion (a valid variable must not be named). Not added: an honest solution that throws uncaught gets the same Bun source dump and would fail for the wrong reason.
- m7: testing the default needs a server on fixed port 4000, which collides under concurrent runs. Not added.
- m4 is killed only because port 4000 was free; if something listens on 4000 the mutant exits non-zero and passes (NOT verified by running).
- `env-centralised` covers `src/routes|plugins|services` only; the template also reads `process.env` in `src/lib/logger.ts`, `src/index.ts` and `scripts/*.ts`, which the check ignores.
- Empty string for a required variable: prompt under-specified, not asserted.

#### N1-parse-duration

| Mutant | What is wrong | Killed before | Killed after |
|---|---|---|---|
| m1-wrong-day | day = 12 h | Y | Y |
| m2-lenient-number | `Number()` per part: accepts `1e3s`, `0x10s`, ignores trailing junk | N | Y |
| m3-bare-number-ms | `"5"` / `"1h30"` accepted as milliseconds | N | Y |
| m4-unanchored | sums every `<n><unit>` found, ignores the rest (`abc5m`, `5m!`) | N | Y |

Kill rate: 1/4 before, 4/4 after.

Test changes (`hidden/parse-duration.test.ts`): added `1d2h3m4s` and nine more invalid inputs (`5`, `5m10`, `1h30`, `abc5m`, `5m!`, `1h-30m`, `1e3s`, `0x10s`, `5 minutes`).

Prompt under-specified, deliberately not asserted: fractions (`1.5h`), upper case, surrounding whitespace, unit order (`30m1h`), repeated units, `0s`.

#### N2-readme (no hidden test)

Three static checks: `README.md` changed; nothing changed under `src/**`, `scripts/**`, `drizzle/**`, `package.json`; README contains the strings `/api/webhooks/billing` and `/api/auth/token`.

A README consisting of only those two strings passes every check. Nothing checks install/migrate/seed/start instructions, the environment variable list, or any other endpoint; only the judge can. `docs-only` does not cover `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `drizzle.config.ts`, `.env.example`, so config edits pass as "no code changes". NOT DONE: the four saved N2 READMEs were not read. Proposed check:

```json
{ "id": "readme-covers-setup-and-env", "label": "README covers setup commands and env vars", "type": "pattern", "in": "final", "files": ["README.md"], "pattern": "^(?=[\\s\\S]*bun install)(?=[\\s\\S]*migrate)(?=[\\s\\S]*seed)(?=[\\s\\S]*DATABASE_URL)(?=[\\s\\S]*WEBHOOK_SECRET)(?=[\\s\\S]*TOKEN_TTL_HOURS)(?=[\\s\\S]*LOG_LEVEL)(?=[\\s\\S]*/api/projects)", "expect": "present" }
```
(NOT verified against the saved READMEs.)

#### Verification matrix (strengthened tests)

| Test | Untouched fixture | Saved solution (shakeout A r1) |
|---|---|---|
| background-notifications | FAIL (as designed) | PASS |
| background-delivery | FAIL (as designed) | PASS |
| task-update-rules | PASS (as designed) | PASS |
| config-validation | FAIL (as designed) | PASS |
| parse-duration | FAIL (as designed) | PASS |

Each cell is one run; flakiness of the timing-based B9 backoff test was not measured (NOT DONE).

#### Mechanism robustness

- All four app-level tests import internals by path: `../services/mailer` (`setMailTransport`, `MailMessage`), `../test/helpers` (`createTestContext`, `SEED_TOKENS`), `../lib/duration`. A valid solution that renames or moves the mailer or the test helper fails at import. N1's path is given in the prompt; the others are not. `config-validation` only spawns `bun run src/index.ts`.
- The check runs the agent's own `vitest.config.ts`: its `include` and `setupFiles` apply, so an agent that narrows `include` makes the hidden test "no test files found" (fail), and an agent setup file runs before the hidden test. NOT verified by running.
- `runCommandCheck` (`evals/lib/measure.mjs:27-46`) removes only the files it copied; a `src/__hidden__` dir left by the agent is not cleared, but the command names one file, so other files there do not run.
- The template in the repo lacks `.env.example`, which all three prepared caches contain (`diff -rq`); not investigated.

#### NOT DONE

- Mutant patches were not copied into `evals/fixtures/ts-backend/mutants/`: most are built on the saved solution and are 260-390 line diffs against the template. All are in `/tmp/audit/stream1c/mutants/`.
- Mutants were not type-checked or linted.
- `npm run verify` passed (82/82) at 23:45 with the five edited test files in place.


# Stream 2: Vue task checks

### Stream 2: mutation test of the Vue task checks (`evals/tasks/vue-primevue.json`)

**Verdict.** Before this audit, "all checks passed" on the Vue fixture meant almost nothing beyond the four
fixture gates. 14 of 15 tasks accepted every wrong solution I constructed; a single app containing wrong
solutions for 7 tasks passed lint, typecheck, test and build and passed every required check of all 7. On the
126 saved real runs every required check passed 100% of the time, so the checks never separated one run from
another. After the fixes, 15 of 15 tasks reject at least one wrong-but-gate-passing solution, and all 126
real runs still pass. The checks remain token proxies: for 11 tasks I still have a wrong solution that passes.

#### Method and evidence

All numbers come from running the real `parseUnifiedDiff` / `evaluateChecks`. Scripts and outputs are in
`/tmp/audit/stream2/`.

| Script | What it does | Result |
|---|---|---|
| `replay.mjs` | Re-scores all saved real runs (16 `validation-aa-smoke`, 20 `validation-mwg-repro`, 90 `the original MWG eval directory`; the last needs its absolute diff paths rewritten to `a/` `b/`). All 126 are gate-passing per their run records. | Before: every required check 100% (see table below). After: every required check 100%. |
| `mutants.mjs` | 76 synthetic solutions over all 15 tasks: 47 wrong (W), 29 right (R). Run once with the original `checks.mjs` + task file (`git show HEAD:`), once with the fixed ones. | Before: 46/47 wrong accepted, 8/29 right rejected. After: 11/47 wrong accepted (all marked INHERENT), 1/29 right rejected (marked DEBATABLE). |
| `gatecheck.mjs` + `gateapp/` | A copy of the prepared fixture with 8 wrong solutions applied at once. I ran the four gates on it, then scored it. | All four gates exit 0. Before: 7 of 8 tasks ALL PASS. After: 8 of 8 REJECTED. |
| `features.mjs` | Comment sensitivity of `featurePatterns` on the 126 real runs; old vs new lib on the 25 saved ts-backend runs. | 14 of 277 matching added lines are comments; 1 run's feature is "used" only in a comment. ts-backend: 34 static check results, 0 changed. |
| `edge.mjs` | Edge cases of `in: "added"`, `changed` and the diff parser. | See "Mechanics" below. |

The mutants are existence proofs written against the checks, not a sample; 46/47 is not a rate. The "after"
numbers are scored against the same mutants I used to design the fixes, so they overstate the improvement.

The wrong solutions in `gateapp/` (gates pass; old required checks all pass):

| Task | Wrong solution | Old result | New result |
|---|---|---|---|
| L1 | `globalThis.confirm(message)` plus a `// TODO … useConfirm` comment | ALL PASS | REJECTED (3 checks fail) |
| L3 | `sortable` on the Customer column only, no filter | ALL PASS | REJECTED (`status-filter`) |
| L4 | `useToast().add()` with no `ToastService` and no `<Toast>` (throws at runtime), success only | ALL PASS | REJECTED (3 checks fail) |
| C5 | `@container` class added to the grid, `md:grid-cols-2 lg:grid-cols-3` kept | ALL PASS | REJECTED (both checks fail) |
| C7 | one comment naming `darkModeSelector`, `prefers-color-scheme`, `localStorage` | ALL PASS | REJECTED (4 checks fail) |
| F1 | static `aria-invalid="false"` and `aria-describedby` pointing at a hint, no validation | ALL PASS | REJECTED (`length-rule`) |
| F2 | hero gets `fetchpriority="high"` and dimensions but stays `loading="lazy"` | ALL PASS | REJECTED (`hero-not-lazy`) |
| N1 | `src/utils/notes.ts` + `notes.test.ts`, no parser | passes alone (`mutants.mjs`); in the combined app only `ui-untouched` fails, because other tasks' edits touch views | REJECTED (`exports-parser`, `tests-call-parser`) |

#### Real-run pass rates (required checks, original definitions)

| Task | Runs | Required checks | Pass rate |
|---|---|---|---|
| C5, F2, N1 | 14 each | 1, 2, 3 | 100% |
| L1, L2, F1 | 10 each | 3, 2, 2 | 100% |
| C1, C2, C3, C4, C6, C7, L3, L4, N2 | 6 each | 1 to 3 | 100% |

Info checks: `uses-primevue-popover` 0/6, `primevue-message` 4/10, `reduced-motion` 6/6.

One real run passed for the wrong reason. `mwg/C6-copy-button__A__r2` uses
`globalThis.navigator?.clipboard`, which `navigator\.clipboard` does not match. It passed `clipboard-api`
only because a comment on line 128 of its diff says "navigator.clipboard is undefined outside secure
contexts". The solution is correct and the check was too narrow.

#### Per-task findings

"Wrong accepted" and "right rejected" describe the original checks. Severity: High means the task had no
check on its goal or accepted a no-op; Med means a realistic wrong or right solution was misjudged.

| Task | Check | What it really tests | Wrong solution accepted (before) | Right solution rejected (before) | Sev. | Fix (before → after) |
|---|---|---|---|---|---|---|
| L1 | `primevue-confirm` | the string `useConfirm` or a PrimeVue dialog import path on any added line of any file | Y: `// TODO useConfirm`; unused import; string literal | N | High | comments stripped; added `confirm-rendered`: final `src/**/*.vue` has `<(ConfirmDialog\|ConfirmPopup\|Dialog)\b` |
| L1 | `no-window-confirm` | `window.confirm(` or bare `confirm('literal'` | Y: `confirm(message)` with a variable; `globalThis.confirm('…')` | Y: correct solution with comment "replaces window.confirm()" | Med | `window\.confirm\(\|(^\|[^\w.])confirm\(\s*['"\`]` → `\b(window\|globalThis\|self)\.confirm\(\|(^\|[^\w.])confirm\(`; comments stripped |
| L1 | `no-native-dialog` | `<dialog` or `showModal(` | N | N | Low | unchanged |
| L2 | `primevue-tabs` | import path string | Y: `// primevue/tabs` | N (`primevue/Tabs` capitalised fails, but that path is not valid) | High | comments stripped; added `tabs-rendered`: final `<(Tabs\|TabView)\b` |
| L2 | `settings-changed` | file touched | Y: blank line | N | Low | unchanged |
| L3 | `datatable-sortable` | word `sortable` anywhere in `DashboardView.vue`, including comments | Y: `<!-- sortable -->`; sortable on the wrong column | Y: table extracted to `OrdersTable.vue` | High | files → `src/**/*.vue`, comments stripped |
| L3 | (none) | filtering by status was not checked at all | Y: sort only | n/a | High | added `status-filter`: added line matches `[Ff]ilter` |
| L3 | `no-native-table` | `<table` | N | N | Low | unchanged |
| L4 | `primevue-toast` | `useToast` or import path string | Y: comment; `useToast()` with no `ToastService`/`<Toast>` (runtime error, gates pass); success toast only | N | High | comments stripped; added `toast-rendered` (final `<Toast\b`), `toast-service` (final `src/**/*.ts` has `ToastService`), `error-toast` (`severity: 'error'`) |
| L4 | `no-handrolled-toast` | `popover` attribute or `<dialog` | N | N | Low | unchanged |
| C1 | `users-ui-changed` | a file was touched; no behavioural check | Y: blank line; hover-only `title` tooltip | N | High | added `keyboard-trigger` (`focus\|tabindex`) and `card-fields` (`lastActiveAt`) |
| C1 | `uses-primevue-popover` (info) | import path | n/a | n/a (0/6 real runs use it; info is right) | Low | unchanged |
| C2 | `accordion-primitive` | `primevue/accordion` or `<details` | Y: comment; `<details>` without `name` (several open, the task's stated defect) | N | High | comments stripped; added `single-open`: `primevue/accordion\|(^\|[\s:])name=\|@toggle` |
| C3 | `transition-mechanism` | `<Transition` or View Transition token | Y: comment; bare `<Transition>` with no CSS (nothing animates) | N | Med | comments stripped; added `transition-styles` (enter/leave classes, `::view-transition`, `@keyframes`, `transition:`/`animation:`) |
| C3 | `reduced-motion` (info) | token | n/a | n/a | Low | unchanged; info is right, the prompt does not ask for it |
| C4 | `header-changed` | file touched; no behavioural check | Y: blank line; permanently small header | N | High | added `scroll-driven`: `[sS]croll\|IntersectionObserver` |
| C5 | `container-sized` | any of `@container`, `container-type`, `@md:`-style variant, `auto-fill/fit` | Y: comment; `@container` class with viewport `md:`/`lg:` columns kept; `container-type` on an unused class; string literal | Y (debatable): `ResizeObserver` solution | High | now needs an actual query or intrinsic grid: `@container\b[^\n{]*\(\|(^\|[\s"'\`])@(min-\|max-)?(3xs\|2xs\|xs\|sm\|md\|lg\|xl\|[2-7]xl\|\[[^\]]+\])(\/[\w-]+)?:\|auto-(fill\|fit)`; added `no-viewport-columns`: final `ProjectsView.vue` has no `(sm\|md\|lg\|xl\|2xl):grid-cols-` |
| C6 | `clipboard-api` | `navigator.clipboard` string | Y: comment; one of the two pages only | Y: `navigator?.clipboard` (real run) | Med | `navigator\??\.clipboard\|\.writeText\(`; added `changed` checks for `SettingsView.vue` and `UserDetailView.vue` |
| C6 | `no-execcommand` | `execCommand(` | N | N | Low | unchanged |
| C7 | `primevue-dark-selector` | the word `darkModeSelector` on an added line. The fixture already has `darkModeSelector: false`, so re-indenting that line passed | Y: comment; `'system'`; re-indent | N | High | `darkModeSelector:\s*(?!false\b\|['"\`]system['"\`])\S`; added `header-toggle` (AppHeader changed) |
| C7 | `system-preference` | `prefers-color-scheme` string | Y: comment, string | Y: VueUse `useDark()` / `usePreferredDark()` | Med | added `usePreferredDark\|usePreferredColorScheme\|useDark\(\|useColorMode\(` |
| C7 | `persists-choice` | `localStorage` string (case-sensitive) | Y: comment; written but never read | Y: `useLocalStorage`, `useStorage`, `useDark` | Med | added those alternatives; new info check `tailwind-dark-variant` (`@custom-variant dark`, 6/6 real) |
| F1 | `invalid-state` | `:invalid=` or `aria-invalid` | Y: static `aria-invalid="false"` | Y (rare): `v-bind:invalid=` | Med | `(:\|v-bind:)invalid=\|aria-invalid\|ariaInvalid` |
| F1 | `error-association` | `aria-describedby` or `aria-errormessage` | Y: pointing at a hint | N | Med | unchanged |
| F1 | (none) | the rules (2 to 50 chars, email) and "don't submit while invalid" were not checked | Y | n/a | High | added `length-rule`: `\b50\b`. Submit blocking still unchecked |
| F2 | `hero-priority` | literal `fetchpriority="high"` in `GalleryView.vue` | Y: comment; hero still `loading="lazy"`; on every image | Y: `:fetchpriority="…'high'"`; hero moved to a component | Med | files → `src/**/*.vue`, `index.html`; pattern `[fF]etch[pP]riority[^\n]{0,40}high`; added `hero-not-lazy` (absent) and `lazy-offscreen` (final has `loading="lazy"`) |
| F2 | `reserved-space` | width/height attribute or aspect-ratio | Y: comment | N | Low | comments stripped |
| N1 | `utils-changed`, `has-tests`, `ui-untouched` | file globs only; no check that `parseOrderQuery` exists or is tested | Y: unrelated util + empty test; wired into `App.vue` | N | High | added `exports-parser` (final `src/utils/**`) and `tests-call-parser` (added lines in `src/**/*.test.ts` match `parseOrderQuery\(`); `ui-untouched` now includes `src/App.vue` |
| N2 | `counts-by-role` | string in final `users.ts` | Y: in a comment | N | Med | comments stripped |
| N2 | `old-getters-gone` | names absent from all `src` files, comments included | Y: getters renamed | Y: comment "replaces adminCount…" | Med | comments stripped |
| N2 | `setup-store` | `defineStore('users', () =>` exactly | N | Y: `function` expression or named setup function | Med | `defineStore\(\s*['"\`]users['"\`]\s*,\s*[^{\s]` |

#### Still accepted after the fixes

Regexes cannot catch these. Each passes all required checks today (`mutants-after.md`).

| Task | Wrong solution still accepted |
|---|---|
| L1 | `<Dialog :visible="false">` rendered, delete still immediate |
| L2 | `<Tabs>` with one tab |
| L3 | `sortable` on the wrong column plus an unrelated `.filter()` |
| C1 | focus handler and `lastActiveAt` printed, no card |
| C2 | `<Accordion multiple>` |
| C6 | copies in both views, no "copied" feedback |
| C7 | `localStorage` written, never read |
| F1 | errors shown, submit not blocked |
| F2 | `fetchpriority="high"` on every image |
| N1 | parser returns a constant; test asserts `toBeDefined()` |
| N2 | `countsByRole` returns `{}` |

One right solution is still rejected: C5 done with a `ResizeObserver`. I left it, since the task is aimed at
CSS container sizing.

#### Mechanics (`edge.mjs`, verified by running)

- `in: "added"` with no `files` scans every changed file. A token in `README.md` prose passes
  `primevue-toast`; a token only in a test file passes `clipboard-api`.
- A pre-existing line that is re-indented counts as added. This is why the old C7 check passed on
  `darkModeSelector: false`.
- A deleted file counts as "changed", so deleting `AppHeader.vue` passes `header-changed` (the gates would
  fail it).
- `parseUnifiedDiff` does not count a removed line whose text starts with `--` (for example a CSS custom
  property at column 0), and treats an added line whose text starts with `++ b/…` as a new file header.
  Both are cosmetic and NOT FIXED.
- Patterns are case-sensitive and compiled with the `m` flag only. No regex in the file was malformed.
- `featurePatterns` is counted on raw added lines, so comments count. On real runs the effect is small (14 of
  277 matching lines, 1 of 126 runs flips). NOT FIXED in `measure.mjs`, which I do not own;
  `parseUnifiedDiff` now returns `code` (comment-stripped added lines) if the lead wants to pass that instead
  of `diff.added`. Other loose patterns, NOT FIXED: `commandfor` (`\bcommand=` matches `data-command=` and
  PrimeVue `:command=`), `imgDimensions` (`:width=` on any component), `lazyLoading` (double quotes only),
  `containerQueries` (misses `@min-`/`@max-` variants).
- `info` vs `required` is used sensibly: the three info checks are style preferences the prompt does not ask
  for.

#### Changes made

| File | Change |
|---|---|
| `evals/lib/checks.mjs` | New exported `stripComments`. `parseUnifiedDiff` adds `code` per file and overall: added lines with `//`, `/* */` and `<!-- -->` blanked, using hunk context lines for state. `evaluateChecks` matches pattern checks against comment-stripped text for both `added` and `final`; `"comments": true` on a check restores raw matching. `added`, `addedLines` and `countFeatures` are unchanged. |
| `evals/tasks/vue-primevue.json` | 11 existing checks tightened or widened and 21 checks added, as in the table. `featurePatterns.clipboardApi` now matches `navigator?.clipboard`. |
| `tests/evals.test.mjs` | Two tests: `stripComments` (keeps `https://`, `"//cdn"`, `'src/**/*.test.ts'`), and pattern checks ignoring comments unless opted in. |

`npm run verify` passes (82 tests). The comment stripper is a heuristic, not a parser: a line starting with
`*` is treated as a block-comment body, and `//` or `/*` only count after whitespace or one of `;{}(),>`.

#### Not done

- `evals/README.md` does not yet document comment stripping or the `comments` option (not my file).
- No hidden acceptance test for N1 or any Vue task. The Vue fixture has no `hidden/` directory, and the N1
  prompt fixes neither the file name nor the result shape, so a behavioural test needs a prompt change or a
  shape-agnostic test. This is the largest remaining gap.
- The saved run records were not re-scored (`--recheck` is the lead's step). Expect the same pass/fail for
  every saved Vue run, with more checks per task.
- Mutants were run through the gates for 8 tasks only (`gateapp/`). The comment-only and blank-line mutants
  for the other 7 tasks were not gate-run; they change no code.


# Stream 3: checks changed after failures

### Stream 3: checks and hidden tests edited after seeing results

Read-only on the repo. Evidence: git history of `feat/eval-suite` (19ec393, 364efd2, 9239bb8, d65b15d), the four
saved eval dirs and their `.log` files, file mtimes, the fixture cache hashes, and re-execution of hidden tests
against **copies** of the saved apps in `/tmp/audit/stream3/` (nothing under `~/agent-config-evals` was written).

#### Headline

- **7 of the 61 saved runs originally failed a required check.** 6 of them (all in `validation-ts-backend-aa`)
  were turned into passes by editing two hidden tests and running `--recheck` 35 s after the eval ended. The 7th
  (`validation-mwg-repro` C5 arm B r1) still shows as a failure in the saved data; it passes only under the
  widened check that was committed 5.5 min after the failure.
- The original (stricter) text of the two hidden tests is **not recoverable**: it was never committed, the
  fixture cache stores only `template/` (not `hidden/`), and `--recheck` overwrote the per-run result files
  including the failure `detail`. I reconstructed the likely originals by re-running stricter variants.
- The **webhook concurrency loosening is tuning toward a pass**: the committed test now accepts HTTP 500 for 3 of
  4 concurrent deliveries of the same event, which is what 3 of the 4 saved solutions return, although the prompt
  says a repeated event "should still get a 2xx".
- One undisclosed post-result change: `*_snapshot.json` was added to the ts-backend `diffExclude` **after** the
  ts-backend A/A run, so that eval's judge (and its noise floor) read diffs that were ~75% drizzle snapshot JSON,
  unlike every later run.
- The 9 shakeout tasks' hidden tests were **not** edited after the shakeout (proved by fixture hash).
- No sign that the recommendation thresholds were fitted to the saved verdicts.
- "115 runs": I could not find this number anywhere in the repo, logs or reports. The four saved dirs hold
  16 + 20 + 16 + 9 = **61** runs. NOT VERIFIED where 115 comes from.

#### Table

| # | Item | Before → after | Trigger (run, failure) | Verdict | Confidence |
|---|---|---|---|---|---|
| 1 | `vue-primevue.json` C5 check | id `container-queries`, "Uses container queries", pattern `@container\|container-type\|…@(xs…7xl):` → id `container-sized`, pattern adds `\|auto-(fill\|fit)` | `validation-mwg-repro` `C5-container-card-grid__B__r1`, 16:45:34, `checks=0/1`; edit committed in 19ec393 at 16:51:07 | **Legitimate correction** (but see caveats) | High on provenance, medium on verdict |
| 2 | `hidden/pagination.test.ts` "honours limit and caps it" | Reconstructed: `?limit=500` had to return 200 with ≤100 items (clamp) → now also accepts any 4xx | `validation-ts-backend-aa` B2 A r1, A r2, B r1, B r2: all `checks=1/2` at 20:49–20:53; recheck at 20:55:26–30 | **Legitimate correction** | Before-text: medium (reconstructed). Verdict: high |
| 3 | `hidden/webhook-idempotency.test.ts` "applies concurrent deliveries…" | Reconstructed: every one of 4 concurrent responses 2xx → now `responses.some(2xx)` plus credits applied once; comment added justifying it | `validation-ts-backend-aa` B5 A r1 and B r1: `checks=0/1` at 20:45–20:46; recheck at 20:55:31–35 | **Tuning toward a pass** (defensible, but weakens the stated contract) | Before-text: medium-low. Verdict: medium-high |
| 4 | `fixtures/ts-backend/fixture.json` `diffExclude` | no `*_snapshot.json` → `*_snapshot.json` excluded from diffs | ts-backend A/A judge inputs (README: snapshots were "about 60% of every migration diff the judge had to read") | **Legitimate change, but the A/A noise floor was not re-measured** | High that it happened after the A/A run; medium on exact timing |
| 5 | Default judge model | `claude-opus-5-5` → `claude-sonnet-5-5` | Re-judging both vue evals at 20:40 | **Disclosed, not tuning**; verdicts unchanged | High |
| 6 | Vue fixture `src/services/api.ts` | `apiKey: 'acme_live_4f9c2b7e81d04a6f'` → `'acme_demo_key_not_a_secret'` | none (secret hygiene before commit) | Not a check change. All 36 vue runs used the pre-edit fixture (`vue-primevue-136626e6e3ab`); the committed one hashes to `4af76c57bad9` | High |
| 7 | 9 shakeout tasks' hidden tests and checks | no change | n/a | **Clean**: all 9 passed first time against the committed tests | High |
| 8 | Recommendation thresholds (`aggregate.mjs` `recommend`) | unchanged since 19ec393 | n/a | **No fitting detected**; thresholds are uncalibrated round numbers | High |
| 9 | Checks demoted to `info`, tasks dropped, `expect` flipped, judge prompt edited | none found in git or between saved `taskset.json` and committed tasks | n/a | Clean as far as evidence exists (see limits) | Medium |

#### Runs turned from fail to pass

| Eval dir | Runs | Originally failing a required check | Now in saved results | How |
|---|---|---|---|---|
| `validation-aa-smoke` | 16 | 0 | 0 failing | never rechecked (result mtimes = run times) |
| `validation-mwg-repro` | 20 | 1: `C5-container-card-grid__B__r1` | **still 1 failing** (`container-queries` required, pass=false) | never rechecked; saved `taskset.json` and `REPORT.md` line 125 still carry the old check |
| `validation-ts-backend-aa` | 16 | 6: `B2-task-pagination__{A,B}__r{1,2}` (4), `B5-webhook-idempotency__A__r1`, `B5-webhook-idempotency__B__r1` | 0 failing | `--recheck` rewrote all 16 result files at 20:55:26–20:55:39 |
| `validation-ts-backend-shakeout` | 9 | 0 | 0 failing | never rechecked |
| **Total** | **61** | **7** | 1 | |

So "every run passed every hidden test" is true only after the two test edits; before them the ts-backend A/A
required-check pass rate was 26/32 (sum of the logged `checks=n/m`), with the B2 hidden test failing 4/4 and B5 2/4.

No gate failed in any of the 61 runs (`gatesPass: true` everywhere; gates are not re-run by `--recheck`).

#### Evidence

**Item 1, C5.** Saved `validation-mwg-repro/taskset.json` (written 16:43:58) versus the committed task set:

```
<  "id": "container-queries", "label": "Uses container queries",
<  "pattern": "@container|container-type|(^|[\\s\"'`])@(xs|sm|md|lg|xl|[2-7]xl):",
>  "id": "container-sized", "label": "Sizes columns from the container (container queries or an intrinsic auto-fill/auto-fit grid)",
>  "pattern": "@container|container-type|(^|[\\s\"'`])@(xs|sm|md|lg|xl|[2-7]xl):|auto-(fill|fit)",
```

Log: `[16:45:34] done C5-container-card-grid__B__r1 ok 1.5min $0.61 gates=pass checks=0/1 fired=modern-web`.
The failing diff replaced `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with
`grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))]`. That does satisfy the prompt ("adapt to the space it
actually has rather than to the window width"), so the old check rejected a valid answer. The edit is in 19ec393
(16:51:07) although the commit message that mentions it is 364efd2.

Caveats:
- The failing run was **arm B** (modern-web-guidance), the arm under test. The widening removes the only
  required-check difference between arms in the MWG reproduction (B 95% → 100%).
- `auto-(fill|fit)` is a bare substring over all added lines. It no longer tests that the old viewport
  breakpoints were removed, so the check has little discriminating power.
- The original MWG eval (`the original MWG eval directory/scripts/measure.mjs`) had **no pass/fail checks at all**, only
  feature counts (`containerQueries: /@container|container-type|container-name|\bcq[iw]\b|…@(3xs|2xs|…|\[[^\]]+\]):/`).
  Every check in `vue-primevue.json` is new in the port; the C5 check was a narrower copy of that feature regex
  (it drops `container-name`, `cqi/cqw`, `@3xs/@2xs` and arbitrary `@[…]:` variants, which are still not
  accepted). The prompt is byte-identical to `mwg-eval/tasks/C5-container-card-grid.txt`. In the original, both
  arms used `@container` in 3/3 runs.

**Items 2 and 3, provenance.** `validation-ts-backend-aa.log`:

```
[20:45:26] done  B5-webhook-idempotency__A__r1 ... checks=0/1
[20:46:53] done  B5-webhook-idempotency__B__r1 ... checks=0/1
[20:49:08] done  B2-task-pagination__A__r1 ... checks=1/2
[20:49:30] done  B2-task-pagination__B__r1 ... checks=1/2
[20:53:10] done  B2-task-pagination__B__r2 ... checks=1/2
[20:53:11] done  B2-task-pagination__A__r2 ... checks=1/2
[20:54:50] Verdict: A/A control.
```

All 16 `results/runs/*.json` have mtimes 20:55:26–20:55:39, `taskset.json` and `REPORT.md` 20:55:39, and a new
fixture cache `ts-backend-be4e70ab2784` was prepared at 20:55:25 (the eval itself used `ts-backend-7a051a8db6e9`,
prepared 20:43:37). The commit followed at 20:56:15. No recheck log was kept (the `.rejudge.log` files exist only
for the vue evals), so the mtimes are the only trace. The saved results now show 0 failures and empty `detail`.

Fixture hashes cover `fixture.json`, `hidden/` and `template/`, but the cache holds only `template/`, and the three
ts-backend cache dirs have identical template contents. So the edits were in `hidden/` and/or `fixture.json`.
The committed tree plus the untracked `template/.env.example` hashes to `5fb139da4a97` (the shakeout's cache);
neither `7a051a8db6e9` nor `be4e70ab2784` matches any variant I tried, so both earlier states are unrecoverable.

**Item 2, pagination (reconstruction).** All four saved B2 apps answer `GET …/tasks?limit=500` with
`422 "Expected integer to be less or equal to 100"` (TypeBox `maximum: 100`). Re-run on copies of the saved apps:

| Test variant | A r1 | A r2 | B r1 | B r2 |
|---|---|---|---|---|
| committed `pagination.test.ts` | pass | pass | pass | pass (failed once with 5 s test timeouts while the VM load average was 9; passed on rerun) |
| strict variant: `expect(huge.status).toBe(200)` and ≤100 items | fail (`expected 422 to be 200`) | fail | fail | fail |

The strict variant reproduces the logged 4/4 failure, so the original almost certainly required clamping. The
prompt says only "?limit, default 20, max 100"; it does not say whether an over-limit request is clamped or
rejected. Accepting either is a correction of an over-specified test. The current test still requires
`limit=5` → 5 items with a non-null cursor, 3 pages of ≤20, exact order and both filters.
Side note: the hidden tests use Vitest's default 5 s timeout, so `acceptance` is load-sensitive (one spurious
failure observed here under parallel audit load).

**Item 3, webhook concurrency (reconstruction).** Status of the 4 concurrent deliveries of `evt_c`, three
repetitions per saved app (identical each time):

| Saved run | Concurrent responses | Original log | Committed test | Strict variant (`every` 2xx) |
|---|---|---|---|---|
| A r1 | 200, 500, 500, 500 (`SQLITE_BUSY: database is locked`) | 0/1 | pass | fail |
| B r1 | 200, 500, 500, 500 | 0/1 | pass | fail |
| B r2 | 200, 500, 500, 500 | 1/1 | pass | fail (3/3 reruns) |
| A r2 | 200, 200, 200, 200 | 1/1 | pass | pass |

The strict variant explains A r1 and B r1 but not B r2, which originally passed, so the original was not exactly
"every response 2xx" (or B r2 is timing-dependent). Treat the before-text as approximate.

Why this is tuning rather than correction:
- The prompt: "a repeated event must not be applied again, but **should still get a 2xx response so the provider
  stops retrying**". Three of four solutions answer a duplicate with HTTP 500 and a leaked driver error string.
- The committed test's own comment states the rationale ("SQLite may reject some concurrent writers (SQLITE_BUSY)
  and the provider will retry those, so only the invariant is required"). That argument was written after the
  failures and redefines the contract to what the failing solutions do.
- It is not a fixture limitation: the untouched fixture returns 200 to all 4 concurrent requests (credits end at
  200, i.e. applied 4 times), and A r2 solved it properly (its code comment: "runs without yielding, so overlapping
  retries cannot hit SQLITE_BUSY"). The 500s come from the agents' `db.transaction` + insert approach.
- The check label still reads "Hidden idempotency tests pass (sequential and concurrent)".

In its defence: the credits-applied-once invariant is still enforced, the sequential retry must still be 2xx, and
the prompt never mentions concurrency. A fairer fix would have been to keep the strict assertion as an `info`
check, since it separates A r2 from the other three and is exactly the kind of signal the eval exists to find.

**Item 4, snapshot exclusion.** `grep -l _snapshot.json` matches the A/A diffs but none of the shakeout diffs,
although shakeout apps do contain `drizzle/meta/0001_snapshot.json`:

```
validation-ts-backend-aa/runs/B5-webhook-idempotency__A__r1/diff.patch:12:+++ b/drizzle/meta/0001_snapshot.json
   (lines 12–479 of a 629-line patch)
validation-ts-backend-shakeout/runs/B1-task-comments__A__r1/diff.patch: 0001_task_comments.sql, _journal.json, src/… (no snapshot)
```

So `"*_snapshot.json"` entered `fixture.json` between the end of the A/A run (20:54:50) and commit 9239bb8
(20:56:15). The README mentions the exclusion but not that the only judged ts-backend eval predates it. The
ts-backend A/A noise floor (0.20, 8 pairs) therefore describes a judge reading different input than future evals.

**Item 5, judge.** `lib/judge.mjs` is unchanged since 19ec393 (prompt not edited). The default model moved to
Sonnet after re-judging (README table). Sonnet's noise floor on the MWG controls is 0.24 vs Opus 0.14 (README table), so
the switch made the floor harder to beat on that eval. The verdict does not depend on it: Sonnet gives B 5 / A 5 / 0 ties
(p = 1.00), Opus gave B 5 / A 4 / 1 tie in the original log and the same "don't adopt (no measurable benefit)".
The Opus mean B−A was not recomputed here (NOT VERIFIED).

**Item 7, shakeout.** `validation-ts-backend-shakeout/taskset.json` equals the committed `ts-backend.json`; the
result files' mtimes equal the run-completion times (no recheck); the cache `ts-backend-5fb139da4a97` created at
22:25:44 equals the tree committed at 20:56:15 plus `.env.example`. The hidden tests were committed 89 min before
the shakeout and all 9 tasks passed 20/20 required checks first time. The tolerant assertions in those tests
(`comments.test.ts:25-26` and `priority-migration.test.ts:48-49` accept any 4xx) were written before any run of
those tasks, presumably applying the pagination lesson.

**Item 8, thresholds.** `recommend()` is byte-identical from 19ec393 (16:51, before any judged result existed:
first judging finished 16:57) to d65b15d. Magic numbers: sign test p < 0.1, pairs ≥ 4, gate drop > 0.05,
required-check drop > 0.1, cost > +10%, notable-diff cut-offs 0.5 and 0.4. The one non-A/A verdict is insensitive
to all of them: B 5 wins / A 5 / 0 ties, p = 1.00, mean B−A −0.17 against a floor of 0.24, cost +54%. No threshold
in a plausible range flips "don't adopt (no measurable benefit)". Two observations that are design weaknesses, not
fitting:
- The required-check regression threshold (0.1) is coarser than the observed effect: B's 95% vs A's 100% in
  `mwg-repro` was not flagged as a regression.
- `beyondNoise` compares |mean of signed B−A diffs| with the mean of |per-pair control diffs|. These are different
  statistics; the test is conservative and gets more so with more pairs.

**README claim "on the untouched fixture, `task-update-rules` passes and every other hidden test fails for the
reason its task targets": VERIFIED.** Ran all 13 committed hidden tests on a copy of the pristine cache:
12 files failed, 1 passed (`task-update-rules`), 19 tests failed / 4 passed. Failure reasons match the tasks:
comments 404, pagination 46 items, webhook credits 125 (sequential) and 200 (concurrent), query count 45 > 4,
tenant isolation 200 instead of 404, rate limit 401 instead of 429, error shape 422/non-JSON, priority column
missing, config output lacks variable names, mailer-down 500, `../lib/duration` missing. The 3 other passing
tests are sub-cases inside failing files (login-rate-limit 1 of 2, config-validation 1 of 2).

#### Other findings from this stream

- **`template/.env.example` is not in git.** The repo `.gitignore` has `.env.*`, so
  `evals/fixtures/ts-backend/template/.env.example` (5 lines: PORT, DATABASE_URL, WEBHOOK_SECRET, TOKEN_TTL_HOURS,
  LOG_LEVEL) exists only in the builder's worktree and in all three cache dirs. A clean checkout hashes to
  `d5334d23b653`, not the evaluated `5fb139da4a97`, and gives agents a fixture without that file. The saved
  ts-backend runs are therefore not reproducible from the commit.
- `--recheck` overwrites result files in place and keeps no record of the previous check results, and
  `taskset.json` is replaced. After a recheck there is no way to see what a run originally scored except the
  console log. The README does not document `--recheck` beyond `--help`.
- The README "Limits" section does disclose that hidden tests pin a contract and may reject valid solutions, but
  nothing in the README or commit messages says that two hidden tests were loosened after 6 failures or that the
  A/A results were re-scored. Commit 9239bb8 only says "`--recheck` re-scores saved runs against edited checks".

#### Limits of this stream / NOT DONE

- Original text of the two hidden tests: reconstructed, not recovered. Other hidden tests or `fixture.json`
  fields may also have changed between hashes `7a051a8db6e9` → `be4e70ab2784` → `5fb139da4a97`; only the
  snapshot exclusion and the two test edits are evidenced. In particular I cannot rule out edits to
  `tenant-isolation.test.ts` (it passed 4/4 before and after).
- Edits made before the first saved `taskset.json` (vue, 16:43) or before the first ts-backend run (20:43) are
  invisible: everything was developed uncommitted, and earlier result dirs may have been deleted. Only two
  vue cache hashes and three ts-backend hashes exist, which argues against many earlier fixture iterations
  reaching a real run, but task JSON edits do not change the fixture hash.
- Builder session transcript: not looked for beyond noting that `~/.claude/projects` has no directory for the
  `feat-eval-suite` worktree (directory names listed only, nothing read).
- "115 runs" claim: source not found.
- Whether the loosened tests are now too weak technically (mutation testing) is left to stream1a/1b.


# Stream 4: judge validity

### Stream 4: judge validity (blinding, position bias, noise floor, power)

Scripts (Node, seeded, read-only on the saved evals): `/tmp/audit/stream4/extract.mjs` (rebuilds every
individual judge call from `judge-home/.claude/projects/*/*.jsonl`), `blind.mjs`, `ts.mjs`, `stats.mjs`,
`power.mjs`. Data: 54 pair records and 108 individual judge calls in the three judged suite evals, plus the
45 single-verdict judgments of the original MWG eval. All 54 saved pair records were rebuilt exactly from
the session logs (54 identical, 0 different), so the per-call numbers below are the real inputs and outputs.

#### Summary

| Item | Verdict |
|---|---|
| Arm leaks in the diffs shown to the judge | **None found.** No policy/skill names, env vars, arm or home paths, or `CLAUDE` in any of the 61 suite diffs. Harness markers and timestamps were shown symmetrically (fixed). |
| Judge isolation | **Hole (fixed, not verified live):** all 108 judge calls loaded the live `~/.claude/CLAUDE.md`. No tools were offered or used. |
| Slot assignment | Balanced. Not correlated with arm. |
| Position bias | **Not detectable.** Slot 1 share of decisive calls 0.53 [0.44, 0.62], n=153. |
| Tie rule | README is wrong: one vote plus one tie is recorded as a win (8 of 54 records). Position flips are rare (2 of 54). |
| Noise floor | Sonnet 0.19, 95% CI [0.11, 0.26] (21 A/A pairs). The n=8 figure in the README (0.14) has CI [0.05, 0.23]. |
| A/A decisive rate | Sonnet 71% [50, 86], Opus 54% [29, 77]. A single pair verdict is close to a coin flip between identical arms. |
| Decision rule | **Cannot return a positive at `--reps 1` or `--smoke`**, ever. Capped at about the floor (~0.19) at any sample size. Miscalibrated when effects vary by task. |
| Sign test | Implementation correct (two-sided exact, ties dropped). Needs 5 decisive pairs, all one way. |
| Judge sets | Never mixed. README Sonnet-vs-Opus table reproduces exactly. |

#### 1. Blinding

**What the judge receives** (`evals/lib/providers/claude.mjs` `ask`, `evals/run.mjs:247-281`):
`claude -p --model <m> --tools '' --output-format json --strict-mcp-config`, prompt on stdin,
`CLAUDE_CONFIG_DIR=<out>/judge-home/.claude`, `HOME=<out>/judge-home`, cwd `<out>/judge-home`.
The prompt is task text + `judgeContext` + two diffs (`evals/lib/judge.mjs` `buildJudgePrompt`).

Verified from the 108 saved judge sessions:

| Check | Result |
|---|---|
| Tools offered in the API request | 0 in 108/108 sessions |
| `tool_use` blocks in judge replies | 0 |
| Instruction files loaded | **`~/.claude/CLAUDE.md` (type `Project`, 144 chars) in 108/108** |
| cwd shown to the model | `.../validation-mwg-repro/judge-home` (names the eval, not the arm) |

The live `~/.claude/CLAUDE.md` leak happens because the judge's cwd sits under the user's home, and Claude
Code reads `<ancestor>/.claude/CLAUDE.md` as project memory. Here the file is only an `@import` stub and
the import was not expanded (0 hits for the imported text), so the judge saw one line naming
`~/.agents/AGENTS.md` and nothing else. With a live CLAUDE.md that has real content, the judge would be
instructed by the user's live policy. The same file is loaded by the **arm agents** too (10/10 sessions
in each arm of mwg-repro, alongside the arm's own files). Arm agents have tools; I checked all 61 run
transcripts and none read anything under the live `~/.agents` or `~/.claude`. That is stream5's area and
is not fixed here.

**Arm tells in the diffs** (`blind.mjs`, every saved `diff.patch`):

| Pattern | aa-smoke (16) | mwg-repro (20) | ts-backend-aa (16) | ts-shakeout (9) | MWG original (90) |
|---|---|---|---|---|---|
| Policy or skill names (`modern-web`, `manual-qa`, `AGENTS.md`, `.agents`, `policy/`, `SKILL.md`) | 0 | 0 | 0 | 0 | 0 |
| `DISABLE_TELEMETRY`, `CLAUDE_CONFIG_DIR`, `AGENT_BROWSER` | 0 | 0 | 0 | 0 | 0 |
| `CLAUDE` / `claude` | 0 | 0 | 0 | 0 | 0 |
| Arm or home paths, run ids (`__A__`) | 0 | 0 | 0 | 0 | 90 on disk, replaced with `a`/`b` before judging (`scripts/judge.mjs:26`); no saved prompts to confirm |
| Agent artefact files (screenshots, notes, QA logs, `.agent-browser`) | 0 | 0 | 0 | 0 | 0 |
| `.eval-ready` / `.eval-manifest` in the `diff -ruN --exclude=...` header | 16 | 20 | 16 | 9 | 0 |
| File timestamps in `---`/`+++` headers | 16 | 20 | 16 | 9 | 90 |
| Pairs with a hard tell in exactly one arm | 0/8 | 0/10 | 0/8 | n/a | 0/45 |

The header line repeated for every file was, for example:
`diff -ruN '--exclude=node_modules' ... '--exclude=.eval-ready' '--exclude=.eval-manifest.json' a/src/x b/src/x`.
It tells the judge it is inside an eval harness and made up 11.4% of all diff characters. The `+++`
timestamps show when each run edited each file. Neither identifies the arm directly. Timing is a weak
side channel: B's last edit was later than A's in 7/10 (mwg-repro) and 24/45 (original) pairs; B's
first-to-last edit span was longer in 4 vs 2 of 10, and 16 vs 9 of 45.

**Style tells** (soft):

| Eval | Mean diff chars A / B | B longer | Comment lines A / B | "Baseline", "widely available", `@supports`, MDN/caniuse cites | Modern-feature tokens in only one arm |
|---|---|---|---|---|---|
| mwg-repro | 5339 / 6198 | 5/10 | 4.0 / 4.7 | 0 / 0 | A 1, B 0 of 10 |
| MWG original | 6479 / 6990 | 28/45 | 2.6 / 4.2 | 0 / 0 | A 0, B 3 of 45 |

The judge could not tell which patch used the guidance: no diff cites it, and the style differences are
small and inconsistent. B writes somewhat more comments and slightly longer diffs.

**Does the rubric reward the guidance?** Partly aligned with arm B by construction. The vue-primevue
`judgeContext` says "Browser support target: Baseline Widely Available", and `policy/modern-web.md:43` on
the B branch says "Default to Baseline Widely Available". The "platform" dimension scores "modern platform
features with suitable support or fallbacks for the stated target". The rubric uses the vocabulary of the
policy under test. Any bias from this favours B, and B still did not win, so it does not undermine the
"no benefit" finding. It would matter for a positive result.

**Rubric dilution.** "Overall" is the unweighted mean of five dimensions, two of which default to 3:

| Eval | accessibility equal on both patches | platform equal | 
|---|---|---|
| ts-backend-aa (16 calls) | 16/16 (all 3 vs 3) | 14/16 |
| aa-smoke (32 calls) | 32/32 | 22/32 |
| mwg-repro (60 calls) | 48/60 | 45/60 |

On backend tasks 40% of the overall score is a constant, so a real 1-point correctness difference appears
as 0.2 overall. Thresholds stated in "overall" points (0.3, the floor) mean different things per fixture.

**Slot order** (`judgePair`, `judge.mjs`): first order is `Math.random() < 0.5`, then alternates; retries
reuse the same order. Measured: both orders used in 54/54 pairs; arm A in slot 1 in exactly 20/40 A/B calls
of mwg-repro. With an odd `--judge-reps` one order gets one extra call, chosen at random per pair, so it
stays uncorrelated with arm. MWG original used one random order per pair: A in slot 1 in 26/45 (p=0.37).
Not seeded, so not reproducible, but unbiased.

**Other limits.** Binary changes reach the judge as `Binary files a/... and b/... differ` (F2 image tasks),
so the judge cannot assess the image work. No saved diff exceeds the 60,000-character truncation limit.

#### 2. Position bias

Per individual judge call (slot 1 = "Patch 1"):

| Judge | Calls | Slot 1 / slot 2 / tie | Slot 1 share of decisive [95% Wilson] | Binomial p | Mean overall (slot 1 − slot 2) [95% CI] |
|---|---|---|---|---|---|
| Sonnet 5.5, suite | 62 | 22 / 25 / 15 | 0.47 [0.33, 0.61] | 0.77 | 0.000 [−0.095, +0.095] |
| Opus 5.5, suite | 46 | 18 / 13 / 15 | 0.58 [0.41, 0.74] | 0.47 | +0.057 [−0.075, +0.188] |
| Opus 5.5, MWG original | 45 | 17 / 12 / 16 | 0.59 [0.41, 0.74] | 0.46 | +0.098 [+0.015, +0.180] |
| All pooled | 153 | 57 / 50 / 46 | 0.53 [0.44, 0.62] | 0.56 | +0.046 [−0.014, +0.105] |

No detectable preference bias. Opus may score slot 1 about 0.06 to 0.10 higher; in the suite this cancels
because each pair is judged in both orders. In the MWG original (one order per pair, A first 26 times, B
first 19) it is worth about +0.015 for A, which is negligible.

How the two orders combined, per pair:

| Judge | Pairs | Both tie | Same patch preferred in both orders | Position flip | One decisive + one tie | Recorded decisive |
|---|---|---|---|---|---|---|
| Sonnet | 31 | 5 | 20 | 1 | 5 (all 5 recorded as a **win**) | 25 |
| Opus | 23 | 6 | 13 | 1 | 3 (all 3 recorded as a **win**) | 16 |

The tie-on-disagreement rule is not hiding a position bias: only 2 of 54 pairs flipped with position.
But the README ("If verdicts disagree, including flips caused by position, the result is a tie") and the
old docstring do not match the code. `combineVerdicts` gives a side the win when it has more votes than the
other side and more than half the tie count, so 1 vote + 1 tie is a win. 8 of the 41 decisive pair
records rest on a single vote. I corrected the docstring and added a test that pins the behaviour; I did
not change the rule (it would change decisive counts). **Proposal:** either require both orders to agree,
or correct the README.

#### 3. Noise floor with uncertainty

Noise floor = mean |overall difference| between two runs of the same arm. Bootstrap, 10,000 resamples, seed 4.

| Judge, source | A/A pairs | Floor (mean \|d\|) [95% CI] | Max | SD of signed d | Decisive rate [95% Wilson] |
|---|---|---|---|---|---|
| Sonnet, vue A/A (aa-smoke) | 8 | 0.14 [0.05, 0.23] | 0.40 | 0.20 | 5/8 = 63% [31, 86] |
| Sonnet, ts-backend A/A | 8 | 0.20 [0.08, 0.35] | 0.60 | 0.30 | 6/8 = 75% [41, 93] |
| Sonnet, mwg-repro A#1/A#2 | 5 | 0.24 [0.10, 0.38] | 0.40 | 0.31 | 4/5 = 80% [38, 96] |
| **Sonnet, all pooled** | 21 | **0.19 [0.11, 0.26]** | 0.60 | **0.26** | **15/21 = 71% [50, 86]** |
| Opus, vue A/A (aa-smoke) | 8 | 0.16 [0.08, 0.26] | 0.40 | 0.23 | 4/8 = 50% [22, 78] |
| Opus, mwg-repro A#1/A#2 | 5 | 0.14 [0.04, 0.24] | 0.30 | 0.21 | 3/5 = 60% [23, 88] |
| **Opus, all pooled** | 13 | **0.15 [0.09, 0.22]** | 0.40 | **0.21** | **7/13 = 54% [29, 77]** |
| Opus, MWG original controls N1/N2 (1 verdict per pair) | 6 | 0.17 [0.03, 0.30] | 0.40 | 0.20 (mean −0.17) | 3/6 = 50% [19, 81] |

Plainly: with 8 pairs the floor is somewhere between 0.05 and 0.23 for vue and between 0.08 and 0.35 for
the backend; a single eval's floor is known to within a factor of about 4. The Sonnet-vs-Opus floor
difference (0.24 vs 0.14 on 5 pairs) is inside these intervals. The judge names a winner between two runs
of the **same** arm in 71% (Sonnet) or 54% (Opus) of pairs, so individual pair verdicts and "3–0 sweeps"
on one task carry almost no information. Signed differences are centred on zero (Sonnet −0.01, Opus 0.00),
so there is no left/right artefact.

#### 4. Minimum detectable effect and power

**The rule** (`aggregate.mjs:256`): `significant = beyondNoise && signTestP < 0.1 && pairs >= 4`, where
`beyondNoise = |mean(B−A)| > mean|A/A diff|` and the sign test is two-sided on decisive pair verdicts,
counting every (task, rep) pair as independent.

**(a) Reachability.**

| Decisive pairs | Best p (all one way) | With 1 dissent | With 2 dissents |
|---|---|---|---|
| 4 | 0.125 | 0.625 | 1 |
| 5 | **0.0625** | 0.375 | 1 |
| 7 | 0.016 | 0.125 | 0.45 |
| 8 | 0.008 | **0.070** | 0.29 |
| 10 | 0.002 | 0.021 | 0.109 |
| 12 | 0.0005 | 0.006 | **0.039** |

- `--smoke` (4 tasks × 1 rep): **can never return a positive.** Four pairs cannot reach p < 0.1, and with
  one rep there are no A#1/A#2 control pairs, so the floor is `null` and `beyondNoise` is `null`.
- Any `--reps 1` run, including 15 × 1: **can never return a positive**, for the same `null` floor reason,
  whatever the effect size. The report does not say so; it prints "not significant".
- 8 pairs (the A/A designs): needs 8–0 or 7–1 among decisive verdicts.
- mwg-repro (5 × 2 = 10 pairs): needs at least 9–1 if all ten are decisive.

**(b) MDE.** Model: d(task t, rep r) = δ + τ_t + ε, τ_t ~ N(0, σ_τ²) (the effect differs by task),
ε ~ N(0, σ_ε²) (run and judge noise). Then SE(mean) = sqrt(σ_τ²/T + σ_ε²/(T·R)) and
**MDE = (1.96 + 0.84) × SE** for 80% power at two-sided α = 0.05.

Estimates: σ_ε = 0.26 (Sonnet A/A, n=21), 0.21 (Opus A/A), 0.26 (MWG original within-task). σ_τ = 0.14
(MWG original, 15 tasks × 3, ICC 0.22) and 0.49 (mwg-repro Sonnet, 5 tasks × 2, ICC 0.87, driven by F1
at −1.0 in both reps). σ_τ = 0 is the best case (same effect on every task).

MDE in overall points, σ_ε = 0.26:

| Tasks × reps | Pairs | σ_τ = 0 | σ_τ = 0.14 | σ_τ = 0.49 |
|---|---|---|---|---|
| 4 × 1 (smoke) | 4 | 0.36 | 0.41 | 0.78 |
| 4 × 2 (A/A runs) | 8 | 0.26 | 0.32 | 0.73 |
| 5 × 2 (mwg-repro) | 10 | 0.23 | 0.29 | 0.66 |
| 13 × 1 | 13 | 0.20 | 0.23 | 0.43 |
| 13 × 3 | 39 | 0.12 | 0.16 | 0.40 |
| 15 × 1 | 15 | 0.19 | 0.21 | 0.40 |
| 15 × 2 | 30 | 0.13 | 0.17 | 0.38 |
| 15 × 3 (MWG original) | 45 | 0.11 | 0.15 | 0.37 |
| 15 × 5 | 75 | 0.08 | 0.13 | 0.36 |
| 30 × 1 | 30 | 0.13 | 0.15 | 0.28 |
| 30 × 3 | 90 | 0.08 | 0.10 | 0.26 |

Tasks needed to detect a true 0.3 (normal approximation plus 2 for the small-sample t correction):

| Reps | σ_τ = 0 | σ_τ = 0.14 | σ_τ = 0.49 |
|---|---|---|---|
| 1 | 8 tasks | 10 tasks | 29 tasks |
| 2 | 5 tasks (10 pairs) | 7 tasks (14 pairs) | 26 tasks (52 pairs) |
| 3 | 4 tasks (12 pairs) | 6 tasks (18 pairs) | 25 tasks (75 pairs) |
| 5 | 4 tasks (20 pairs) | 5 tasks (25 pairs) | 25 tasks (125 pairs) |

Using the raw per-pair SD of real A/B differences and treating pairs as independent: 10 pairs at SD 0.29
(MWG original), 24 pairs at SD 0.50 (mwg-repro). When the effect varies by task, extra reps barely help:
at σ_τ = 0.49, going from 15 × 1 to 15 × 5 moves the MDE from 0.40 to 0.36. More tasks are needed, not
more reps.

**(c) Power of the suite's actual rule** (20,000 simulations per cell, seed 4; noise resampled from the
Sonnet A/A differences; verdict model fitted to the saved records: decisive 96% of the time and following
the score sign 95% of the time when |d| ≥ 0.05, decisive 38% otherwise; one control pair per task as in
`--judge-controls 1`). True effect +0.3:

| Tasks × reps | σ_τ = 0: suite rule / task-level paired t | σ_τ = 0.14: suite / t | σ_τ = 0.49: suite / t | False "differs" at zero effect, σ_τ = 0.49: suite / t |
|---|---|---|---|---|
| 4 × 1 (smoke) | **0.00** / 0.39 | **0.00** / 0.31 | **0.00** / 0.12 | 0.000 / 0.050 |
| 5 × 2 (mwg-repro) | 0.50 / 0.80 | 0.46 / 0.61 | 0.21 / 0.17 | 0.076 / 0.051 |
| 15 × 1 | **0.00** / 0.99 | **0.00** / 0.96 | **0.00** / 0.50 | 0.000 / 0.053 |
| 15 × 2 | 0.95 / 1.00 | 0.92 / 1.00 | 0.56 / 0.55 | 0.077 / 0.049 |
| 15 × 3 | 0.97 / 1.00 | 0.95 / 1.00 | 0.66 / 0.56 | 0.103 / 0.051 |
| 15 × 5 | 0.98 / 1.00 | 0.96 / 1.00 | 0.74 / 0.57 | **0.130** / 0.048 |
| 13 × 3 | 0.96 / 1.00 | 0.94 / 1.00 | 0.63 / 0.49 | 0.114 / 0.049 |
| 30 × 3 | 1.00 / 1.00 | 0.99 / 1.00 | 0.85 / 0.87 | 0.044 / 0.048 |

With the Opus noise pool the picture is the same (15 × 2: 0.96; 5 × 2: 0.48; all `× 1` rows 0.00).

Three defects in the rule:

1. **No floor at one rep.** Power is exactly 0 for every `× 1` design.
2. **Wrong scale.** It compares the mean of N differences (which shrinks as 1/√N) with the mean absolute
   single-pair difference (which does not shrink). An effect smaller than the floor (0.19 [0.11, 0.26]) is
   undetectable at any sample size: for a true +0.15, 15 × 3 gives power 0.26 against 0.96 for a paired
   t-test, and 30 × 3 gives 0.20 against 1.00. The floor is also estimated from only T pairs.
3. **Pseudo-replication.** The sign test counts reps of one task as independent. When effects differ by
   task and average zero, the rule declares a difference in 10–13% of 15 × 3 to 15 × 5 runs. At σ_τ ≤ 0.14
   it is very conservative (≤ 0.7%).

**Sign test implementation** (`aggregate.mjs:12`): correct. Two-sided exact binomial, ties excluded,
`n = 0` gives 1, capped at 1. Checked against exact values: 9/10 → 0.0215, 30/40 → 0.00222, symmetric in
wins and losses. No off-by-one.

**Multiple comparisons.** Only the overall comparison is tested; per-task and per-category tables carry
preference counts without tests, so there is no formal multiplicity problem. "Notable diffs" lists the six
largest |B−A| pairs at ≥ 0.4, which is the size of the largest A/A differences seen (0.4 to 0.6); those
entries are selected extremes of noise.

**Proposed (not applied):** replace floor + sign test with a task-level test (mean of per-task mean
differences, t interval or task-clustered bootstrap), print the 95% CI and the design's MDE in the report,
and state "cannot conclude: no control pairs" when reps = 1. Keep the sign test as a secondary figure.

#### 5. Judge-set bookkeeping

| Eval | Set directory | Records | `judge` tag in every record | Model that actually answered (session logs) |
|---|---|---|---|---|
| aa-smoke | `claude-opus-5-5` | 8 | opus / medium | 16/16 calls Opus |
| aa-smoke | `claude-sonnet-5-5` | 8 | sonnet / medium | 16/16 Sonnet |
| mwg-repro | `claude-opus-5-5` | 15 | opus / medium | 30/30 Opus |
| mwg-repro | `claude-sonnet-5-5` | 15 | sonnet / medium | 30/30 Sonnet |
| ts-backend-aa | `claude-sonnet-5-5` | 8 | sonnet / medium | 16/16 Sonnet |

No mixing. The rejudge logs show the 8 and 15 earlier Opus judgments moved into their own set before the
Sonnet set was written, and `aggregate` reads only the active set. Note that `config.json` in aa-smoke and
mwg-repro still says `judgeModel: claude-opus-5-5` while their REPORT.md uses the Sonnet set.

README table, recomputed with the suite's `compareJudgeSets` on the saved records: **reproduces exactly.**

| Eval | Pairs | Same preference [95% CI] | Opposite decisive | Margin r | Sonnet floor | Opus floor | Cost per judgment |
|---|---|---|---|---|---|---|---|
| vue A/A | 8 | 88% [53, 98] | 0/4 | 0.92 | 0.14 | 0.16 | $0.046 vs $0.097 |
| MWG reproduction | 15 | 73% [48, 89] | 2/12 | 0.81 | 0.24 (5 pairs) | 0.14 | $0.062 vs $0.132 |

The numbers are right; the evidence is thin. 23 pairs cannot separate 73% agreement from 50% or 90%, and
two opposite decisive calls in twelve is 17%. "Sonnet reached the same verdict on both evals" is true but
weak: one eval is A/A, and in the other neither judge could have reached a positive verdict easily.

#### 6. Fixes applied

| File | Change |
|---|---|
| `evals/lib/judge.mjs` | New `sanitisePatch`, applied inside `buildJudgePrompt`: strips the `diff -ruN --exclude=...` command line and the header timestamps. Checked on all 61 saved suite diffs: no residue, hunk bodies unchanged. `judgePair` now returns `calls` (order, preference and overall scores per verdict), so position bias can be audited from the record instead of the session logs. Docstring of `combineVerdicts` corrected to describe what the code does. |
| `evals/lib/providers/claude.mjs` (`ask` only) | Judge runs from a fresh empty temp directory outside the eval tree, removed afterwards. **Not verified live** (no model calls allowed in this audit): the first real judge run should confirm that no `instructions` attachment appears in the judge session log. |
| `tests/evals-judge.test.mjs` (new) | 4 tests: sanitiser, prompt has no harness markers or timestamps, one-vote-plus-tie behaviour, per-verdict `calls` with balanced order. |

`npm run verify` passes (82 tests at 23:27 UTC, including other streams' additions).

#### Can each saved eval support its REPORT.md conclusion?

| Eval | Conclusion drawn | Supported by the judge data? |
|---|---|---|
| validation-aa-smoke (vue A/A) | "A/A control"; floor 0.14, decisive 63% | **Yes as a label.** The floor is 0.14 with CI [0.05, 0.23] on 8 pairs from 4 tasks; quote it as a range. |
| validation-ts-backend-aa | "A/A control"; floor 0.20, decisive 75% | **Yes as a label.** CI [0.08, 0.35]. Accessibility and platform were constant 3 in 16/16 and 14/16 calls, so the overall scale is compressed here. |
| validation-mwg-repro | "don't adopt (no measurable benefit)", B−A −0.17 vs floor ±0.24, p = 1.00 | **Only as "nothing detected".** 95% CI on B−A: [−0.53, +0.19] over 10 pairs, and [−0.80, +0.46] over the 5 task means. A +0.3 benefit is not excluded. The design had about 0.2 to 0.5 power for +0.3 under the suite rule. F1 (−1.0 in both reps) drives the mean. The verdict rests on the +54% cost, not on quality evidence. |
| MWG original (`the original MWG eval directory`) | "no measurable difference to quality", A 15 / B 14 / tie 16 | **Yes, the best supported of the four.** B−A −0.04, task-level 95% CI [−0.16, +0.07] over 15 tasks: a benefit of +0.1 or more is excluded on this rubric. Its "noise floor ±0.3" is overstated; the control tasks give 0.17 [0.03, 0.30]. Caveats: one verdict per pair, same-family judge, rubric wording aligned with the policy under test (which would favour B). |
| validation-ts-backend-shakeout | single-arm, no judge | Not applicable. |

#### Not done

- Live confirmation that the temp-cwd judge no longer loads `~/.claude/CLAUDE.md`.
- The same live-CLAUDE.md load in **arm agent** runs (stream5 area) is reported, not fixed.
- README text on the tie rule and the decision rule were left unchanged (proposals above).
- Position and noise figures for a non-Claude judge (`--judge-command`): no data exists.
- The `command` judge provider still runs with cwd `judge-home` and the caller's full environment.


# Stream 5: isolation and measurement integrity

## Stream 5: isolation and measurement integrity

Scripts and raw outputs: `/tmp/audit/stream5/` (`scan.mjs` + `scan.json` over all 61 saved transcripts, `overhead.mjs` + `cost-overhead.json`, `cache-check.mjs`, `iso/` strace and debug logs). No model calls were spent: the isolation probes ran `claude -p` with an invalid token (401, $0).

### 1. Arm isolation

| Claim (README "Isolation and safety") | Verified | Verdict |
|---|---|---|
| Env is scrubbed to PATH + locale, HOME/CLAUDE_CONFIG_DIR per arm | `env.mjs` `baseEnv`, `providers/claude.mjs` `claudeEnv`: PATH, LANG, TERM, HOME, telemetry vars, CLAUDE_CONFIG_DIR, auth token, agent-browser vars, `--env`. No XDG/NODE_OPTIONS/npm_config pass-through. Gates, http smoke and fixture setup (harness, not agent) do inherit the full caller env. | Holds for the agent |
| "They cannot see your `~/.claude`" | **False.** Claude Code walks up from the run cwd (`~/agent-config-evals/<eval>/runs/<id>/app`) and treats `/home/<user>/.claude` as project config. | **Hole, hit in all 61 saved runs** |
| Arms differ only as intended | `system/init` events compared across all runs: tools, mcp_servers (`[]`), plugins, agents, model, CLI version identical in A and B; only the per-run memory path differs. | Holds (contamination is symmetric) |
| Live config snapshot covers `~/.agents/**` | `liveConfigSnapshot` listed top-level entries only; an in-place edit of `~/.agents/skills/x/SKILL.md` did not change it. | Hole, fixed (now recursive) |
| Each arm is installed by its own ref's installer | `buildArm` runs `<armDir>/src/bin/agent-config.mjs sync --user` from the extracted ref. | Holds |

**Ancestor-walk leak, evidence.**
- Every saved init event lists skills that exist only in the live `~/.claude/skills` (`step-ssh`, `vault-run`, `paseo*`, `animate`, `emil-design-eng`, ...), not in the arm home (7 skills).
- Reproduced at $0 with an empty isolated HOME: cwd under the home gives debug line `Loading skills from: ... user=<iso>/.claude/skills, project=[/home/<user>/.claude/skills]` and "23 project skills"; cwd under `/tmp` gives none. With arm B's home copied in: `30 unique skills (user: 7, project: 23)`, so live copies of `manual-qa`, `agent-browser`, `fullstack-*`, `codex-review` load next to the arm's own. Which copy wins on a name clash: NOT VERIFIED.
- `strace` of the same probe: `openat("/home/<user>/.claude/CLAUDE.md", O_RDONLY) = 16` (read). The file's `@~/.agents/AGENTS.md` import target was **never opened** (no `/home/<user>/.agents` access in the trace), and live `settings.json` is not read (only cwd-level project settings are probed). So the 5-line live bridge file reaches both arms, the live policy text behind the import does not. Caveat: verified in the $0 probe (same CLI 2.1.311, same flags), not by reading a saved run's system prompt.
- A `git init` in the app stops the skills walk (`project=[]`) but not the CLAUDE.md read.
- No saved run invoked the `Skill` tool (0 of 61) and none read a live path: grep of all tool inputs for `/home/<user>/.claude`, `.agents`, `dev/`, the repo checkout, `hidden`, `.cache/fixtures`, other arms and other runs' dirs found nothing.

**What it means for A/B validity.** Symmetric: both arms get the same extra skill listing and bridge file, so it does not bias A vs B. It does dilute: the "baseline" is not the arm install alone, and an A/B on a *skill* that also exists live may be shadowed by the live copy (precedence not verified). The mwg-repro change was a policy file, read by path from the arm home, so that result is not affected by shadowing.

**Other findings.**
- Arm homes are reachable by relative path; `mwg-repro/F2-gallery-performance__A__r1` ran `cat ../../../arms/A/home/.agents/policy/...` (its own arm). No run touched the other arm. `validation-mwg-repro`: `modern-web.md` exists only in arm B's home; A transcripts have no read of it.
- `arms/<arm>/src` holds the whole ref. Once a ref contains `evals/` (after merge, or `WORKTREE`), hidden tests sit at `../../../arms/A/src/evals/fixtures/*/hidden`. Not exploitable in saved runs (`main` has no `evals/`). Fixed: `buildArm` deletes `src/evals`.
- App copies contain no back-pointer (no `.eval-manifest.json`, no absolute symlinks, no cache path in files).
- A/A homes: installed config identical apart from the lock file's own path and timestamp; the homes also accumulate per-arm mutable state shared by all runs of that arm (`.bun/install/cache`, `.npm`, `.agent-browser`, `.claude/projects`).
- No `/etc/claude-code`, no CLAUDE.md/AGENTS.md between the run dir and the home.

### 2. Cost and token accounting

All 61 runs recomputed from `transcript.jsonl`. Every run: one `result` event, one model, 0 subagents spawned, 0 Task calls, status ok, none retried. So the "subagent / multi-model / retried" cases asked for do not exist in the saved data: NOT VERIFIABLE.

| Check | Result |
|---|---|
| recorded `cost.usd` vs `result.total_cost_usd` | delta $0 in 61/61 |
| vs sum of `modelUsage[*].costUSD` | delta $0 in 61/61 |
| input / output / cache-read / cache-write tokens vs `result.usage` and `modelUsage` | identical in 61/61 |
| independent sum of per-message usage, dedup by message id | input, cache-read, cache-write identical in 61/61; output lower (e.g. 126 vs 3971) because stream events carry the usage snapshot at message start. Not a suite error. |
| USD vs tokens | exact linear fit: $4 in, $20 out, $0.20 cache read, $8 cache write per MTok, max residual 3e-15 |
| per-dir totals vs `summary.json` / REPORT.md | aa-smoke 6.366, mwg-repro 12.123, ts-backend-aa 7.872, shakeout 4.331: all match |

Sample (all 61 rows in `scan.json`):

| Run | Recorded USD | Recomputed USD | Delta |
|---|---|---|---|
| aa-smoke/C5-container-card-grid__A__r1 | 0.3017068 | 0.3017068 | 0 |
| aa-smoke/F2-gallery-performance__B__r2 | 0.4723128 | 0.4723128 | 0 |
| mwg-repro/C5-container-card-grid__A__r1 | 0.3096368 | 0.3096368 | 0 |
| mwg-repro/F1-inline-validation__B__r1 | 1.5306620 | 1.5306620 | 0 |
| mwg-repro/F2-gallery-performance__B__r2 | 1.1377932 | 1.1377932 | 0 |
| ts-backend-aa/B5-webhook-idempotency__A__r2 | 0.6873242 | 0.6873242 | 0 |
| ts-backend-aa/N2-readme__B__r1 | 0.5629882 | 0.5629882 | 0 |
| shakeout/B8-structured-errors__A__r1 | 0.6751780 | 0.6751780 | 0 |

Notes: USD is the CLI's list-price estimate (`apiKeySource: none`, subscription login), not a bill. Judge cost is kept apart from run cost and included in "total" consistently. A timed-out run has no `result` event, so its cost is recorded as null and counts $0 toward the budget cap (code reading; no such run saved). "Input tokens incl. cache" sums input + cache read + cache write.

**How overhead is computed.** `aggregate.mjs`: ratio of per-arm means over all runs with a cost (`mean(B)/mean(A) - 1`), not paired, no CI. The report prints it to 0.1% and the verdict uses a 10% threshold.

**Recomputed overhead, bootstrap 95% CI** (10000 iterations, mulberry32 seed 20261115; saved in `/tmp/audit/stream5/cost-overhead.json`). "runs" resamples runs within task x arm; "tasks+runs" also resamples tasks.

| Dataset | Statistic | Point | CI (runs) | CI (tasks+runs) |
|---|---|---|---|---|
| mwg-repro, 5 tasks, 20 runs | ratio of means | **+54.2%** | +35.2 .. +73.3% | +12.8 .. +98.0% |
| | mean of task ratios | +49.2% | +33.9 .. +64.9% | +12.3 .. +91.5% |
| | median task ratio | +52.2% | +12.4 .. +81.4% | +3.2 .. +96.0% |
| mwg-repro, non-control (4 tasks) | ratio of means | +61.3% | +39.7 .. +82.7% | +17.1 .. +109.0% |
| original mwg-eval, 15 tasks, 90 runs | ratio of means | **+38.6%** | +30.4 .. +47.3% | +22.7 .. +57.6% |
| | mean of task ratios | +35.3% | +28.4 .. +45.0% | +21.3 .. +54.3% |
| | median task ratio | +32.8% | +19.0 .. +41.7% | +13.9 .. +47.5% |
| original, non-control (13 tasks) | ratio of means | +42.1% | +33.1 .. +51.8% | +25.4 .. +62.6% |
| original, same 5 tasks as repro | ratio of means | +63.5% | +45.9 .. +84.2% | +22.3 .. +103.7% |
| aa-smoke (A/A null) | ratio of means | -7.0% | -13.7 .. +0.1% | -19.2 .. +7.4% |
| ts-backend-aa (A/A null) | ratio of means | -6.5% | -15.5 .. +4.7% | -23.9 .. +13.9% |
| ts-backend-aa, non-control | ratio of means | -14.3% | -24.8 .. -1.1% | -31.4 .. +0.9% |

Reading: the suite's +54.2% and the original +38.6% / +42.1% reproduce exactly. "+54%" vs "+39%" is a task-mix effect: on the same 5 tasks the original gives +63.5%, and the repro CI covers it. Two identical arms differ by 7% (up to 14% on non-control tasks) at n=8 per arm, so the 10% "don't adopt" threshold sits inside the noise at smoke size. One task (F1, +117%) drives much of the repro figure.

### 3. Resume / recheck integrity

| Question | Finding | Verdict |
|---|---|---|
| Can `--resume` mix task sets, arms, model? | No: `config.json`, `taskset.json`, `arms.json` are reloaded. But `--b`, `--model`, `--tasks` etc. passed with `--resume` were silently ignored. | Holds; silent ignore fixed (now an error) |
| Different fixture version in one report? | Yes: the fixture is loaded from the repo at resume time and no hash was stored. | Hole, not seen in saved runs; fixed (hash stored, resume refuses) |
| Arm home changed between runs? | Never re-verified. | Hole; fixed (inventory compared on resume and at the end) |
| `--recheck` audit trail | None: `run.checks` and `taskset.json` (prompts included) were overwritten. **It happened:** `validation-ts-backend-aa` finished 20:54:50, all 16 run records and `taskset.json` were rewritten 20:55:26-39, and a new fixture cache `ts-backend-be4e70ab2784` was built at 20:55:25, while the runs used `ts-backend-7a051a8db6e9`. The log does not mention it; the original check results are gone. | **Hole, exploited** (the reported A/A check rates are post-hoc, on hidden tests newer than the runs); fixed going forward |
| Recheck re-runs gates? | No. `gatesPass` stays from the run's fixture version while checks come from the current one. | By design; now stated in the report |
| Judge override persistence | `--rejudge --judge-model` did not update `config.json`: aa-smoke and mwg-repro say opus in `config.json` while the report's active judge is sonnet. A plain `--report-only` would flip the active judge set back. Demonstration on a copy: NOT DONE. | Hole; fixed (config written back, audit line) |
| Stale judgments | Keyed by `<task>__AB__r<rep>` only; a redone run kept its old verdict. | Hole, not seen in saved runs; fixed (patch hashes stored) |
| Saved-dir consistency | Check ids in run records match `taskset.json` in all four dirs; no record lags its transcript except the recheck above. | Clean |

### 4. Fixture state leakage between runs

- `verifyPristine` compares size and mtime of every file under `linkPaths` against a manifest: it detects in-place writes and files added to the cache; it misses chmod and mtime-restoring writes. It ran once, at the end, and only logged a WARNING; a damaged cache was reused by later evals. Fixed: checked after every run (stops the eval), on reuse (rebuilds), and reported.
- Saved evals: no WARNING in any log; every manifest file still has its original size and mtime. No run added a dependency (`deps.added` empty in 61/61). Two runs installed outside the app (`/tmp/imgtool` npm install sharp; `mktemp -d` copy + `bun install`).
- The caches are **not clean now**: `ts-backend-5fb139da4a97` (54 files), `ts-backend-be4e70ab2784` (607) and `vue-primevue-136626e6e3ab` (10) gained `node_modules/.vite`, `.vitest-cache`, `.tmp` files dated 23:17-23:26 today, i.e. written by this audit's own streams. The lead's final recheck will see them.
- `--rejudge` and `--recheck` built a fixture cache they never used (`vue-primevue-4af76c57bad9` at 20:40:28). Fixed.
- **Shared `/tmp` and ports (hole, hit).** Agents use fixed names. 8 time-overlapping pairs shared a `/tmp` path, 28 shared a port, 7 transcripts show EADDRINUSE. Worst case, `ts-backend-aa` B7-tenant-isolation r1: arm A saved its fixed `src/routes/tasks.ts` to `/tmp/tasks.fixed.ts` at 20:44:34.6, arm B overwrote that file at 20:44:38.9, arm A copied it back at about 20:44:40.8 and again at 20:44:48. Arm A's final file is arm B's. Here all four runs converged on the same bytes, so nothing changed, but it is a working cross-arm channel. Both runs also shared `/tmp/qa-tasks.db`. `aa-smoke` and `mwg-repro` ran at the same time and both used port 5199.
- `pkill -f <app>` misses servers started with relative paths, which is how ports stay taken.
- Smoke ports were `Math.random()` in 4300-5800 / 5600-8600, overlapping the agents' favourites, and any HTTP answer counted as "ready", so a smoke could test another run's server. All 25 saved http smokes passed; no evidence it happened. Fixed (OS-assigned port; stop waiting when our server exits).

### 5. Edits made (uncommitted)

| File | Change |
|---|---|
| `evals/lib/env.mjs` | `ancestorAgentConfig(dir)` lists `.claude`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json` in ancestors; `freePort()` |
| `evals/lib/http-smoke.mjs`, `browser.mjs` | use `freePort()`; http smoke fails if its server exits while waiting |
| `evals/lib/arms.mjs` | `liveConfigSnapshot` recursive; `buildArm` removes `src/evals` |
| `evals/lib/fixtures.mjs` | `preparePristine` verifies a cached copy and rebuilds it if modified |
| `evals/lib/plan.mjs` | `fixedFlagsOnResume`, `changedArmFiles`, `flippedChecks` (pure helpers) |
| `evals/lib/report.mjs` | "Integrity warnings" section; "Rechecked N time(s)" line |
| `evals/run.mjs` | `--resume` rejects frozen flags; stores `fixtureHash`, refuses new runs on a changed fixture; arm inventory re-verified; `audit.jsonl` line per resume/rejudge/recheck/report-only; overrides written to `config.json`; recheck keeps `checksOriginal`, records flips, replaces only `checks` in the saved task set; no fixture build for rejudge/recheck; cache verified after each run; judgments carry patch hashes and stale ones are dropped; warnings in summary and report |

Status of these edits: see the final section.

### Open, prioritised

1. **P1** Run agents outside the real home (default `AGENT_CONFIG_EVALS_HOME` is under it) or in a mount namespace; today the suite only warns. README still says agents cannot see `~/.claude`.
2. **P1** Private `/tmp` per run (bwrap / `unshare -m`) and a kill that covers the run's whole process tree; shared `/tmp` moved code between arms.
3. **P2** Report a CI with the cost overhead and do not apply a 10% threshold at smoke size.
4. **P2** Count spend for timed-out runs.
5. **P3** Skill name clash precedence between arm home and ancestor `.claude/skills`: not verified.
6. **P3** Copy-on-write (reflink) instead of hard links for `node_modules`.

### Status of the edits and what was exercised

- `npm run verify` passes (86 tests, 0 fail) with all edits in place. New test file `tests/evals-integrity.test.mjs` covers `liveConfigSnapshot` recursion, `ancestorAgentConfig`, `freePort`, `fixedFlagsOnResume`, `changedArmFiles`, `flippedChecks`.
- Exercised on a synthetic copy of `validation-mwg-repro` (`/tmp/audit/stream5/synth`, results only, no model calls): `--resume <dir> --b other` now fails with "drop --b or start a new eval"; `--report-only` completes, writes `audit.jsonl`, and the arm-inventory check passes against the saved arm homes.
- That same `--report-only` shows the judge-override hole on the saved dirs: `config.json` still says opus, so the regenerated report's active judge is `claude-opus-5-5`, where the saved report used `claude-sonnet-5-5`. The fix only protects evals rejudged from now on; for the existing dirs pass `--judge-model claude-sonnet-5-5` when regenerating.
- NOT exercised end to end (no agent run, no recheck executed): the `run.mjs` paths for recheck history (`checksOriginal`, `rechecks`, `recheck-result` audit line), the fixture-hash refusal, per-run cache verification, stale-judgment dropping, the `buildArm` `src/evals` removal, the `preparePristine` rebuild, and the smoke-port changes. They pass `node --check` and code reading only. The "Integrity warnings" and "Rechecked" report lines have no test.
- No edit was reverted. I did not touch `checks.mjs`, `judge.mjs`, `providers/claude.mjs` or `tests/evals-judge.test.mjs`.


# Stream 6: the MWG conclusion

### Stream 6: the modern-web-guidance (MWG) conclusion, re-checked

**Verdict (5 lines)**
1. **Cost increase: robust.** Original eval +38.6% USD per run, task-bootstrap 95% CI [+24%, +55%] (45 vs 45 runs, 15/15 tasks dearer, 40/45 pairs dearer). Reproduction +54.2%, CI [+16%, +91%] (10 vs 10 runs). The two numbers are **not** a range of uncertainty: they are the same effect on two task mixes (original re-weighted to the reproduction's mix = +54.8%).
2. **The cost comes from the guidance being used, not installed.** B runs that never ran the CLI cost +6% (n=9) and +5% (n=4); B runs that did cost +44% and +81%. No false triggers (0/8 control runs), no CLI failures (0/83 calls), no model/order/time confound found.
3. **Quality: "no net gain on the judge's composite score" is supported; "no quality gain" is not.** Original B−A = −0.04 on a 1–5 scale, CI [−0.14, +0.05], so a composite gain above about +0.05 to +0.15 is ruled out *as this rubric scores it*. The composite hides a platform-dimension gain on custom/forms tasks (+0.26, CI [+0.07, +0.52], post hoc) cancelled by fit and scope losses, almost all from one task (F1).
4. **The reproduction adds almost nothing on quality** (10 pairs, MDE about 0.45 to 0.65 points; the suite's sign-test rule needs 9 of 10 pairs for B, power 5% to 38%). Its "don't adopt (no measurable benefit)" was close to predetermined by the heuristic for any change costing over 10%. It does reproduce the cost effect and the F1 regression and F2 improvement per task.
5. **"Don't adopt as written" still stands as a decision**, because the cost is certain and the measured net benefit is bounded near zero. What does not stand is any reading of it as "the guidance has no value": the evidence says it helps on F2-type tasks, hurts on F1-type tasks, and is wasted on library-covered tasks, and no experiment has tested the narrowed routing that the original report itself proposes.

Scripts (Node, seeded, read-only on the evidence): `/tmp/audit/stream6/analyze.mjs`, `extra.mjs`, `perprotocol.mjs`; outputs `out.txt`, `extra.txt`, `perprotocol.txt` beside them. Bootstrap: 10,000 resamples of **tasks** (clusters), mulberry32 seed 20261115, percentile CI. All numbers below are recomputed from `results/runs/*.json`, `results/judge/**/*.json` and `runs/*/transcript.jsonl`, not copied from either REPORT.md.

#### 0. The two designs, reconciled

| | Original (`the original MWG eval directory`) | Reproduction (`validation-mwg-repro`) |
|---|---|---|
| Runs | 90 = 15 tasks × 2 arms × 3 reps (2 arms only) | 20 = 5 tasks × 2 arms × 2 reps |
| Tasks | L1-4, C1-7, F1-2, N1-2 | L2, C5, F1, F2, N1 (reps 1-2, fresh runs, not a subset of the original runs) |
| Category mix | L 27%, C 47%, F 13%, N 13% | L 20%, C 20%, **F 40%**, N 20% |
| Arms | A `main` e788b89, B `feat/modern-web-guidance` d9c816d | same shas; `diff -r` of both arms' `.agents` trees against the original's: identical |
| Prompts | `tasks/*.txt` | byte-identical for all 15 (checked) |
| Agent | `claude-opus-5-5`, effort medium, concurrency 3 | same model and effort, concurrency 2 (`config.json`, log) |
| A/B judge pairs | 45, Opus, **1 verdict per pair**, random order | **10**, 2 verdicts per pair with alternating order; judged twice: Opus (original run), Sonnet (re-judge, now the reported set) |
| Control pairs | none (noise read off the 2 control *tasks*) | 5 A#1-vs-A#2 pairs (one per task) |
| Checks beyond the 4 gates | none | task pattern checks |

The README judge table's "15 pairs" for the MWG row is 10 A/B pairs + 5 A#1-vs-A#2 pairs = 15 judgments (file count verified in both judge sets). "5 control pairs" are those A-vs-A pairs, not pairs on control tasks. So the reproduction's A/B evidence is **10 pairs on 5 tasks**, of which only 3 tasks (6 pairs) had B actually use the guidance.

#### 1. Cost claim

**Where the numbers come from.** Both are the ratio of arm means of `total_cost_usd` (API list-price equivalent reported by Claude Code; the runs were on an OAuth login, so this is notional spend): mean(B)/mean(A) − 1 over all runs, not paired, no CI in either report.
- "+39%": original, $0.681 / $0.491 = +38.6%, 45 vs 45 runs (`scripts/aggregate.mjs` last lines). "+42%" is the same over the 13 non-control tasks.
- "+54%": reproduction, $0.735 / $0.477 = +54.2%, 10 vs 10 runs (`summary.json` `overhead.costUsd`).

**Recomputed, with task-bootstrap 95% CIs**

| Metric | Original (90 runs) | Reproduction (20 runs) |
|---|---|---|
| USD per run, ratio of means | **+38.6% [+24.3%, +55.3%]** | **+54.2% [+15.5%, +90.7%]** |
| USD per run, absolute | +$0.190 [+0.108, +0.287] | +$0.258 [+0.062, +0.493] |
| USD, non-control tasks | +42.1% [+27.9%, +59.6%] | +61.3% [+18.6%, +100.4%] |
| USD, control tasks | +4.5% (2 tasks, 6 pairs; 4 of 6 pairs B dearer) | +3.2% (1 task) |
| Output tokens | +31.1% [+15.7%, +47.5%] | +47.3% [+10.6%, +81.9%] |
| Input tokens incl. cache | +59.1% [+39.8%, +80.2%] | +72.2% [+13.4%, +124.5%] |
| Wall time | +30.7% [+17.7%, +44.0%] | +46.6% [+8.2%, +80.8%] |
| Turns / tool calls | +29.1% / +31.9% | +30.7% / +32.0% |
| Tasks with B dearer | 15/15 (sign p = 0.0001) | 5/5 (p = 0.06) |
| (task, rep) pairs with B dearer | 40/45 | 8/10 |
| Leave-one-task-out range | +31.5% (drop F1) to +40.8% | +33.0% (drop F1) to +68.5% |

The 5-task CI is a bootstrap over 5 clusters and is too narrow if anything. Pooled over both evals (110 runs, 15 tasks equally weighted): **+37.8% [+23.8%, +53.9%]**; non-control +41.1% [+27.2%, +58.4%].

**"+39%" vs "+54%" is task mix, not disagreement and not a range.** The reproduction picked both F tasks, the category with the largest overhead (2 of 5 tasks vs 2 of 15).

| | Ratio |
|---|---|
| Original, all 15 tasks | +38.6% |
| Original, same 5 tasks, 3 reps | +63.5% [+28%, +99%] |
| Original, re-weighted to the reproduction's category mix | **+54.8%** |
| Reproduction | **+54.2%** |
| Reproduction, re-weighted to the original's mix (one task each for L, C, N: fragile) | +43.7% |

Per task, cost ratio original / reproduction: F1 +123% / +117%; F2 +57% / +52%; N1 +1% / +3%; C5 +37% / +68%; L2 +53% / **+6%** (L2 fired 3/3 in the original and 0/2 in the reproduction). Quoting "+39-54%" as the cost of adoption overstates what a typical task mix would pay; the defensible headline is "about +40% on this task set, CI roughly +25% to +55%, and +30% to +120% per task when the guidance fires".

**Driven by a few tasks or by fixed overhead?** Neither cleanly.
- Not a few tasks: every task is dearer; dropping the worst (F1, 25% of the total difference) still leaves +31.5%.
- Not a fixed per-run lookup fee: the CLI itself is nearly free (below), and per-task B−A grows with task size (slope 0.69 against A's cost, r = 0.59, intercept negative). Per category: L +30%, C +34%, F +91% (F1 +123%, F2 +57%), N +4.5%.
- Decomposition of the original +$0.190 using the list prices the data implies exactly ($8/M cache write, $0.20/M cache read, $20/M output): cache writes $0.087 (46%), cache reads $0.061 (32%), output $0.042 (22%). B has +29% turns **and** a 23% larger context per turn (41k vs 33k tokens).
- Guidance text entering context per firing run (policy file + CLI output + follow-up reads of persisted output): about 34k chars (roughly 8k tokens) in the original, 54k chars in the reproduction. At list prices that is about $0.07 to write once plus about $0.02 to $0.03 to re-read over the remaining turns, i.e. roughly 40% of the $0.232 overhead of a firing run. The rest is the agent doing more afterwards (more turns, +15% added lines, CI [−1%, +31%]). The original report's "most of the overhead comes from the agent then doing more" is directionally right but unquantified there; "about 60% doing more, 40% carrying the guides" is my estimate, not a measurement.

**Used vs merely installed.**

| B runs | Original | Reproduction |
|---|---|---|
| Ran the CLI (`modern-web-guidance@… search\|retrieve`) | 36/45 (36/39 non-control) | 6/10 (6/8 non-control) |
| Cost vs the task's A mean when fired | +44.1% (+$0.232) | +80.7% (+$0.417) |
| Cost vs the task's A mean when not fired | +6.0% (+$0.021, n=9) | +5.1% (+$0.021, n=4) |
| Not fired, non-control only | +8.8% (n=3: L1 r3, L4 r1, r2) | +6.1% (n=2: L2 r1, r2) |
| Control runs that read the policy or ran the CLI | 0/6 | 0/2 |
| Arm A runs that read the policy or ran the CLI | 0/45 | 0/10 |

Installing the pack costs at most a few percent (indistinguishable from run-to-run noise: within-task cost CV is about 15%). The overhead is the guidance being used. "No false triggers" rests on 0/8 runs of two obviously non-UI tasks (a pure TS parser, a Pinia store refactor): one-sided 95% upper bound on the false-trigger rate is 31%, and no borderline control (component test, router config, build tooling) was tried.

**Firing rate and the routing-vs-guidance distinction.** Pooled 42/47 non-control B runs fired (89%). The original's quality result is therefore mostly a statement about the guidance in use (36 of 39 web pairs), and it does report firing per task. The reproduction is different: its REPORT headlines "modern-web fired B 60%" (6/10 including controls; 6/8 where expected) and only 3 of its 5 tasks ever saw the guidance used. Its recommendation line does not say that its quality comparison is 6 treated pairs plus 4 pairs where B was behaviourally A. L2 firing 3/3 then 0/2 with identical prompt, policy and model shows routing on library tasks is itself unstable (original L tasks: 9/12).

**Confounds checked**

| Possible confound | Finding |
|---|---|
| Different model or effort per arm | No. `modelUsage` in every transcript is `claude-opus-5-5` only, both arms, both evals; effort medium for both. |
| Arm order / cache warmth | Original shuffles task and arm order per rep (`orchestrate.mjs`, LCG seed 42): A started first in 20 pairs, B in 25; median start gap 0.6 min. Reproduction: A first 4, B first 6. Mean start offset A 30.8 min vs B 30.8 min (original), 10.8 vs 10.4 (reproduction). No consistent first-starter penalty (A dearer when first, B dearer when second). |
| Runs at different times | Each eval is one interleaved window (original 13:23-14:23 UTC, reproduction 16:44-17:06). One pilot pair (C6 r1) ran 3 minutes before the main batch, both arms together. |
| Retries / dropped runs | None: 90/90 and 20/20 completed with exit 0, one result file each. |
| CLI network calls failing, slow or offline | 70 calls (original) + 13 (reproduction), all arm B, `is_error` 0, no npm/network error text. Median 0.6 s per search, 0.4 s per retrieve, max 2.2 s; about 1 s of wall time per firing run. The +31% wall time is not the CLI. |
| Pinning / telemetry | 83/83 calls use `@1.0.0` and `DISABLE_TELEMETRY=1`. (`@latest` appears in 25 original transcripts, but only inside retrieved guide text, never in a command.) |
| Judge saw truncated diffs | No: largest diff 27 KB (original), 11 KB (reproduction), under the 60 KB clip. |
| Isolation, bootstrap overhead of the homes | Not re-verified here; see stream 5. |

**Cost verdict: stands, and is the most solid result in either report.** Corrections: quote a CI; do not present 39 and 54 as a range; say "when it fires".

#### 2. Quality claim

**What was measured.** (a) 4 gates (lint, typecheck, test, build); (b) reproduction only: regex pattern checks on the diff; (c) an LLM judge reading the two diffs (not rendered UI): five 1-5 scores and a pairwise preference; (d) regex feature counts on the diff. The original also has browser spot checks on a hand-picked subset (not blind, not systematic, not scored).

**B−A on each measure**

| Measure | Original | Reproduction |
|---|---|---|
| Gates | 45/45 vs 45/45: ceiling, zero information | 10/10 vs 10/10: ceiling |
| Required checks | n/a | A 10/10, B 9/10. The one failure (C5 B r1) is a check false negative: B used `grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))]`, a valid way to make columns follow available space; the check demands the string `@container`. |
| Judge overall (mean of 5 dims), all pairs | **−0.044 [−0.142, +0.049]**, n=45 | Sonnet −0.17 [−0.60, +0.17]; Opus −0.29 [−0.71, +0.10], n=10 |
| Judge overall, non-control | −0.026 [−0.133, +0.077], n=39 | Sonnet −0.21 [−0.74, +0.20]; Opus −0.44 [−0.86, −0.08], n=8 |
| Judge overall, pairs where B fired | −0.011 [−0.124, +0.097], n=36 | Sonnet −0.20, Opus −0.43, n=6 |
| Preferences A·B·tie | 15·14·16 (sign p = 1.0); non-control 12·14·13 | Sonnet 5·5·0; Opus 4·5·1 |
| Features on the diff (runs with feature) | B ≥ A on every feature, B > A on 8: ariaLive +3, imgDimensions +2, hasSelector +2, reducedMotion +2, popover, startingStyle, ariaInvalid, intersectionObserver +1 each. Newer-platform features: B 3/21 custom runs, A 0/21 (Fisher p = 0.23) | ariaLive +2, ariaInvalid +1; containerQueries −1 |

Per dimension, original, B−A [CI]: correctness −0.04 [−0.20, +0.11]; accessibility +0.04 [−0.07, +0.13]; **fit −0.27 [−0.60, +0.04]**; **platform +0.13 [−0.02, +0.31]**; scope −0.09 [−0.44, +0.24].

Per category, original overall B−A: library −0.07 [−0.15, 0.00] (4·4·4); custom +0.03 [−0.09, +0.15] (6·7·8); forms-perf −0.13 [−0.47, +0.20] (2·3·1); control −0.17 [−0.33, 0.00] (3·0·3). No category is outside noise. The control category, where B never read the policy, shows the largest gap, and the nine pairs where B did not fire show −0.18 with a CI of [−0.31, −0.04] and prefs 5·0·4 for A. That is a nominally "significant" difference between behaviourally identical arms, which is the best available calibration of how little a subgroup CI over a handful of tasks means here (including the two I flag below).

**Power.** Per-pair SD of the overall difference is 0.289 (original). MDE at 80% power: 2.8 × 0.289 / √45 = **0.12** treating pairs as independent, **0.15** from task-level means (SD 0.20, 15 tasks). In units of the score spread across patches (SD 0.40) that is about 0.3 to 0.4 SD. So the original could have missed a true composite gain smaller than roughly +0.1 to +0.15 points, and its CI upper bound is +0.05 (all) to +0.08 (non-control). Reproduction: pair SD 0.50 to 0.55, MDE **0.44 to 0.65**; it can only see effects the size of F1's. The suite's own decision rule (sign test p < 0.1 on decisive verdicts) needs ≥ 9 of 10 pairs for B; power is 5% if B truly wins 60% of pairs, 15% at 70%, 38% at 80%. At the original's 45 pairs the same rule would have 33% / 84% / 100%. To detect a +0.10 composite gain needs about 66 pairs; +0.15 about 30. (Stream 4's MDE to be preferred if it differs: see cross-references.)

**"No measurable gain" vs "no gain".** The original's headline sentence says "no measurable difference to quality", which is the right wording and is supported with the bound above. It then slides to "The problem is the lack of upside" and "the lookup mostly confirms what it would have done anyway", which are "no gain" claims. The data does not support those as stated:
- The code did change where it fired. Feature counts move in B's direction on 8 features and in A's on none. F2: intrinsic image dimensions 3/3 vs 1/3 and judge prefs 0·2·1 for B. C1: the only native `popover` + `@starting-style` implementation, preferred by the judge.
- The judge did see and reward it. On the 9 custom + forms tasks the **platform** dimension is +0.26 [+0.07, +0.52] for B (post hoc, one of many cuts, treat as suggestive). 61% of all platform scores are exactly 3, the rubric's "no meaningful opportunity" value, so that dimension is live on a minority of tasks only.
- The composite cancels it. Overall is an unweighted mean in which fit and scope both penalise doing more or departing from PrimeVue. B's losses there are concentrated in F1 (fit −1.67, scope −2.00) and C7 (fit −1.33). Excluding F1, non-control overall is +0.01 [−0.07, +0.09]. "Net zero on this rubric" is a measured fact; "no upside" is a statement about weights.

**Did the rubric lean against the guidance?** Partly, by design. The original rubric and the suite's `judgeContext` both say "Penalise bypassing or replacing PrimeVue where PrimeVue 4 has a fitting component", and the rubric tells the judge to "neither reward novelty for its own sake". That matches the owner's stack policy, so it is a legitimate preference, but it means the eval asks "does MWG help under a PrimeVue-first rubric judged from diffs", not "does MWG produce better front-end code". Judges read diffs, so the things the guides target (layout shift, top-layer stacking, focus behaviour, announcements) are inferred, never observed. The original records one confident wrong inference (C7 B r2 "may not switch", which worked in a browser).

**Were the tasks ones where guidance could help?** Of 15: 4 library tasks where the correct answer is the PrimeVue component (guidance can only cost); 2 controls; 9 nominally relevant. Of those 9, three are effectively library-covered too (C2: both arms used PrimeVue Accordion 6/6; C1: PrimeVue Popover exists and the judge docked both arms for not using it; C6: PrimeVue Button plus one API call), and on three both arms converged on the same platform feature without help (C3, C5, C6). The guidance visibly changed the implementation on about five tasks (C1, C4, C7, F1, F2), i.e. about 15 pairs. The average over 45 pairs dilutes whatever happens there by 3×.

**Original vs reproduction, per task (judge overall B−A; prefs)**

| Task | Original (Opus, n=3) | Repro, Opus judge (n=2) | Repro, Sonnet judge (n=2) | Agree? |
|---|---|---|---|---|
| F1 inline-validation | −0.47; A,A,B | −1.05; A,A | −1.00; A,A | Yes: B worse. Pooled prefs A 4, B 1. PrimeVue `Message` dropped by B in 5/5 runs, used by A in 4/5. |
| F2 gallery-performance | +0.20; B,tie,B | +0.05; B,B | +0.35; B,B | Yes: B better. Pooled prefs B 4, A 0, tie 1. But the feature-level story changed: A added image dimensions 2/2 in the reproduction (1/3 originally); B won on `srcset`/`sizes`. |
| C5 container-card-grid | 0.00; tie×3 | −0.30; A,tie | +0.05; B,A | Yes: no effect. |
| L2 settings-tabs | 0.00; tie,B,A | −0.45; B,A | −0.25; B,A | Not comparable: B fired 3/3 originally, 0/2 in the reproduction. |
| N1 query-parser (control) | **−0.33; A,A,A** | **+0.30; B,B** | 0.00; A,B | Opposite signs on a task where the arms behave identically: per-task differences of ±0.3 are noise. |

Direction agrees on the two tasks with a real effect; magnitude on F1 is about twice as large in the reproduction (2 verdicts per pair, different judge prompt). The reproduction's overall mean (−0.17 / −0.29) is more negative than the original's (−0.04) mainly because F1 is 2 of its 10 pairs instead of 3 of 45. Judge choice matters at this n: on the same 10 pairs Opus gives a mean beyond its own noise floor (−0.29 vs ±0.14) and Sonnet does not (−0.17 vs ±0.24); the heuristic verdict is the same only because the sign test is powerless either way.

**Quality verdict.** Supported: no net gain on the composite larger than about +0.05 to +0.15 points; F1 regression and F2 improvement both replicate. Not supported: "no quality gain", "lack of upside", and any quality conclusion drawn from the reproduction alone.

#### 3. Overstatements and errors, line by line

**Original `REPORT.md`**

| Quote | Problem | What the evidence supports |
|---|---|---|
| "cost about **+39% per run** (+42% on web tasks)" | No CI; 3 reps per cell. | +38.6%, 95% CI [+24%, +55%]; correct as a point estimate. |
| "made **no measurable difference to quality**" | Fine as worded, but "quality" = a diff-reading LLM judge's unweighted 5-dimension mean plus gates at ceiling. | "No net difference on the judge composite: −0.04 [−0.14, +0.05]; MDE about 0.12 to 0.15." |
| "The problem is the lack of upside." / "the lookup mostly confirms what it would have done anyway" | Stronger than the data. | Platform +0.26 on custom/forms tasks, 8 features more frequent in B, F2 and C1 wins; cancelled by fit/scope losses. Upside exists and is offset. |
| "Every category's difference sits inside the noise floor measured on the control tasks" | The "noise floor" is 6 pairs on 2 tasks, 1 verdict each; no A-vs-A pairs were judged. | True numerically; the floor itself is poorly estimated. |
| "The guardrails all worked: no false triggers" | 0/6 on two unambiguous non-UI tasks. | "0/6 (0/8 with the reproduction); upper bound about 31%; no borderline controls tested." |
| "PrimeVue was never replaced on the library-covered tasks" | True for L1-L4, but the same paragraph is silent on F1. | B dropped PrimeVue `Message` in 3/3 F1 runs (reported later in the document). |
| "Arm reachability: … ran the CLI in 36/39 web runs. A never referenced or ran it (0/45)." | Verified (70 CLI calls, all arm B). | Stands. |
| Judge row: "in random order" | True (`crypto.randomInt`), but **one verdict per pair** and B was shown first in only 19/45. | No position bias detectable (patch 1 preferred in 17/29 decisive, p = 0.46), but none can be excluded at this n. |
| "F1: … scoring **−1.0 on fit and −1.3 on scope** at 2.2× the cost" | Wrong numbers. Raw scores: A fit 5,5,4 / B 3,3,3; A scope 5,5,5 / B 3,3,3. | F1 fit **−1.67**, scope **−2.00**, cost 2.23×. The report understates its own worst regression. (−0.5 / −0.83 are the F-category deltas; neither matches.) |
| "F1 is the extreme case at **+91%** cost." | +91% is the forms-perf category. | F1 alone is **+123%** ($0.57 → $1.27). |
| "That is pure run-to-run and judge variance, and it is as large as any treatment effect above." | "As large as any" is false. | Control gap −0.17 (N1 −0.33); F1 is −0.47, C4 +0.33. |
| "Read every difference of ±0.3 or less in this report as noise." | Right per task (n=3), too loose for the 45-pair aggregate (±0.10) and it would also dismiss F1's dimensions if applied to overall only. | Per-task ±0.3 is noise (N1 flips sign in the reproduction); aggregate resolution is about ±0.1. |
| "Most of the overhead comes from the agent then doing more" | Unquantified. | Roughly 40% is the guide text itself in context, 60% extra turns/output (my estimate). |
| "Even with all three, the data here suggests the result would be 'cheaper, still neutral'." | Untested prediction presented as a data-backed expectation. | Removing library tasks and F1 from the sample gives overall +0.03 (custom) and F2 +0.20 with wide CIs: unknown, not "still neutral". |
| "The strongest positive signal was F2 image sizing, and the baseline gets that right 1 time in 3 anyway." | n=3. | Baseline got it 2/2 in the reproduction; B's F2 edge there was `srcset`. The F2 preference replicates, the mechanism does not. |
| "Limitations: … n=3 per cell. The judge's noise floor (±0.3 overall…)" | Honest, kept. | Stands. |

**Reproduction `REPORT.md` (generated by the suite)**

| Quote | Problem | What the evidence supports |
|---|---|---|
| "**don't adopt (no measurable benefit)** (heuristic; read the evidence below)" | `recommend()` (`evals/lib/aggregate.mjs:250-278`) returns this for any non-significant result with cost > 10%. With 10 pairs "significant" needs ≥ 9 B wins; power 5-38%. The verdict carries almost no information about quality. | "Cost up; quality comparison underpowered (10 pairs, MDE about 0.5 points)." |
| "Judge: B 5 wins, A 5, 0 ties; mean overall B−A -0.17 vs noise floor ±0.24 (sign test p=1.00)." | Compares a mean of 10 pairs with the mean absolute difference of 5 single pairs (different quantities); no CI; depends on judge (Opus on the same pairs: 4·5·1, −0.29 vs ±0.14, i.e. beyond its floor). 4 of the 10 pairs are B-not-fired. | −0.17 [−0.60, +0.17]; consistent with anything from a large regression to a modest gain. |
| "Cost per run +54% for B." | No CI, 10 vs 10 runs, task mix with 40% F tasks. Not comparable with the original's +39% without re-weighting. | +54.2% [+16%, +91%]; equals the original on the same mix (+54.8%). |
| "Cost per run, non-control tasks +61.3%" | Same. | [+19%, +100%], 4 tasks. |
| Per-task "Checks A / B: 100% / 50%" for C5; "All tasks B 95%"; Notable diffs "Uses container queries (required): A 2/2, B 1/2" | Check false negative on a valid `auto-fill`/`minmax` grid. | B's C5 r1 is a legitimate solution; the judge scored the pair level. Check provenance: stream 3. |
| "modern-web … Fired B 60%" | Denominator includes control runs. | 6/8 where expected (75%), 0/2 on controls. |
| "Agent: … concurrency 4." | `config.json` and the run log say `--concurrency 2` for the agent runs; 4 was the re-judge invocation. `config.json` also still says `judgeModel: claude-opus-5-5` while the report's active judge is Sonnet. | Report setup lines reflect the last invocation, not the one that produced the runs. |
| "Judge noise floor … 5 pair(s) … mean \|overall diff\| 0.24" then "mean difference within the noise floor" | A 5-pair floor decides the "beyond noise" gate; Opus's floor on the same pairs is 0.14. | The gate flips with the judge; treat as indeterminate. |
| "Judge comparison … Same preference: 73%; decisive flips 2/12" | Computed over 15 judgments including the 5 A-vs-A pairs. On A/B pairs only the two judges disagree on N1 r1 and C5 (both pairs). | Fine as a judge-agreement statistic, not as evidence about MWG. |

**`evals/README.md` judge table**

| Quote | Problem |
|---|---|
| "modern-web-guidance reproduction \| 15 \| …" | "Reproduction" and "15 pairs" suggest more than was done: 5 of 15 tasks, 2 of 3 reps, 10 A/B pairs, different judge protocol (2 verdicts, alternating order), extra checks. It is a partial re-run that confirms the cost effect and two per-task effects; it cannot confirm or refute the quality conclusion. |
| "It reached the same verdict on both evals." | For MWG the verdict is one the heuristic emits for almost any costly change at n=10; on the "beyond noise" component the two judges differ (Opus yes, Sonnet no). "Same verdict" is weak evidence that the judges are interchangeable. |
| "0.24 (5 control pairs)" vs "0.14" | Correctly caveated in the text ("too few pairs to separate from chance"). |

#### 4. Verdict

**(a) Cost: robust.** +38.6% [+24%, +55%] on the 15-task set; pooled +37.8% [+24%, +54%]; +44% to +81% on runs where the guidance fires; about +5% when installed but unused. Every task and 48 of 55 pairs are dearer. No confound found in model, effort, order, timing, retries or CLI behaviour. Drop "+39-54%" as a range; cite one estimate with its CI and say the +54% is the same effect on an F-heavy subset.

**(b) Quality: what can and cannot be claimed.**
- Can: on a PrimeVue-first rubric judged from diffs, the net composite effect is −0.04 [−0.14, +0.05] over 45 pairs; a net gain above roughly +0.1 is unlikely. Gates are at ceiling and say nothing. F1 gets worse (A preferred 4 of 5 pooled; fit and scope −1.7 to −3.0) and F2 gets better (B preferred 4 of 5), both replicated in fresh runs with two judges.
- Cannot: "no quality gain", "no upside", "reproduced" (for quality), or anything about rendered behaviour, which nobody measured blind. Cannot claim the guidance is useless for native-platform work: only about 5 of 15 tasks exercised it in a way that changed code, and on those the platform score went up.

**(c) Decision.** "Don't adopt the branch as written for daily use" remains the right call under uncertainty: the cost is certain and paid on every front-end task (including the 4 of 13 web tasks where it can only cost), the net benefit is bounded near zero on the owner's own rubric, and one replicated regression (F1) is larger than the one replicated improvement (F2). The label should be "not shown to pay for itself as routed", not "no benefit".

**Cheapest experiment that could change the decision.** Test the narrowed variant the original report proposes but never ran (fire only for custom UI / CSS / performance / browser APIs the library does not wrap; route feedback primitives through the library), on the tasks where guidance is in play:
- Tasks: C1, C3, C4, C5, C7, F1, F2 plus 2 to 3 new native-leaning tasks with no PrimeVue equivalent (e.g. scroll-driven or view-transition animation, anchor-positioned menu, responsive images/CLS) = about 9 to 10 tasks; keep N1 and one **borderline** control (component unit test or router config) for false triggers; one library task (L2) to confirm the lookup is skipped.
- Reps: 4 per arm → about 40 treated A/B pairs. With pair SD 0.3 that detects about 0.13 on the composite and about 0.25 on a single dimension; the sign rule has about 75% power if B wins 70% of decisive pairs. About 100 runs, roughly $60 to $70 at observed prices plus $5 to $10 of judging.
- Measurement: add outcomes that are not a diff-reading judge and are not at ceiling: browser-rendered checks per task (CLS and LCP on the gallery, overlay not clipped at viewport edge, keyboard open/close and Escape, dark-mode switch persists, axe violations count). The original's `darkcheck.mjs` / `hovercheck.mjs` already do three of these on a subset; run them on every run, blind to arm. Report platform, fit and scope separately rather than only the unweighted mean, and pre-register the composite.
- Decision rule: adopt the narrowed variant if cost overhead on non-library tasks falls under about +25%, no replicated regression remains on F1, and either rendered checks or the judge composite improve with a CI excluding zero.

#### Cross-references to sibling streams

_To be filled from `/tmp/audit/stream3.md`, `stream4.md`, `stream5.md` (not available at time of first draft)._

#### NOT DONE / not verified

- Did not re-run any agent or judge; did not open any app in a browser. The original's browser spot checks (`results/screens/`, dark-mode and hovercard checks) are unverified by me.
- Did not independently verify isolation of the arm homes beyond diffing `.agents` trees and `CLAUDE.md` between the two evals (identical apart from the home path). Stream 5 owns this.
- Guide-text volume and the 40/60 split of the overhead are estimates from tool-result character counts at 4 chars per token.
- Subgroup CIs (platform on custom/forms, non-fired pairs, reproduction non-control) come from a bootstrap over 4 to 9 tasks and are post hoc; they are too narrow and are quoted as calibration, not as findings.


# Stream 7: harder tasks

NOT DONE. Four draft hidden tests with reference and mutant patches are committed under `fixtures/ts-backend/hidden/hard` and `mutants/hard`, unverified and not wired into a task set. No smoke run was made.
