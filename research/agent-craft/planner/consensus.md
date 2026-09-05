# Planner consensus

Mandate: turn the brief into the smallest executable plan that a coder can run without guessing. *Grilling* first. Boxes with *completion checks* second. Open questions listed, never filled in by assumption.

Weight = how many of the 20 transcripts independently teach the move. System-design lectures (01, 06, 07, 11, 12) count only for planning habits, not as a component catalog. Video 17 is agent-orchestration patterns: take exit conditions and disagreement-as-uncertainty; skip the demo stack. Current selected-20 has no interior-design or career-cert videos (those candidates were dropped before fetch).

## Weighted craft

### 1. Grill the brief until the next step is obvious (11)

03, 04, 05, 06, 09, 10, 11, 13, 15, 17, 20

Spend most of the planning budget on the problem and the live codebase. Interview: who it is for, what success looks like in numbers, what this must not do, what already exists that could be reused. Name every assumption. Write the leftover unknowns as an open-questions list.

Done when: every vague word in the brief is either a number, a non-goal, or an open question; the coder would not have to invent a product decision.

### 2. Ship numbered boxes, each with a completion check (7)

02, 04, 05, 08, 09, 13, 15

One box = one change, the files it touches, and the check that proves it done (test, QA step, screenshot, lint). Persist the plan in markdown so remaining steps survive a fresh session. Specs first, then implementation: a locked plan makes execution mechanical.

Done when: every box has a binary check; no box is a vibe phase like "build the dashboard."

### 3. Write the HLD/RFC that removes uncertainty (6)

02, 03, 08, 14, 15, 20

Context in one short paragraph. Goals and **non-goals**. Design overview, then detail (data flow, components, tech). Alternatives considered, including *do nothing*. Cross-cutting (security, privacy, observability) in a few lines. Implementation phases only when rollout is staged. Keep pages living and linked to pillars; monument GDDs rot.

Done when: after reading the doc, next steps are obvious for the coder and for review, and the defining decisions are named with downsides.

### 4. Quantify, then justify every new box from a constraint (6)

01, 06, 07, 11, 12, 15

Translate "fast / many users / reliable" into P95, RPS, nines, growth window. Start with the fewest moving parts that meet those numbers. Name the constraint a cache, replica, queue, or extra service answers. Access patterns before schema or store choice. System-design ingredients (APIs, caching, load balancing) enter the plan only as tradeoffs attached to a requirement, never as a default architecture.

Done when: each added component cites a number or a failure mode; "do nothing" was a considered option.

### 5. Spec small, well-defined units; surface unstated decisions (5)

02, 04, 08, 10, 13

A unit is one focus session: goal, design decisions, dependencies, checklist. Handing a frontier model an e-commerce platform dumps requirements/design into code. Write non-functional requirements (timeouts, retries, parse-at-the-edge) so the coder cannot invent them. Course-correct in the plan, before files change.

Done when: every decision the coder would otherwise guess is written, or listed as an open question for a human.

### 6. Pre-mortem the plan (5)

05, 06, 13, 15, 20

Ask what could go wrong; how you would guarantee failure; what data you cannot lose; what happens if a dependency dies or traffic spikes. Attach a verification path to the plan (how the coder, or the agent, proves the box). Disagreement among options is a signal of genuine uncertainty, not a prompt to pick a winner silently.

Done when: each serious failure mode has a box, a mitigation, or an open question.

### 7. Draw C4 context + container, labeled, at the right altitude (4)

06, 07, 15, 16

State the altitude: HLD (components, data flow, tradeoffs) vs LLD (classes). C4: system context and containers earn their keep; component/code diagrams age with every commit. Put technology on the diagram. Label boxes and arrows (protocol, direction). Shared vocabulary beats pretty notation. Collaborative sketching beats an AI dump of unlabeled boxes.

Done when: a new teammate can point at the change on the diagram and see which containers move.

### 8. Ranges, spikes, tracer bullets; cut scope when time is fixed (4)

03, 09, 18, 19

Give a high-confidence range, not a point date. When the cone is too wide, buy information with a time-boxed spike. When the date cannot move, cut scope (iron triangle: time, scope, quality). Use a *tracer bullet* or a throwaway prototype when a UI or design question is cheaper to see than to specify. Humans keep the why; models generate options.

Done when: the plan either has a range plus the spike that would narrow it, or a scoped-down v1 with named cuts.

## Sources

| # | id | use |
|---|----|-----|
| 01 | C842vFY5kRo | Start simple; seniors design from rough requirements |
| 02 | 14RP8liACqo | Specs first; RFC/context files; unit checklists; non-goals |
| 03 | iQyg-KypKAA | Clarify/visualize before build; evidence over diff-reading |
| 04 | xJQuF02NAK8 | Explore → plan → code → commit; tests as source of truth (thin) |
| 05 | KWrsLqnB6vA | Plan mode; interview; verification loop |
| 06 | SE2KF-vxvS0 | Five questions before drawing; F vs NFR; HLD altitude |
| 07 | Qa-7iWxDz1A | Architecture as sequenced tradeoffs; delay extra boxes |
| 08 | am_oeAoUhew | Tickets + written NFRs + QA plans; review the plan if you use one |
| 09 | hX7yG1KVYhI | *Grilling*; ubiquitous language; PRD → issues with acceptance |
| 10 | 4wMRXmLpdA8 | Spec-driven small tasks; unstated decisions |
| 11 | vOn6wUcOXzI | Clarifying-question framework (planning habit only) |
| 12 | uy2yom0AlhA | Name the constraint a data feature answers |
| 13 | FoRIj5qcslg | Plan.md tracker; "what assumptions / what could go wrong" |
| 14 | 3rUsUExrLHw | Living docs linked to pillars; record Q&A on the page |
| 15 | Hy8Hvg9BY8w | HLD template; non-goals; alternatives; pre-mortem |
| 16 | sfqHggWY5Ds | C4 context+container; labeled tech; collaborative |
| 17 | 0fH-tWLvDC4 | Structured deliberation; exit conditions; disagreement = uncertainty |
| 18 | horhFvQN3RQ | Humans navigate tradeoffs; fitness-for-purpose |
| 19 | ybr7O3Fog3k | Cone of uncertainty; ranges; spikes; iron triangle |
| 20 | SfSLzsqq0qo | Dump then structure; grill objections and weak assumptions |
