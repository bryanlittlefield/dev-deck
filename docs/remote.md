# Remote-SSH and Codespaces

In a Remote-SSH, Codespaces or dev-container window, VS Code runs Claude Code *on the remote machine*, and its hooks and git run there too. The deck still presses keys in your local VS Code window, so anything that's only a shortcut works as it is. The live keys need two pieces:

1. **The bridge**, a small VS Code extension on your Mac (`duo87.devdeck-bridge`, installed by `duo87 install`). In remote windows it copies the remote's Claude state to your Mac over VS Code's own connection: no tunnels, no extra SSH sessions. When you close a remote window, its sessions leave the deck within seconds.
2. **The remote kit** on each machine you run Claude on: the Claude Code hook, its git reader, and Smart Commit.

| Keys | On your Mac | SSH / Codespaces |
|---|---|---|
| VS Code page, git keys, prompts, Focus, New Chat | Works | Works, no setup |
| Claude status, last prompt, Allow / Deny | Works | With the kit. The status heading reads `SSH` or `CODESPACE`, and tapping it focuses that remote window |
| Repo status and the git display | Live | With the kit: refreshed after each Claude step and each Smart Commit |
| Smart Commit | macOS dialog | With the kit: you confirm in the task terminal (Enter, `p`, `e`, `n`). It uses the Claude CLI bundled with the remote Claude Code extension, so sign in there once |
| Create PR, View PR, GitHub | `gh` | Needs `gh` on the remote. Codespaces already has it |

## Install the kit

**SSH hosts:** use the same SSH config VS Code uses.

```sh
~/.duo87/bin/duo87 remote dev-box                        # a Host from ~/.ssh/config
~/.duo87/bin/duo87 remote staging.example.com --dry-run  # show what it would do
```

The kit only writes `~/.duo87` on the host, and adds one hook to `~/.claude/settings.json` there (backed up first). It's safe to run again, and running it again is also how you update it. Host names containing "PROD" are refused unless you add `--force`.

**A running codespace:**

```sh
gh codespace list
~/.duo87/bin/duo87 codespace <name>
```

**Every new codespace:** export the kit into your dotfiles repo, and turn on dotfiles in GitHub → Settings → Codespaces.

```sh
~/.duo87/bin/duo87 kit ~/path/to/dotfiles/duo87
# then add this line to the dotfiles repo's install.sh:
sh "$(dirname "$0")/duo87/install.sh"
```

Afterwards, **reload** any remote window that was already open and send Claude a prompt there. The status key should switch to the SSH or CODESPACE heading.

The kit runs on whatever Node.js the host has. If there's none, it uses the one VS Code's server installs on first connect, so hosts without Node still work.

## Things to know

- **Shared logins.** On hosts where a whole team signs in as one SSH user (common on managed WordPress hosts), that user's `~/.claude/settings.json` is shared, so everyone who runs Claude there gets the hook too. It only writes status files, and those are private to that user (mode 600). Pick hosts deliberately.
- **Older kits** (installed before the git display existed) still show branch, changes and ahead/behind. Re-run `duo87 remote` on those hosts to get line counts, the last commit, staged files and rebase status.
- **Commits made on a remote** use that machine's git identity and signing setup.
- **Not covered:** Codespaces opened in a browser tab (the deck drives the VS Code app), and Claude run in a plain `ssh` terminal outside VS Code.

## If a remote session doesn't show up

In that remote window, run *DUO87 Dev Deck: Show Bridge Status* from the Command Palette. If it says there's no `~/.duo87/state`, install the kit on that machine. If the remote keeps home somewhere unusual, set `duo87.remoteStateDir` in VS Code settings to its `~/.duo87/state` path.

If Smart Commit fails in a remote window, "No such file" means the kit isn't installed there. "Claude could not write the message" means the remote Claude CLI isn't signed in: run `claude` once in a terminal there. Without Claude you still get a basic message you can edit.
