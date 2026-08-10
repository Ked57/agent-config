#!/usr/bin/env bash
set -euo pipefail

# Preserves the Cursor MCP wrapper, while keeping NVM optional.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

exec npx -y @primevue/mcp "$@"
