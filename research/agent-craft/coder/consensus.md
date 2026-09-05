# Coder consensus (20 transcripts)

Weight = how many of the 20 selected transcripts independently teach the practice. Only implementer practices. Outros, tool marketing, and career-advice fluff dropped. Routing and spawn rules live in `~/.agents/policy/routing.md` and `~/.agents/policy/orchestration.md`; this file does not restate them.

Done when every plan box is ticked or blocked, required checks are green, and the diff stays inside the plan.

## Ranked practices

### 1. Plan, then code — 15/20

Explore the repo, reach a shared understanding, and lock a plan (or destination spec plus tickets) before the first edit. Course-correct in the plan. Jumping straight to generation produces the wrong change in the wrong place.

- Claude official: explore → plan → code → commit; plan mode cannot edit files; review the plan before any write.
- Zhang: plan mode before a single line; skip it and you debug the wrong problem for an hour.
- Pocock (workshop, skills, real feature): grill until the design tree is walked; PRD is the destination; tickets are the journey; then implement.
- Kun Chen: clarify requirements in the planning artefact; start building only after that.
- JS Mastery (both build videos): specs first, architecture defined, every feature planned before building.
- Coding Sloth: plan mode for large tasks (not typos).
- freeCodeCamp: generate, review, fix; Code Rabbit Plan before code.
- Tech With Tim app tutorial: review the plan before building.

**Do this:** load the checklist plan; if a box is underspecified, stop and get it specified. Implement the approved boxes in order.

### 2. Keep a lean onboarding file — 11/20

`CLAUDE.md` / `AGENTS.md` is the onboarding doc a new engineer would get: what the project is, where things live, how to run tests/build/lint, conventions. Agents have no memory across sessions.

- Zhang: `/init`; keep it 100–200 lines; more dilutes the signal.
- Kun Chen: global memory tiny (personal prefs); project file holds learned corrections; move conditional procedure into skills (progressive disclosure).
- Tech With Tim (beginner + advanced): put stack, commands, conventions in the root file; update it when a correction should stick.
- Claude official: when the same mistake repeats, save the fix in the project file.
- AI Master: skip this file and every session starts from zero.
- Pocock skills tutorial: the always-on file holds pointers to issue tracker and domain docs, not the whole playbook.

**Do this:** read the project onboarding file before the first edit. Encode only what every session needs. Put repeatable procedures in skills, not in the always-on file.

### 3. Run the validation loop after every edit — 9/20

Tests, typecheck, lint (and UI evidence when the change is visual) are the source of truth. The agent cannot tell done from “I think it’s done” without them. Quality of the feedback loop is the quality ceiling.

- Zhang: hooks after every save — build, tests, typecheck; failure is a blocker, not a note.
- Pocock: TDD plus `npm test` / typecheck on every slice; without feedback loops the agent codes blind.
- Claude official: a test suite the team trusts; Claude validates continuously; false-positive tests are worse than none.
- Coding Sloth: tests, types, linters, and browser/screenshots for UI; write the test first so the agent cannot bless its own code.
- Kun Chen: end-to-end against real user behaviour; lint before the PR; pipeline evidence (screenshot, log) that the change works.
- freeCodeCamp: verify AI output; tests as concrete goals; automated review as a second loop.
- Pocock real-feature: tests and types on every Ralph commit.

**Do this:** after each plan box, run the repo’s mapped checks for the files you touched. Red means the box is not done. Green is the completion criterion.

### 4. Review in a fresh context before merge — 8/20

The author session will not find its own slop. Review against the spec and the standards in a clean window, then a human holds the quality bar.

- Claude official: sub-agent reviewer before commit.
- Pocock skills: implementer is a bad reviewer of code it just wrote; spawn a reviewer with empty context; check acceptance criteria against the spec.
- Kun Chen: adversarial review in an isolated worktree; low-risk diffs can skip line-by-line reading once the pipeline has evidence; high-risk diffs get human time.
- Zhang: plan → execute → review before merge.
- DevOps Toolbox: dedicated code-review sub-agent (read, don’t write).
- freeCodeCamp: Code Rabbit (or equivalent) on the PR; human still owns architecture and security.

**Do this:** when the plan boxes are implemented, run review in a new session (or sub-agent) against the plan and the repo standards. Fix what it finds. Then stop.

