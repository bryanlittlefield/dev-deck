# Customizing

There are two ways to change the deck:

- **In the Play Deck app**, for quick tweaks. Select a key and edit its fields on the right. To add keys, drag actions from the *Dev Deck* category in the Function Library.
- **In `profile/layout.json`**, which is repeatable and versionable. Run `~/.duo87/bin/duo87 install` afterwards.

`install` rebuilds the Dev Deck pages from `layout.json`, so key edits you made in the app are replaced. It keeps your page order and any pages you added in the app. `~/.duo87` is a git clone, so commit your layout, or keep it on a fork.

## layout.json

Each page lists the screen's rows from top to bottom, three keys per row, four rows. `null` leaves a key empty.

```json
{
  "name": "Dev Deck",
  "pages": [
    {
      "id": "git",
      "name": "Git",
      "rows": [
        [{ "action": "banner" }, { "action": "banner" }, { "action": "banner" }],
        [{ "action": "commit", "settings": { "push": true } },
         { "action": "keys", "settings": { "label": "Pull", "icon": "pull", "color": "teal", "keys": "ctrl+shift+f17" } },
         { "action": "keys", "settings": { "label": "Push", "icon": "push", "color": "teal", "keys": "ctrl+shift+f18" } }],
        [null, null, null],
        [null, null, { "native": "page.next" }]
      ]
    }
  ]
}
```

A page's `id` keeps it tied to the same page in the app across rebuilds, so don't change it once installed. A key is either a Dev Deck action (`"action"`, with optional `"settings"`) or one of the app's built-in actions (`"native"`).

## Dev Deck actions

