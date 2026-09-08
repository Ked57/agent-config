# Cursor adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

The installer creates a local Cursor plugin under
`~/.cursor/plugins/local/agent-config/`. Its always-on rule tells Agent Chat to load
`~/.agents/AGENTS.md`, whose "Start here" step routes through
`~/.agents/policy/routing.md`. Coding tasks are done with the routed packs and skills;
after implementation, shared policy requires `manual-qa` when a runnable surface
changed. Restart or reload Cursor after the first installation.
Cursor repository rules remain more specific and take precedence. Cursor Tab and Inline
Edit do not consume Agent Chat user rules.

For Cursor Cloud Agents, add an account-level User Rule that tells the agent to read
`~/.agents/AGENTS.md`, then run the user installer from a personal saved environment.
Cursor documents User Rules—not VM-local plugin discovery—as the cross-repository cloud
mechanism. See `cloud-agent-install.md` for the exact rule and setup script.

Use project-scoped installation only when the team wants the guidance committed:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

This creates `.cursor/rules/00-agent-config.mdc`, a thin bridge to the workspace
`AGENTS.md`. The always-installed routing pack and the shared TypeScript, React, domain,
and Vue/PrimeVue conditional policy packs live under `.agents/`, so Codex, Claude Code,
and Cursor follow the same source of truth. These repository files are intended to be
committed.

## Skills

This installer does not write native Cursor agent files. Procedures live in
`~/.agents/skills/<name>/SKILL.md`. Edit the corresponding source under `skills/`, then
run `node bin/agent-config.mjs sync --user --dry-run` to inspect the changes before
syncing. See [Cursor subagents](https://cursor.com/docs/subagents) if you register a
native Cursor agent yourself.
