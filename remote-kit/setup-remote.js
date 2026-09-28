// Adds the DUO87 Dev Deck status hook to ~/.claude/settings.json on this machine.
// Idempotent; keeps every existing hook and backs the file up before changing it.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop', 'StopFailure', 'SubagentStop'];
const COMMAND = '"$HOME/.duo87/bin/duo87-node" "$HOME/.duo87/bin/claude-status-hook.js"';
const file = path.join(os.homedir(), '.claude', 'settings.json');

let settings = {};
if (fs.existsSync(file)) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    settings = raw.trim() ? JSON.parse(raw) : {};
  } catch (e) {
    console.error(`duo87: ${file} is not valid JSON (${e.message}); left it untouched.`);
    process.exit(1);
  }
}
settings.hooks = settings.hooks || {};
const hasOurs = (groups) => (groups || []).some((g) => (g.hooks || []).some((h) => String(h.command || '').includes('claude-status-hook.js')));
const missing = EVENTS.filter((ev) => !hasOurs(settings.hooks[ev]));

if (!missing.length) {
  console.log('duo87: Claude Code status hook already registered.');
} else {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.duo87-backup-${Date.now()}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const ev of missing) {
    settings.hooks[ev] = settings.hooks[ev] || [];
    settings.hooks[ev].push({ matcher: '', hooks: [{ type: 'command', command: COMMAND, async: true }] });
  }
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  console.log(`duo87: Claude Code status hook added for ${missing.length} events in ${file}.`);
}
console.log(`duo87: node ${process.version} (${process.execPath})`);