### 5. One small, reviewable slice per session — 8/20

Size work to the smart zone. Vertical slices (schema + service + a visible UI bit) beat horizontal layers. A 15-file diff that breaks three things is un-debuggable; a two-file diff that breaks one is a five-minute fix.

- Pocock: keep tasks inside the smart zone (~100k); vertical / tracer-bullet slices; independently grabbable tickets with blocking edges.
- Skills tutorial: one ticket ≈ one context window; clear between tickets.
- Zhang: small steps, tighter diffs.
- Coding Sloth: new session per task; a medium task already burns 50k+.
- Nate Herk: bound the scope and name the deliverable before a wide parallel job.

**Do this:** implement one plan box (or one ticket) per session. Finish its checks. Clear. Next box.

### 6. Clear context between boxes — 6/20

A filled window gets dumber. Compacting mid-task is dementia. A new session with the onboarding file plus the current ticket is the stable start state.

- Pocock workshop: prefer clear over compact; compact is a written history you cannot trust as much as a fresh start.
- Zhang: `/clear` after every finished task.
- Coding Sloth: new session per task; if the harness auto-compacts, start over.
- Skills tutorial: clear between tickets so the implementer is not precious about its own last diff.

**Do this:** when a box is ticked and checks are green, clear. Start the next box cold.

### 7. Red-green for new behaviour — 6/20

Write one failing test at the interface, then the code that makes it pass. Tests written after the implementation bless the implementation.

- Pocock: TDD is the most consistent quality lever; one failing test, then make it pass; test at module boundaries, not every tiny function.
- Coding Sloth: test the important behaviour first; covering every line is bloat.
- freeCodeCamp: tests first, then implement to pass them.
- Real-feature video: the AFK loop is prompted to add tests with the change.

**Do this:** for each new-behaviour box, get a test red on the intended interface, then green, then refactor only if the plan asks.

### 8. Isolated worktrees for parallel work — 5/20

Two agents in one working tree fight. A worktree per session (or per ticket) keeps diffs mergeable.

- Kun Chen: Treehouse / `git worktree`; never two writers in one directory.
- Zhang: worktree per feature branch; review then merge.
- Coding Sloth: every chat is a worktree.
- DevOps Toolbox: Worktrunk for PR/issue sessions.
- Pocock: sandbox + worktree for AFK implementers.

**Do this:** if the brief is one of several parallel boxes, work in an isolated tree. Do not share an uncommitted working directory with another agent.

### 9. Keep a handle on the code — 6/20

Specs-to-code without reading the diff is vibe coding. Architecture, security, and module shape stay human decisions. The agent implements the how inside the agreed interfaces.

- Pocock: specs-to-code failed; the code is the battleground; design deep modules and test at their interfaces; QA is where taste re-enters.
- freeCodeCamp: AI speeds implementation; you decide what and why; never ship hardcoded secrets, string-built SQL, or disabled auth.
- JS Mastery: a system (spec + architecture + direction) is what makes output shippable; prompt-and-pray is generic by the third feature.
- Coding Sloth: if you cannot work when the agent is rate-limited, you already lost the codebase.

**Do this:** implement inside the plan’s interfaces. Leave architectural and security choices to the plan. After the loop is green, the change is still subject to review.

### 10. Encode the repeatable implement path as a skill, not as always-on prose — 8/20

Grill / TDD / implement / review are playbooks. Load them when the box needs them. Do not install a hundred random skills.

- Pocock: short, user-invoked skills; treat the agent as a competent hire with no memory.
- Kun Chen: evaluate skills; popularity ≠ quality; progressive disclosure.
- Zhang: a skill is a multi-step playbook; a slash command is one shot.
- Coding Sloth: one coherent skill family; skip the rest.

**Do this:** when the brief is a ticket, load `implement` and `tdd` (or `diagnosing-bugs` for a repro). Do not pull unrelated playbooks.

## Sources

