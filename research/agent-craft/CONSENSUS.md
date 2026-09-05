# Weighted consensus (Mar–Sep 2026 transcripts)

Counts are “how many of the role’s top-20 transcripts argued this,” not view
sums. Higher count → earlier in the matching `agents/<role>.md` Craft list.

## Across roles

- Plan before code; course-correct in the plan (Claude official, Zhang, Pocock,
  Kun Chen, GritAI, harness engineering).
- Tests as the source of truth; watch them go red (Pocock TDD, Sandcastle,
  Zhang hooks, Crema “zero tests”, Axel cheating-agent).
- Fresh-context review: the author will not find their own slop (Pocock
  skills tutorial, Sandcastle reviewer, Lewis sub-agent).
- Specification / intent quality now dominates typing speed (Axel, Lopopolo,
  IBM SDLC, Crema expert-in-the-loop).

## Coder

Explore-plan-code-commit; red-green per box; self-check loop; small diffs;
clear context between boxes.

## Orchestrator

Agent-sized vertical slices + blocking graph; isolated workers; progressive
skill load; spec as product; sandbox AFK rather than YOLO.

## Planner

Grill the design tree; destination then journey; explicit done checks;
durable spec; plan for reviewable blast radius.

## Reviewer

Distrust green AI diffs; Spec+Standards then risk; layered review with a
human on architecture and runtime; ambitious structure with grouped
must-fix; catch tests that bless broken code.
