# Installing

## Requirements

- **A Mac** (macOS 10.15 or newer) with the **[DUO87 Play Deck app](https://www.womierkeyboard.com/pages/softwares)**, and the DUO87's screen module seated where the Ins/Home/PgUp keys were.
- **Node.js 18 or newer, with npm.** The `duo87` tool runs on it. (The plugin itself runs on the Node 20 that ships inside the Play Deck app.)
- **Xcode Command Line Tools** (`xcode-select --install`). They build the small native helper that presses shortcuts.
- **VS Code** with the **Claude Code** extension.
- **The Claude Code CLI** for Smart Commit messages. Without it you get a basic message to edit.
- Optional: **ImageMagick** (`brew install imagemagick`) for crisper default key images, and the **GitHub CLI** (`gh`) for the Create PR, View PR and GitHub keys.

## Install

```sh
git clone https://github.com/bryanlittlefield/dev-deck.git ~/.duo87
~/.duo87/bin/duo87 install
```

Dev Deck must live in `~/.duo87`. The plugin, the Claude Code hook and the VS Code tasks all look for it there, and `duo87` refuses to run from anywhere else.

Then turn on **Accessibility** for *DUO87_Play_Deck*: System Settings → Privacy & Security → Accessibility. This is what lets the keys press shortcuts. `install` reports whether it's on, and so does `duo87 doctor`. After changing a permission, quit the Play Deck app from its menu-bar icon and open it again.

## What `install` changes

Everything it changes is backed up first to `~/.duo87/backups/<timestamp>/`.

| Where | What happens |
|---|---|
| `~/.duo87` | Installs the plugin's one npm dependency (`ws`), compiles `bin/duo87-keys` from `src/duo87-keys.swift`, and renders the key images and the Dev Deck profile into `build/` |
| Play Deck app | Quits the app. Copies the plugin into `~/Library/Application Support/HotSpot/StreamDock/plugins/com.duo87.devdeck.sdPlugin`, installs the Dev Deck profile next to your other profiles, and makes it the active profile. Then reopens the app |
| VS Code `keybindings.json` | Adds 16 bindings on F16–F19 combos. No physical key sends those, so they can't clash with yours. Your own bindings and comments stay as they are |
| VS Code `tasks.json` | Adds 5 user tasks: Smart Commit, Smart Commit + Push, Create PR, View PR, Open on GitHub. Tasks you already have are kept |
| VS Code extensions | Installs `duo87.devdeck-bridge`, which brings Claude sessions from Remote-SSH and Codespaces windows to the deck. It does nothing in local windows |
| `~/.claude/settings.json` | Adds one async hook for 11 Claude Code events. It never blocks Claude, and your existing hooks are left alone |

Reinstalling is safe. On the Dev Deck pages, `install` replaces any keys you changed in the app with `profile/layout.json`. It keeps the page order you set in the app, and any pages you added there.

## Other permissions

- **Notifications:** Smart Commit posts a notification when it finishes. macOS lists these under *Script Editor*.
- **Automation → System Events:** Womier's own *Hotkey* and *Text* actions ask for this. Dev Deck keys don't need it.

## Check it

```sh
~/.duo87/bin/duo87 doctor
```

This checks the app, the plugin and its dependency, the profile, the key sender, the Claude Code hook, the VS Code keybindings, tasks and bridge, the `claude` and `gh` CLIs, and Accessibility. `duo87 status` shows what the deck currently sees: Claude sessions and the last Smart Commit.

## Update

```sh
git -C ~/.duo87 pull && ~/.duo87/bin/duo87 install
```

If you installed the remote kit on SSH hosts or codespaces, run the same `duo87 remote` or `duo87 codespace` command again to update them (see [Remote-SSH and Codespaces](remote.md)).

## Uninstall

1. In the Play Deck app, delete the Dev Deck profile. Quit the app and remove `com.duo87.devdeck.sdPlugin` from `~/Library/Application Support/HotSpot/StreamDock/plugins/`.
2. In Claude Code, open `/hooks` and remove the `claude-status-hook.js` entries, or restore `settings.json` from `~/.duo87/backups/`.
3. Delete the entries marked DUO87 from VS Code's user `keybindings.json` and `tasks.json`, then run `code --uninstall-extension duo87.devdeck-bridge`.
4. On each remote where you installed the kit, remove the `claude-status-hook.js` entries from `~/.claude/settings.json` (a `.duo87-backup-*` copy sits next to it) and delete `~/.duo87`.
5. Delete `~/.duo87`.
