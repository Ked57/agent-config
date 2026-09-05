# Orchestrator consensus (20 transcripts)

Weight = how many of the 20 selected transcripts independently teach the practice. Staff-lead / software-factory craft only. Outros, framework shopping lists, and career-road-map fluff dropped. The analyse → split → Planner / Coder / Reviewer graph lives in `~/.agents/agents/orchestrator.md` and `~/.agents/policy/orchestration.md`; this file does not restate it. Apply the practices below *while* following that graph.

Done when every spawned specialist has returned its named artefact, the Reviewer has given `approved`, and the win condition is evidenced (checks, artefacts, running behaviour) rather than claimed.

## Ranked practices

### 1. Isolate each specialist — 12/20

Spawn into a clean window, worktree, or sandbox. The parent keeps the thin routing context. Workers start from the *brief* plus the upstream artefact, not from the parent's dirty session.

- Pocock skills: clear between tickets; review in sub-agents with an empty window because the writer blesses its own diff.
- Sandcastle: each planner / implementer / reviewer / merger run is its own sandbox and branch.
- VS Code: parallel sessions only on non-overlapping files, or a *worktree* so sessions cannot clobber each other.
- Avthar: one Claude session per git *worktree* named after the issue; merge later in a fresh session.
- Lewis factory: isolated git worktree locally; Docker / VM sandbox on a team machine.
- Herk agent teams: teammates wake with no conversation history; they get only the spawn prompt (they still inherit permissions — sandbox the parent).
- scrollypedia: workers are stateless; they do not know about each other; they execute and return a result.
- AI Side Hustle: each sub-agent gets an isolated context window; the top window stays a router. Passing a 100k dirty payload down the chain is a token trap and a game of telephone.
- OpenClaw: AFK / parallel workers need a sandbox; YOLO permissions is the failure mode the sandbox exists to replace.
- Pi-to-Pi: isolated side-by-side agents; coordinate by messages, not by sharing a working tree.
- freeCodeCamp PR reviewer: isolate review agents from the authoring loop.
- HumanLayer factory: the factory is a sequence of isolated agent steps with feedback, not one mega-session.

**Do this:** spawn Planner, Coder, and Reviewer as separate roles with clean context. Parallel Coders each get a *worktree* (or sandbox) and non-overlapping files. Keep the Orchestrator window for routing and artefacts.

### 2. Review in a clean window; judge output, not claims — 12/20

The implementer is a biased reviewer of code it just wrote. Spawn the Reviewer separately. Match the spec and the repo standards. Demand receipts: tests, typecheck, CI, a running surface. Treat green tests written by the implementer as a claim until a second agent (or a human) has checked them.

- Pocock skills: two-axis review in sub-agents — every acceptance criterion against the spec, then against standards.
- Sandcastle: if the implementer committed, run a reviewer (adversarial review can be a different model); merger is a third role.
- Axel: the cheating-agent pattern is broken code plus broken tests that bless it; prompt an *angry* agent to poke holes; seniors drown when they try to line-review 10× junior output.
- Herk: a named QA teammate sends work back; the loop is done when QA passes, not when the builders say they are done.
- Nate B Jones: do not stop at the first plausible draft; keep going until there is something real to inspect (files, logs, tests, renders); make it show receipts.
- freeCodeCamp: a multi-agent PR reviewer modelled on selective senior judgment, with verification gates.
- Lewis: the factory runs tests and the pipeline; juniors and seniors ship through the same checks.
- Avthar: safest merge is PR-per-worktree with review; when merging worktrees, give the merger a way to verify.
- AI Side Hustle: validate at every pipeline stage so an early hallucination cannot cascade.
- Beyond Coding: review load is the new bottleneck; an LLM-as-judge comes *after* humans still own architecture and taste.
- Pi-to-Pi / HumanLayer: factory and peer loops exist to catch slop before it becomes the next agent's input.

**Do this:** after the Coder's implementation report, spawn the Reviewer with the plan, the diff, and the standards — not with the Coder's session. `comments` returns to the Coder; `wrong direction` returns to the Planner. `approved` requires evidence.

### 3. Agent-sized vertical slices with a blocking graph — 11/20

Each spawn is one vertical slice that fits a single *smart zone*. Independent slices run in parallel; blocked slices wait. A horizontal “do the whole layer” brief is the usual mis-size.

- Axel: supervisory work is breaking problems into agent-sized chunks and knowing when to let the agent run.
- Pocock skills: one ticket ≈ one context window; attention dies around ~140k (*smart zone*); clear between tickets; a real spec had 11 session-sized sub-issues.
- Sandcastle: the planner emits only *unblocked* issues; each implementer gets one issue on one branch.
- Herk: three to five teammates; sequential sub-agents if the work is a pipeline with no parallelism.
- VS Code: parallel only when the sessions touch different pieces of the tree.
- Lewis: spec → well-defined tickets the factory can pick.
- Avthar: one issue per worktree.
- scrollypedia: decompose into independent subtasks, then route.
- AI Side Hustle: partition massive work into granular segments; a monolith agent collapses under its own context weight.
- HumanLayer: if the factory emits slop PRs, re-chunk; the unit of work was too big or too vague.
- IBM frameworks: pick sequential vs multi-agent vs hierarchical from whether the work actually parallelises.

