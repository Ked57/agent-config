# Invocation metadata and Claude Code discovery

Research date: 2026-10-15. Scope: F1 and F5 from the repository audit.
Follow-up: the user approved both repairs; routing now honours the original manual
metadata, and project installs now include native Claude skill copies. See
[repair results](audit-repairs.md). The observations below describe the researched baseline.
This document records findings and choices; it changes no routing, skill metadata,
installation, or client settings.

## F1: intact upstream metadata conflicts with local automatic routes

The seven skills have the same invocation settings: `disable-model-invocation: true`
in `SKILL.md` and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`.
These settings came from the pinned upstream source, not a broken local installation.

The lock identifies `https://github.com/mattpocock/skills` at commit
`49dd158d1076134a641b33efb035946536778336`. Each of the following fourteen files was
fetched directly from that commit, normalised with the repository's CRLF-to-LF rule,
compared with the checkout, and hashed with SHA-256 against the lock. All fourteen
content comparisons and all fourteen lock comparisons passed.

| Skill | Pinned upstream skill file | Pinned upstream Codex metadata | Result |
| --- | --- | --- | --- |
| `grill-me` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/grill-me/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/grill-me/agents/openai.yaml) | Both match checkout and lock |
| `grill-with-docs` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/grill-with-docs/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/grill-with-docs/agents/openai.yaml) | Both match checkout and lock |
| `implement` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/implement/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/implement/agents/openai.yaml) | Both match checkout and lock |
| `to-spec` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-spec/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-spec/agents/openai.yaml) | Both match checkout and lock |
| `to-tickets` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-tickets/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-tickets/agents/openai.yaml) | Both match checkout and lock |
| `wayfinder` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/wayfinder/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/wayfinder/agents/openai.yaml) | Both match checkout and lock |
| `improve-codebase-architecture` | [SKILL.md](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/improve-codebase-architecture/SKILL.md) | [openai.yaml](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/improve-codebase-architecture/agents/openai.yaml) | Both match checkout and lock |

### Policy intent and harness controls are different layers

The local `policy/routing.md:17–23` chooses these skills from ordinary task types:
vague requirements, tickets, multi-session work, uncertain effort, and architecture
upkeep. That expresses this configuration's desired automatic selection. The metadata
expresses upstream's invocation choice to the client. The conflict is between those
two choices; neither file establishes that the user intended to discard the other.