| Action | Settings | What it is |
|---|---|---|
| `status` | none | Live Claude Code status. Tap to jump to the session |
| `view` | `show`: `prompt` or `reply` | Your last prompt, or Claude's last reply. Tap to copy it |
| `answer` | `answer`: `allow`, `always` or `deny` | Answers Claude's permission prompt with <kbd>1</kbd>, <kbd>2</kbd> or <kbd>Esc</kbd>. `deny` doubles as Stop while Claude works |
| `focus` | `label`, `sub`, `newChat`, `icon`, `color` | Focuses Claude's input, or starts a new chat |
| `prompt` | `label`, `prompt`, `submit` (default `true`), `newChat`, `target` (`vscode` or `frontmost`), `sub`, `icon`, `color` | Pastes a prompt or slash command into Claude and sends it |
| `commit` | `label`, `sub`, `push` | Smart Commit, optionally pushing |
| `repo` | `repo` | Branch, changes and ahead/behind on one key |
| `banner` | `press`, `repo` | One part of a [wide display](#wide-displays) |
| `keys` | `label`, `keys`, `app`, `sub`, `icon`, `color` | Sends a shortcut. `keys` takes space-separated chords (`cmd+k cmd+s`); `app` is a bundle id or app name (empty means VS Code, `none` means the frontmost app) |
| `shell` | `label`, `command`, `cwd`, `sub`, `icon`, `color` | Runs a command in a zsh login shell. `cwd` defaults to your current repo (`{repo}`) |

`label` can hold `\n` for a second line (`"Write\nTests"`). `sub` is the small caption at the top of the key.

**Icons:** spark, message, reply, eye, book, flask, wrench, refactor, compress, plus, target, check, checks, x, stop, commit, push, pull, branch, pr, globe, stash, undo, diff, command, file, search, terminal, definition, rename, format, comment, sidebar, split, scm, play, zen, at, next, prev, first, layers, sync, bolt, keyboard, shield, clipboard, wide.

**Colors:** claude, blue, green, amber, red, purple, teal, pink, gray, orange, or any `#rrggbb`.

## Built-in actions

| Native | Settings | What it does |
|---|---|---|
| `page.next` | none | Next page. On the last page it goes back to the first |
| `page.previous` | none | Previous page. On the first page it goes to the last |
| `page.goto` | `page`: a page `id` (or a number) | Goes to that page |
| `scene` | none | Rotates through your Play Deck profiles |

Page keys are labelled with the page they go to, in your current page order. `label`, `sub`, `icon` and `color` override that.

## Wide displays

Put two or three `banner` keys side by side in one screen row and they join into one display (the git display). In `layout.json` that's a row like the Git page's first row above.

In the app, drag *Wide Display* onto keys that are next to each other in the same *screen* row. The app lays its 12 keys out on its own 4 × 3 grid, but the screen shows them in the same order, three per row: screen row 1 is the app's keys 1–3 (counting left to right, top to bottom), row 2 is keys 4–6, and so on.

Each part can have its own tap (`press`): `auto` (the leftmost part switches branch, the rest open Source Control), `branch`, `scm`, `sync`, `pull`, `push`, `github` or `none`. `repo` on the leftmost part pins the display to one repo; otherwise it follows the Claude session you prompted most recently.

## Settings

`~/.duo87/config.json` is optional and git-ignored; [`config.example.json`](../config.example.json) shows every option at its default. Changes to `commit` apply on the next commit; changes to `deck` apply after you restart the Play Deck app.

| Option | Default | What it does |
|---|---|---|
| `commit.model` | `"haiku"` | Any `claude --model` value. `"sonnet"` handles trickier diffs |
| `commit.confirm` | `true` | Show the edit/confirm dialog. `false` commits straight away |
| `commit.signoff` | `true` | Add `Signed-off-by` |
| `commit.stageAll` | `true` | Stage everything when nothing is staged |
| `commit.maxDiffKB` | `60` | How much of the diff Claude sees. Lockfiles and minified files are always left out |
| `commit.timeoutSec` | `90` | Give up on Claude after this long and fall back to a basic message |
| `commit.trailer` | `""` | Appended to every message, e.g. `Co-Authored-By: Claude <noreply@anthropic.com>` |
| `commit.notify` | `true` | macOS notification when a commit finishes |
| `deck.imageFormat` | `"svg"` | `"png"` rasterizes keys first (no animations). Only needed if keys show blank |
| `deck.screenColumns` | `3` | Keys per screen row. The DUO87 screen is 3 wide; change it only for a different screen |

## Adding a VS Code command

1. Pick an unused combo on F16–F19, e.g. `shift+f16`. No physical key sends these, so they can't clash with anything.
2. Bind it in [`vscode/keybindings.json`](../vscode/keybindings.json) so `install` adds it for you (or add it straight to VS Code's own `keybindings.json`). Use `runCommands` to run several commands in a row:

   ```json
   { "key": "shift+f16", "command": "runCommands", "args": { "commands": ["workbench.action.files.saveAll", "workbench.action.tasks.test"] } }
   ```

3. Add a `keys` action that sends it: `{ "action": "keys", "settings": { "label": "Test", "icon": "flask", "keys": "shift+f16" } }`.

## Keyboard macros (VIA)

The touch screen is set up in Play Deck; the physical keys are set up in [VIA](https://usevia.app/), and the two don't affect each other. VIA macros can send the same F16–F19 combos, so a physical key can run Smart Commit or focus Claude too.

1. Download the DUO87 JSON from [womierkeyboard.com/pages/softwares](https://www.womierkeyboard.com/pages/softwares).
2. Open usevia.app in Chrome or Edge (it needs WebHID; Safari won't work). In Settings, turn on *Show Design tab*, then load the DUO87 JSON in Design.
3. In Configure, choose *Authorize device* and pick the DUO87.
4. Paste macros into `M0`, `M1` and so on, then assign them to empty keys on layer 1 (the Fn layer).

| Macro | Paste this | Does |
|---|---|---|
| M0 | `{KC_LCTL,KC_LALT,KC_F18}` | Smart Commit |
| M1 | `{KC_LCTL,KC_LALT,KC_F19}` | Smart Commit + Push |
| M2 | `{KC_LCTL,KC_LALT,KC_F16}` | Focus Claude's input |
| M3 | `{KC_LCTL,KC_LALT,KC_F17}` | New Claude chat |

Don't overwrite the built-in Fn combos: Fn with F1–F12, Space, Enter, the arrows, Right Shift, Right Ctrl, App, Win, Caps Lock, W, Z and X already do something on this board.