**Do this:** split into tickets that one Coder can finish inside one smart session. Put blocking edges on the graph. Fan out only the unblocked set.

### 4. Exact *brief*: role, scope, file owners, named return — 10/20

Teammates inherit no history. The spawn prompt is the whole job. Name the role, the files they own, who they message, and the artefact they must return.

- Herk: goal + named roles + “when done, message X” + defined deliverables (running app, test report, decision doc); each agent owns specific files; three to five teammates, not a swarm of ten.
- Sandcastle: named planner / implementer / reviewer / merger; implement prompt takes issue title, task id, and branch.
- Orchestrator spawn template (already in the role file): task, routing, upstream artefact, return artefact.
- scrollypedia: intent classification, decompose, route, aggregate; workers stay narrow.
- Google ADK: specialised agents with tools, not one agent with every tool.
- AI Side Hustle: think in roles, responsibilities, and interactions; swap a weak verifier for another model.
- Avthar: name the worktree after the issue so ownership is visible on disk.
- Pocock: spec is the destination, tickets are the journey; the implementer is pointed at one ticket.
- Lewis: a plan skill turns a spec into a ticket with a template.
- IBM CrewAI / frameworks: role-based teams when the work needs specialists, a pipeline when it does not.

**Do this:** fill the spawn template so a cold agent can execute. Name the files. Name the return artefact. Cap the live team at a handful of specialists.

### 5. Skills as procedural / institutional knowledge — 10/20

Facts live in RAG; tools live in MCP; *how we do this here* lives in skills. Load name + description first; load the body when the task matches. Put tribal knowledge (incidents, edge cases, “what a senior would know”) into skills so it is not trapped in one person's head.

- IBM skills: skills are procedural memory; progressive disclosure in three tiers (index → body → scripts/refs); a hundred skills stay cheap if only metadata is always-on.
- Pocock skills: short, mostly user-invoked descriptions; the whole set ~660 tokens of context load; project skills so the team shares one playbook.
- Axel: an agent subconscious — incident knowledge graph, undocumented edge cases; without it the agent restarts the server six times.
- Nate B Jones: a correction in chat is a one-off; the same correction turned into a skill compounds.
- OpenClaw: the agentic loop plus skills as the repeatable how.
- Lewis / Avthar: tiny project skills (plan, update-docs, cleanup-worktrees) for the factory's repetitive steps.
- AI Side Hustle: skills are extreme context compression — a cheat sheet, not a 100k dump.
- Beyond Coding: standardise learnings into skills repos so judgment is not only in tribal heads.

**Do this:** point spawned roles at the skills they need. Do not dump every skill into the worker. When a miss is institutional (outage lore, review standard), encode it as a skill, not as more prompt prose.

### 6. Handoffs are artefacts; verify at the boundary — 9/20

Pass a spec, a ticket, an implementation report, a verdict — not a 100k dirty window. Each worker validates incoming data against its own knowledge rather than trusting the previous agent's story. Semantic failure looks well-formed and is wrong.

- Pocock: compress a 46k grilling session into a spec, then tickets; later sessions start from those files.
- scrollypedia: the most overlooked failure is semantic failure; verification at every handoff; cascading hallucination is agent A inventing a policy that agent B treats as fact.
- AI Side Hustle: shared state (whiteboard / docs / log) instead of shipping the whole database slice on every hop; sequential pipelines require inter-stage validation.
- Herk: if work is getting lost, write it to a file the next teammate can read.
- Nate B Jones: the thread owns the job; sub-agents handle contained pieces so the main thread is not buried in noise; proof that it is done is part of the assignment.
- Lewis: the ticket is what the isolated worker reads.
- IBM orchestration: coordination is the meal — components only work when timing and handoff are designed.
- Pi-to-Pi: two-way messages still need a shared artefact so the best information can win.

**Do this:** the only thing a spawn receives as *upstream* is the artefact named in the role file (plan, implementation report, prototype findings, review verdict). Validate it before acting on it.

### 7. Re-plan versus iterate is a verdict, not a vibe — 9/20

Comments on a sound plan return to the Coder. Wrong direction returns to the Planner. Blurry or risky work fans out as prototypes *before* the main plan. A sequential pipeline does not need a team. Kill a specialist that has left the *brief*.

- The graph already encodes: `comments` → Coder; `wrong direction` → Planner; blurry → prototype fan-out.
- Herk: if the process is strictly 1-2-3 with dependencies, use sequential sub-agents, not a team; shut down a teammate that is going the wrong way and save work first.
- Pocock: if a question needs a runnable answer, prototype; if the work fits one smart zone, skip spec/tickets and implement; otherwise spec then tickets.
- Sandcastle: planner first, then unblocked implementers.
- IBM frameworks: sequential workflows vs a team of agents vs production orchestration — pick from the shape of the work.
- HumanLayer: slop output means re-chunk and re-plan, not another hopeful iterate.
- AI Side Hustle / scrollypedia: sequential, concurrent, or hierarchical from whether stages must wait, can fan out, or need supervisors.
- Axel: fix bad output by rewriting the prompt / spec, not by hand-editing the generated code as the default move.
- Agentic AI Institute: long-running (15-hour) tasks still need a previewable prototype before you bet the factory on them.