Claude's frontmatter setting restricts automatic invocation, while retaining direct
user invocation. Its documentation also describes blocking an attempted automatic
call. [Claude invocation controls](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill).
Codex documents `allow_implicit_invocation: false` as disabling implicit prompt matching
while retaining explicit `$skill` invocation.
[Official OpenAI skill metadata](https://learn.chatgpt.com/docs/build-skills#optional-metadata).

Local `skills/writing-for-agents/SKILL-MECHANICS.md:9–12` makes the same distinction;
its router discussion at line 22 says a user-invoked router can suggest those workflows.
The installed Claude binary independently contains both the setting's schema and a
blocked-invocation diagnostic, supporting that it is an active client control rather
than inert descriptive prose.

Reading a file through a policy pointer is possible, but it is not proof of native
invocation and should not be used to claim the client restriction was overridden.
Do not silently replace a blocked Skill call with a manual replay of its workflow.

### Preserve the user's choice when repairing the conflict

There are two coherent outcomes, and they may be selected per skill:

1. **Keep automatic selection.** Adapt the selected skills' invocation settings for
   the clients in use and preserve the useful automatic router entries. Record the
   adaptation explicitly rather than claiming byte-for-byte upstream identity; keep
   provenance tests able to distinguish original upstream bytes from approved local
   changes. This requires deciding which workflows the agent may start independently.
2. **Keep upstream manual invocation.** Preserve all fourteen metadata files, change
   matching routes into suggestions for explicit user invocation, and retain applicable
   automatic skills such as `tdd`, `diagnosing-bugs`, or `codebase-design` within their
   actual scopes. Do not describe a suggestion as automatic execution.

This is a product preference, not an installation repair that can be inferred from a
hash mismatch. The audit alone is not evidence that manual invocation is the user's
preferred outcome. This research makes neither change.

## F5: project portable files do not establish native Claude registration

### Current official documentation

Claude documents personal discovery under `~/.claude/skills/` and project discovery
under `.claude/skills/`, including nested project directories. Its location table does
not list `.agents/skills/` or `.agent/skills/`.
[Claude skill locations](https://code.claude.com/docs/en/skills#choose-where-skills-load).
The similarly named Codex locations are `~/.agents/skills/` and repository
`.agents/skills/`; that is a different client's discovery contract.
[Official OpenAI local skill locations](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

### Installed implementation evidence

Read-only commands `command -v claude`, `claude --version`, `claude --help`, and `file`
identified the local native arm64 executable as Claude Code **2.1.282**, reached through
`~/.local/bin/claude` and stored under
`~/.local/share/claude/versions/2.1.282`.
Its SHA-256 was
`fcfd837103965c64de34a6b9b94370d77a347ea71819715a27d5f0ef01775ea4`.
Only embedded JavaScript source was inspected; no model session was launched.

The following zero-based byte offsets make the observations reproducible against that
exact executable. Minified function names may repeat across embedded chunks, so use
the offsets and contents together.

| Evidence | Offset | Observation |
| --- | --- | --- |
| Native project directory enumerator `Zre` | `181350117` | Walks parent directories and constructs `.claude/<requested-subdirectory>`; the skill loader requests `skills`. |
| Native skill loader `P$o` | `183629589` | Loads user-config `skills`, managed `.claude/skills`, enumerated project skill directories, and explicit additional directories' `.claude/skills`. |
| Dynamic nested-directory scan | `183634180` vicinity | Constructs nested `.claude/skills` paths. |
| Cursor import adapter | `193440955` vicinity | Reads user `~/.agents/skills` as an import source and writes into Claude's native skill location. |
| Project import adapter | `193443843` vicinity | Reads project `.agents/skills` and targets project `.claude/skills`. |

An exact-byte search found six occurrences of `.agents/skills`, all in import-related
strings or import-adapter code; none established a native automatic discovery path.
The split construction using `".agents","skills"` also appeared in that importer.
There were no literal `.agent/skills` or `".agent","skills"` occurrences.
The CLI help lists `import` as a configuration migration command; the presence of
import support does not make those source directories live registration roots.

**Conclusion:** current official documentation and the examined local loader agree
on `.claude/skills` for native project registration. Neither establishes direct native
support for project `.agents/skills` or singular `.agent/skills`. The local importer
supports migration from `.agents/skills`; migration and discovery are distinct actions.

### What this repository currently installs

The user-scoped installation explicitly writes each portable file to both
`~/.agents/skills` and `~/.claude/skills`
(`bin/agent-config.mjs:388–403` as inspected). It therefore has a native Claude copy.

The inspected project-scoped installation instead sets its skill destination to
`.agents/skills` (`bin/agent-config.mjs:325`) and supplies a `CLAUDE.md` → `AGENTS.md`
→ routing bridge. That bridge can lead the model to read portable procedure files.
It does not itself register project `/skill-name` commands or establish native
description matching. A global Claude installation can mask this project-only gap.

If native project discovery is a requirement, preserve the portable source and make
the Claude adapter produce a deliberate native `.claude/skills` installation or bridge,
with ownership/conflict handling consistent with the existing installer. Treat that as
an implementation choice requiring its own tests, rather than silently changing the
canonical portable path.

### Limits of verification

- The fourteen-file comparison proves invocation metadata fidelity at the pinned
  commit, not current upstream HEAD or every skill's runtime dependencies.
- Binary inspection proves the examined loader/import paths in local 2.1.282;
  public documentation can describe later versions. No compatibility claim is made
  for every historical or future Claude version.
- No model session, slash-menu inspection, invocation, import, or client-setting
  change was performed. Native runtime registration remains an unexecuted check;
  file readability through policy pointers is not a substitute for it.
- Project installation observations describe the code inspected during research;
  subsequent installer repairs should update the audit's final implementation status.

This is a documentation-only research change. No runnable surface changed, so manual
QA of application behaviour is inapplicable; `git diff --check` is the narrow document
verification.
