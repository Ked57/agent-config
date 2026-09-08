Type: grilling

# Unique role prose: delete or keep in policy

## Question

Roles, native agents, and orchestration are all leaving, and skills stay unchanged. Some role files carry procedure that no skill already owns:

- Designer: scope modes, `DESIGN.md` rulebook, persona walk, handoff fields, checkpoints
- Planner: checklist-plan output contract
- Manual QA: hands-on scenario report contract (`pass` / `fail` / `blocked`)
- Coder and Reviewer: mostly "load these skills, return this report" — already covered by `implement`, `tdd`, `code-review`

That unique prose will not become a skill. What happens to it?

- **Delete with the roles.** Routing already points at skills for those jobs. Recommendation: keeping the prose in policy recreates a second procedure home, which is the bloat again.
- **Keep in policy.** Move the unique contracts into `policy/` (routing or a leftover coordinator) so coding work still has those report shapes, without roles or skills edits.
