# agent-config

Public, version-controlled source for portable coding-agent configuration shared by
Cursor, Claude Code, and Codex.

## What it provides

- A concise shared completion, verification, safety, and anti-slop policy.
- Conditional TypeScript, React, Vue + PrimeVue, and DDD domain-module policy packs shared by all harnesses.
- Portable skills for distinctive frontend design, high-fidelity Figma implementation,
  complexity audits, deterministic full-stack TypeScript quality tooling, and Matt Pocock's
  engineering and productivity workflows.
- A user installer that gives Cursor, Claude Code, and Codex the same personal policy
  without changing application repositories.
- An optional workspace installer that detects npm, pnpm, Yarn, or Bun; creates thin
  client bridges and portable skills; and seeds a project-owned verification routing map.

## Install for your user

Run once on each machine:

```sh
node bin/agent-config.mjs init --user
```

This creates or updates:

```text
~/.codex/AGENTS.md                         canonical personal policy (managed block)
~/.claude/CLAUDE.md                       Claude bridge to the canonical policy
~/.cursor/plugins/local/agent-config/     Cursor plugin with an always-on bridge rule
~/.agents/skills/<portable-skill>/
~/.claude/skills/<portable-skill>/
~/.agent-config/agent-config.lock.json
```

Existing Codex and Claude instructions outside the managed blocks are preserved.
Standalone generated files are updated only when the user lock proves ownership, and
the installer refuses to write through symlinked targets. Restart or reload Cursor after
the first installation so it discovers the local plugin.

```sh
node bin/agent-config.mjs sync --user
node bin/agent-config.mjs status --user
node bin/agent-config.mjs check --user
```

For persistent remote environments, use [cloud-agent-install.md](cloud-agent-install.md).

## Optional: install into a workspace

From this repository, run:

```sh
node bin/agent-config.mjs init --project ~/dev/my-webapp
```

The installer scans actual project source before creating conditional policy packs:

```text
.agents/policy/typescript.md               only when TypeScript source exists
.agents/policy/react.md                    only when React source exists
.agents/policy/vue-primevue.md             only when Vue source exists
.agents/policy/domain-module.md            only when the four-file convention exists
```

It then creates or updates the shared files below:

```text
AGENTS.md                                  concise shared policy + conditional pack index
CLAUDE.md                                  thin Claude Code bridge to AGENTS.md
.cursor/rules/00-agent-config.mdc          thin Cursor bridge to AGENTS.md
.agents/policy/typescript.md               TypeScript work, when detected
.agents/policy/react.md                    React work, when detected
.agents/policy/domain-module.md            domain work, when the convention is detected
.agents/policy/vue-primevue.md             Vue work, when detected
.agents/skills/<portable-skill>/
.agents/agent-config.json                  project-owned command/routing map
.agents/agent-config.lock.json
.prettierignore                            managed ignore block for generated guidance
```

`AGENTS.md` and `CLAUDE.md` are updated only inside explicit managed blocks. If a
workspace already has unmanaged instructions, the installer preserves them and asks
for a manual merge instead of overwriting them. Conditional packs are installed only
when matching source code or the domain convention is detected, and the installer
refuses to modify managed targets reached through symlinks.

## Sync, inspect, and validate a workspace

```sh
node bin/agent-config.mjs sync --project ~/dev/my-webapp
node bin/agent-config.mjs status --project ~/dev/my-webapp
node bin/agent-config.mjs check --project ~/dev/my-webapp
```

Project agents read `.agents/agent-config.json` directly to identify the verification
commands relevant to their changed files. `check` validates this file's structure,
command references, managed content, and lock ownership metadata.

## Portable skills

The installer copies every `skills/<name>/` directory that contains a `SKILL.md`. That
includes this repository's frontend and quality skills, plus Matt Pocock's skills
vendored from [`mattpocock/skills`](https://github.com/mattpocock/skills) under the MIT
License. Each vendored skill keeps its original files and a `LICENSE.txt`.

Run `setup-matt-pocock-skills` once in a repository before using the engineering
workflow skills (issue tracker, triage labels, and domain-doc layout).

## Frontend skill scopes

- `frontend-design` owns original visual direction and substantial redesigns. It grounds
  palette, typography, composition, and motion in the product while preserving an
  existing design system when one is in scope. Stack exemplars live in its `EXAMPLES.md`.
- `figma-design-to-code` owns faithful implementation of a supplied Figma node or other
  exact visual spec. It requires structured target context, repository component and
  token reuse, and rendered comparison with the spec.
- `complexity-audit` owns measuring and reducing cyclomatic complexity. Metrics come
  from a tool; extracts must stay behaviour-preserving and pass the deletion test.

Always-on routing for these skills lives in `policy/shared-policy.md`, which the installer
inlines into user and project `AGENTS.md`. Conditional packs add stack-specific pointers
(`shadcn` in the React pack, PrimeVue composition in the Vue pack, `complexity-audit` in
the TypeScript pack).

Use `frontend-design` and `figma-design-to-code` together only when a spec leaves a real
implementation gap, such as responsive reflow or an unspecified state. Defined spec
details remain the source of truth.

## Ownership model

- **User-owned:** personal instructions outside managed blocks and all client credentials,
  account state, MCP registration, and IDE preferences.
- **Source-owned:** policy packs, client bridges, portable skills, and installer implementation.
  During migration, the CLI removes only legacy Cursor rule files proven owned by its prior
  lock file.
- **Project-owned:** the project architecture section in `AGENTS.md`,
  `.agents/agent-config.json`, package scripts, test configuration, and unmanaged portions
  of `.prettierignore` and client-local credentials/settings.
- **Client-specific:** OAuth, plugins, MCP registration, native hook registration,
  and IDE state.

## Development

```sh
npm run verify
```

This syntax-checks the scripts and executes the installer integration tests.

## License

[MIT](LICENSE)
