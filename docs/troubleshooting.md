# Troubleshooting

Start with `~/.duo87/bin/duo87 doctor`: it checks every piece and says what to run. The plugin logs to `~/.duo87/logs/plugin.log`, and the Play Deck app logs to `~/Library/Application Support/HotSpot/StreamDock/logs/`.

## Keys are blank or black

Dev Deck draws its keys as SVG, which the Play Deck app supports. If your firmware or app version shows them blank, add `"deck": { "imageFormat": "png" }` to `~/.duo87/config.json`, then quit and reopen the Play Deck app. The keys stop animating in PNG mode but show the same information.

## Tapping a key does nothing, or it flashes a warning

A warning flash usually means one of two things:

- Accessibility was turned off for *DUO87_Play_Deck*.
- The key had nothing to do, for example Allow with no pending request.

Failed keys are logged in `~/.duo87/logs/plugin.log`.

## `duo87 install` fails

- **"Dev Deck must live in ~/.duo87":** clone the repo there: `git clone https://github.com/bryanlittlefield/dev-deck.git ~/.duo87`.
- **"npm install failed in the plugin folder":** install Node.js with npm (for example `brew install node`), then run `install` again.
- **"could not build duo87-keys":** install the Xcode Command Line Tools with `xcode-select --install`.

## A "1" ended up in my file instead of approving

The approve keys send <kbd>1</kbd> only after focusing Claude, and only while the status key shows *Approve?*. If the Claude sidebar was closed, open it once (tap *Focus*) and try again.

## Smart Commit didn't start

The task runs in the frontmost VS Code window and needs a folder open. To see the error, run it by hand: Command Palette → *Tasks: Run Task* → *DUO87: Smart Commit*. If commit signing fails, check that your signing key is available (for SSH signing, `ssh-add -l`).

## The status key is stuck on Working

A session that crashes never reports that it ended. The deck drops stale sessions after two hours. `duo87 status` lists what the deck sees.

## The page keys go to the wrong page

After you reorder pages in the app, run `~/.duo87/bin/duo87 install` so the page keys follow the new order and show the right labels.

## The wide display looks split, or its parts are out of order

Its keys have to sit side by side in the same *screen* row. In the app, count keys left to right, top to bottom, three per screen row. The plugin logs where each part sits (`wide display key` lines in `plugin.log`).

If it shows the wrong repo, remember that it follows the Claude session you prompted most recently. Set *Repo path* on its left key to pin one repo.

## A remote session doesn't show on the deck

In that remote window, run *DUO87 Dev Deck: Show Bridge Status* from the Command Palette. If it says there's no `~/.duo87/state`, install the kit there (`duo87 remote` or `duo87 codespace`). If the remote keeps home somewhere unusual, set `duo87.remoteStateDir` in VS Code settings to its `~/.duo87/state` path. [Remote-SSH and Codespaces](remote.md) has more.

## Smart Commit fails in a remote window

- **"No such file":** the kit isn't installed on that machine yet.
- **"Claude could not write the message":** the remote Claude CLI isn't signed in; run `claude` once in a terminal there.

Without Claude you still get a basic message you can edit.

## After a Play Deck app update, the keys went back to defaults

Run `~/.duo87/bin/duo87 install`. It copies the plugin and profile again and makes Dev Deck the active profile.