| Rank | Title | Channel | Date | URL | Transcript ok? |
|------|-------|---------|------|-----|----------------|
| 1 | Full Walkthrough: Workflow for AI Coding — Matt Pocock | AI Engineer and Matt Pocock | 2026-04-24 | https://www.youtube.com/watch?v=-QFHIoCo-Ko | yes |
| 2 | How Senior Engineers Actually Build With AI in 2026 \| Build a Full Stack Systems Architecture App | JavaScript Mastery | 2026-05-01 | https://www.youtube.com/watch?v=14RP8liACqo | yes |
| 3 | L8 Principal's Agentic Engineering Workflow | Kun Chen | 2026-06-20 | https://www.youtube.com/watch?v=iQyg-KypKAA | yes |
| 4 | The Best Local Agentic Coding Workflow (Complete Guide) | Web Dev Simplified and Kyle Cook from Web Dev Simplified | 2026-05-12 | https://www.youtube.com/watch?v=UngVdAsQEiU | yes |
| 5 | 5 Claude Code skills I use every single day | Matt Pocock | 2026-03-16 | https://www.youtube.com/watch?v=EJyuu6zlQCg | yes |
| 6 | The Explore → Plan → Code → Commit workflow in Claude Code | Claude | 2026-05-17 | https://www.youtube.com/watch?v=xJQuF02NAK8 | yes |
| 7 | mattpocock/skills: A complete AI Coding workflow, end-to-end | Matt Pocock | 2026-07-16 | https://www.youtube.com/watch?v=M6mYodf0dJM | yes |
| 8 | I Have Spent 1000+ Hours With Claude Code. This Is What I Learned | The Coding Sloth | 2026-08-17 | https://www.youtube.com/watch?v=YAsxyoTWFDA | yes |
| 9 | FULL Claude Code Tutorial for Beginners in 2026! (Step-By-Step) | Tech With Tim | 2026-03-29 | https://www.youtube.com/watch?v=qYqIhX9hTQk | yes |
| 10 | My Opencode Workflow As A Senior Engineer | DevOps Toolbox | 2026-03-13 | https://www.youtube.com/watch?v=UhRGHr7pgnU | yes |
| 11 | How to Build an AI Agent with Claude Code (Claude AI Agent Tutorial) | AI Master | 2026-06-30 | https://www.youtube.com/watch?v=bcM9dP_uXJU | yes |
| 12 | The Ultimate Claude Code Guide \| MCP, Skills & More | Tech With Tim | 2026-04-13 | https://www.youtube.com/watch?v=uogzSxOw4LU | yes |
| 13 | How to Build Mobile Apps with Claude Code: Full Course (2026) | Nick Saraev | 2026-05-11 | https://www.youtube.com/watch?v=BMMcmmnjrM8 | yes |
| 14 | AI-Assisted Coding Tutorial – OpenClaw, GitHub Copilot, Claude Code, CodeRabbit, Gemini CLI | freeCodeCamp.org and Beau Carnes | 2026-03-31 | https://www.youtube.com/watch?v=wlpBCazAY9Q | yes (truncated) |
| 15 | The Best LOCAL Agentic Coding Workflow (Complete Guide) | Tech With Tim | 2026-06-10 | https://www.youtube.com/watch?v=hfba9dAT6xE | yes |
| 16 | How I use Claude Code (Senior Software Engineer Tips) | Maddy Zhang | 2026-04-05 | https://www.youtube.com/watch?v=MzhIr7BfpI0 | yes |
| 17 | Building a REAL feature with Claude Code: every step explained | Matt Pocock | 2026-03-18 | https://www.youtube.com/watch?v=hX7yG1KVYhI | yes |
| 18 | How Senior Engineers Actually Build with AI in 2026 \| Build a Full Stack Job Applications Platform | JavaScript Mastery | 2026-06-06 | https://www.youtube.com/watch?v=9dKA2hq4vf0 | yes |
| 19 | How to Build an App With Claude Code - Full Tutorial for Beginners | Tech With Tim | 2026-05-06 | https://www.youtube.com/watch?v=GUgxx6fMiR8 | yes |
| 20 | Claude Code Dynamic Workflows Clearly Explained | Nate Herk \| AI Automation | 2026-05-30 | https://www.youtube.com/watch?v=jZgcWCzxh1I | yes |

Ranks 4 and 15 are local-model setup guides; they contribute little to the implementer practices above. Rank 20 is harness-feature taxonomy (skills vs sub-agents vs workflows); the usable residue is “bound the scope.” Rank 14 fetched complete enough speech for the practices above, then cut off mid-demo.
