#!/bin/sh
# DUO87 Dev Deck remote kit: installs the Claude Code status hook and smart-commit for the
# current user, so a Play Deck on your Mac can show Claude sessions running on this machine.
#
# Run by `duo87 remote <ssh-host>` / `duo87 codespace <name>`, or from a Codespaces dotfiles repo.
# Touches only ~/.duo87 and ~/.claude/settings.json (backed up first). Safe to run again.
set -e

KIT=$(cd "$(dirname "$0")" && pwd)
DEST="$HOME/.duo87"
mkdir -p "$DEST/bin" "$DEST/state/claude"
chmod 700 "$DEST" "$DEST/state" "$DEST/state/claude"
cp "$KIT/bin/duo87-node" "$KIT/bin/claude-status-hook.js" "$KIT/bin/git-info.js" "$KIT/bin/smart-commit" "$DEST/bin/"
cp "$KIT/setup-remote.js" "$DEST/bin/duo87-setup-remote.js"
chmod +x "$DEST/bin/duo87-node" "$DEST/bin/smart-commit"

set +e
"$DEST/bin/duo87-node" "$DEST/bin/duo87-setup-remote.js"
status=$?
set -e
if [ "$status" = 127 ]; then
  # No Node.js yet (VS Code's server brings one on first connect).
  if [ ! -f "$HOME/.claude/settings.json" ]; then
    mkdir -p "$HOME/.claude"
    cp "$KIT/claude-settings.json" "$HOME/.claude/settings.json"
    echo "duo87: created ~/.claude/settings.json with the status hook (Node will come from VS Code's server)."
  else
    echo "duo87: no Node.js found, so ~/.claude/settings.json was not changed." >&2
    echo "       Connect once with VS Code (it installs a Node), then run: sh $KIT/install.sh" >&2
    exit 1
  fi
elif [ "$status" != 0 ]; then
  exit "$status"
fi

if command -v git >/dev/null 2>&1; then :; else echo "duo87: note: git is not installed here."; fi
echo "duo87: installed in $DEST on $(hostname 2>/dev/null || echo this machine)."
