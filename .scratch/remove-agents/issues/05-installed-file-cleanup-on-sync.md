Type: grilling

# Installed-file cleanup on sync

## Question

Users who already ran `init --user` have installer-owned role files and native agents on disk. When those sources leave the repo, should `sync --user` delete the managed copies?

The installer already does ownership-safe removal: a managed agent file is deleted only when the lock is version 2, the file still has the managed marker, and its hash matches the lock. Locally modified obsolete files are preserved and become unmanaged. Unrelated files such as `~/.cursor/agents/custom.md` are left alone. Tests in `tests/native-agents.test.mjs` lock that behavior (including the old orchestrator → manual-qa migration).

Recommended: **yes, use that existing path** for user-install roles and native agents, and the same ownership-safe sweep for project-install `.agents/agents/` copies. [Which agent artifacts are in scope](01-which-agent-artifacts-are-in-scope.md) put both in the deletion. Do not invent a new deletion policy.
