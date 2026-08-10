# agent-config

Private, version-controlled source for the portable parts of a Cursor, Codex,
and Claude Code setup.

## Current contents

- Three MCP servers imported from Cursor: PrimeVue, Figma, and Atlassian.
- A portable PrimeVue launcher which supports an NVM-based Node installation.
- A shared `AGENTS.md` policy and the standard `.agents/skills/` location for
  new cross-client skills.

## Generate client fragments

```sh
node scripts/render-config.mjs
```

This writes `out/` (ignored by Git). Follow the corresponding adapter README to
merge the fragment safely; do not overwrite an existing client config because
it can contain client-managed authentication and unrelated configuration.

## What is intentionally not centralized

Plugins, hook registrations, OAuth credentials, Cursor-managed skills, and IDE
state are client-specific. The repo centralizes the underlying scripts and
portable skill content, then each adapter registers it in its native format.

## Publishing

The current `gh` authentication token is invalid. After re-authenticating,
create and push the private remote from this directory:

```sh
gh auth login -h github.com
gh repo create agent-config --private --source=. --remote=origin --push
```
