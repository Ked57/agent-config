---
name: codex-review
description: >-
  Run a read-only Codex review of the current branch's diff against
  origin/main. Use when the user asks for a Codex review of the branch. The
  parent delegates to the Cursor subagent codex-review, which runs Codex.
---

# Codex review

Review the current branch against `origin/main`. Challenge the approach, the
assumptions it depends on, and the ways it fails under real conditions. Do not
change the tree, and do not turn the review into a style pass.

## Parent

Do not run Codex in this turn. Launch one subagent with `subagent_type`
`codex-review`. Its prompt is: follow the Subagent section of
`~/.agents/skills/codex-review/SKILL.md`. If that subagent is not registered,
launch one general-purpose subagent with the same prompt. Return the
subagent's final message verbatim. Do not summarize it, and do not fix
findings.

## Subagent

You supervise one Codex run. Do not inspect the diff yourself, edit files,
commit, or launch another subagent.

From the repository root, confirm the base exists:

```bash
git rev-parse --verify origin/main
```

If that fails, stop and say that `origin/main` is missing. Do not fetch.

Then run Codex once. Close stdin so it does not wait for more input. Keep the
sandbox read-only. Append one focus sentence to the prompt only when the user
named a focus.

```bash
codex exec --sandbox read-only --ephemeral --color never --model gpt-6.1-sol \
  "Review the git diff origin/main...HEAD, this branch's changes only. Break confidence in the change. Question the chosen approach, the assumptions it depends on, and where it fails under real conditions. Prioritize auth and trust boundaries, data loss, partial failure, races, empty or degraded behavior, and compatibility hazards. Report only material findings you can defend from the diff and the code it touches. For each finding state what can go wrong, why this path is vulnerable, the likely impact, and a concrete change that reduces the risk. Skip style and naming. If you cannot defend a material finding, say the change looks safe to ship. Do not modify any files." \
  </dev/null
```

Return the command's stdout verbatim, including a non-zero exit and its output.
Do not retry with a wider sandbox.
