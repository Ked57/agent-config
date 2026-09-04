# Cloud agent installation

Use a personal cloud-environment setup script to install this configuration before an
agent starts. This keeps the policy out of application repositories while giving each
fresh cloud agent the same user-level baseline.

## Idempotent setup script

This repository is public, so the standard HTTPS clone does not require repository
credentials. The cloud environment only needs outbound access to `github.com`.

```sh
set -eu

AGENT_CONFIG_DIR="${HOME}/.cache/agent-config"
AGENT_CONFIG_REPOSITORY="https://github.com/Ked57/agent-config.git"

if [ -d "${AGENT_CONFIG_DIR}/.git" ]; then
  git -C "${AGENT_CONFIG_DIR}" pull --ff-only
elif [ -e "${AGENT_CONFIG_DIR}" ]; then
  echo "Refusing to replace non-repository path: ${AGENT_CONFIG_DIR}" >&2
  exit 1
else
  git clone "${AGENT_CONFIG_REPOSITORY}" "${AGENT_CONFIG_DIR}"
fi

node "${AGENT_CONFIG_DIR}/bin/agent-config.mjs" sync --user
node "${AGENT_CONFIG_DIR}/bin/agent-config.mjs" check --user
```

The script is safe to run on both a clean build and a resumed cached environment. If
you use a mirror or fork, change only `AGENT_CONFIG_REPOSITORY`. For a private fork,
keep credentials in the platform secret store and out of the clone URL.

## Cursor Cloud Agents

First, add this **User Rule** in Cursor Settings:

```text
Before doing any work, read and follow ~/.agents/AGENTS.md.
Repository-specific instructions take precedence when they conflict.
If ~/.agents/AGENTS.md cannot be read, report that before continuing.
```

Cursor documents User Rules as applying to your Cloud Agent sessions across all
repositories. The rule is deliberately only a bridge; this repository remains the source
of the actual policy.

Then add the setup script to a **personal saved environment**, run Build, and save the
environment after it succeeds. Cursor resolves a repository's `.cursor/environment.json`
first, then the personal saved environment, then a team environment, so a repository can
still override machine setup when necessary.

The user installer also creates a local Cursor plugin for desktop Cursor. Do not rely on
that local-plugin discovery path for Cloud Agents; the account-level User Rule above is
the documented cloud bridge. Rebuild the saved environment after changing its setup
script.

See [Cursor Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup) and
[Cursor Cloud Agent best practices](https://cursor.com/docs/cloud-agent/best-practices).

## Codex cloud

Add the same script to the Codex cloud environment setup script. Codex runs setup before
the agent phase and supports cached container state; `sync --user` handles either case.
If the environment sets `CODEX_HOME`, the installer writes the canonical `AGENTS.md`
there instead of assuming `~/.codex`.

See [Codex cloud environments](https://developers.openai.com/codex/cloud/environments)
and [Codex `AGENTS.md` discovery](https://developers.openai.com/codex/guides/agents-md).

## Verify a saved environment

After saving or rebuilding an environment:

1. Start a new cloud-agent session, not a session that predates the install.
2. Run `node ~/.cache/agent-config/bin/agent-config.mjs status --user`.
3. Run `node ~/.cache/agent-config/bin/agent-config.mjs check --user`.
4. Ask the agent which personal policy file it loaded and confirm it reports
   `~/.agents/AGENTS.md` (Codex also loads the managed block in the Codex-home `AGENTS.md`).

Repository instructions remain authoritative when they conflict with this personal
baseline.