**Do this:** read the Reviewer verdict. Iterate in the Coder when the plan is still right. Re-plan when the direction is wrong. Prototype when the plan is not yet knowable.

### 8. The *win condition* is verified, not “looks done” — 10/20

Done is a running app, ticked spec boxes, green checks the Orchestrator can name, and an `approved` verdict with evidence. A plausible summary is not done.

- Pocock: implement runs typecheck, build, and extra verification, then spec+standards review; compare the result to the spec.
- Herk: the goal names a running localhost app plus a pass/fail QA report plus a decisions doc.
- Sandcastle: merger runs type checks, merges, and closes the issue with a comment — the backlog item is the completion record.
- Nate B Jones: assign a goal, sources, a standard, a permission boundary, and the proof that it is done; keep going until there is something to inspect.
- Axel: a test suite that catches hallucinations is the product; code is dispensable.
- Lewis: everyone ships through the same pipeline.
- freeCodeCamp: verification gates in the reviewer architecture.
- Avthar: give the merge agent a verification step.
- Agentic AI Institute: preview the prototype; confirm it matches the extended spec.
- IBM OpenClaw / orchestration: the loop ends when the environment shows the outcome, not when the model says it is finished.

**Do this:** stop only when the plan boxes are ticked, the quality gates named in the plan have been run, the Reviewer has `approved` with evidence, and any unverified item is reported as blocked.

## Compact sources

| # | id | title | channel | ok | chars |
|---|----|-------|---------|----|-------|
| 1 | h0hdaHPKDdI | What 6 months of AI coding did to my dev team | Axel Molist | yes | 14352 |
| 2 | M6mYodf0dJM | mattpocock/skills: A complete AI Coding workflow, end-to-end | Matt Pocock | yes | 19262 |
| 3 | Lg-meK5IU8Q | What AI Agent Skills Are and How They Work | IBM Technology | yes | 8651 |
| 4 | vDVSGVpB2vc | How to Build Claude Agent Teams Better Than 99% of People | Nate Herk \| AI Automation | yes | 22309 |
| 5 | L7FF8Zgab3M | What is OpenClaw? Inside AI Agents, LLMs and the Agentic Loop | IBM Technology | yes | 10607 |
| 6 | E5-QK3CDVQM | I Open-Sourced My Own AFK Software Factory | Matt Pocock | yes | 13162 |
| 7 | J5KTpq7hVn4 | Multi-agent workflows in VS Code | Visual Studio Code | yes | 5170 |
| 8 | xqGCbEDbny8 | Codex Tutorial: Build Your First AI Agent Delegation Loop | Nate B Jones | yes | 21342 |
| 9 | ZVPlLaehjLk | Agentic AI Frameworks Explained | IBM Technology | yes | 9229 |
| 10 | iqRcGCah0Kw | System Design for AI Agents – Building a Multi-Agent PR Reviewer | freeCodeCamp.org | yes (truncated) | 167785 |
| 11 | AbpyqAfxZ8c | I Built an Agentic Software Factory with Codex and Claude Code | Owain Lewis | yes | 25550 |
| 12 | PIdETjcXNIk | Pi to Pi: Two-Way Agent Orchestration with the Pi Coding Agent | IndyDevDan | yes | 38367 |
| 13 | tGbjIvvYuHE | How to Build a Software Factory for AI Coding Agents | Boundary / HumanLayer | yes | 76793 |
| 14 | aVVA3gP3M9U | How New Staff Engineers Build Judgment Without Years of Experience | Beyond Coding | yes | 42301 |
| 15 | 0Z0GUDakR_A | Intro to multi-agent systems with ADK | Google Cloud Tech | yes | 10964 |
| 16 | tNQPNBQC5kg | Build, Reuse, or Hybrid? How Orchestration Powers Agentic AI | IBM Technology | yes | 4449 |
| 17 | EtSO9vU84ws | Multi-Agent Orchestration Explained: From Patterns to Production | scrollypedia | yes | 10701 |
| 18 | B8kSsEDk0TQ | My Multi-Agent Claude Code Setup (steal my workflows!) | AI with Avthar | yes | 43892 |
| 19 | w_pAU0jur_4 | Why 2026 Is the Year of AI Builders (Agents, Orchestration & 15-Hour Tasks Explained) | Agentic AI Institute | yes | 48971 |
| 20 | GCd4Ft4tcMA | Multi-Agent Orchestration: The #1 Skill AI Engineers NEED in 2026 | AI Side Hustle | yes | 27799 |

Fetch: 20/20 `ok`. Rank 1 timed out once and succeeded on retry. Rank 10 speech is complete enough for the practices above, then cuts off mid-outro. Ranks 15–16 are short product / analogy explainers; they contribute specialised-agent routing and “coordination is the work,” little else.
