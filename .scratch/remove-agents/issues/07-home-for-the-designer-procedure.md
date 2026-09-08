Type: grilling
Status: closed
Blocked by: 02

# Home for the Designer procedure

## Question

The Designer role just landed (merged PR "feat: add designer agent from recent AI-design YouTube sources"). Its unique procedure is not a thin skill wrapper: scope modes, `DESIGN.md` rulebook, persona walk, handoff fields, checkpoints.

`frontend-design` already owns original visual direction without a supplied spec; `figma-design-to-code` owns an exact spec; routing already sends original UI to Designer via orchestration.

Once [Fold roles into skills or replace one-for-one](02-fold-roles-into-skills-or-replace-one-for-one.md) is answered, where does that unique procedure live?

- **Absorb into `frontend-design`**, which is the recommendation if we fold: one skill, one home, routing stops spawning Designer.
- **Sibling skill** (for example `product-design`) if `frontend-design` should stay the smaller "make production UI" recipe.
- **Keep the Designer role** — out of destination unless the mapping ticket reopens scope.

This ticket does not reopen whether agents stay; it only places the procedure.

## Out of scope

Closed off the route. Skills are unchanged, so the Designer procedure does not get a skill home. Whether unique Designer prose is deleted with the role or kept in policy is fog until artifact scope is known; it is not this ticket.
