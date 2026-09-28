// Property inspector for all Dev Deck actions. The Play Deck app calls
// connectElgatoStreamDeckSocket() after loading this page.
/* global document, WebSocket */
'use strict';

const ICONS = ['spark', 'message', 'reply', 'eye', 'book', 'flask', 'wrench', 'refactor', 'compress', 'plus', 'target',
  'check', 'checks', 'x', 'stop', 'commit', 'push', 'pull', 'branch', 'pr', 'globe', 'stash', 'undo', 'diff', 'command',
  'file', 'search', 'terminal', 'definition', 'rename', 'format', 'comment', 'sidebar', 'split', 'scm', 'play', 'zen',
  'at', 'layers', 'sync', 'bolt', 'keyboard', 'shield', 'clipboard'];
const COLORS = ['claude', 'blue', 'green', 'amber', 'red', 'purple', 'teal', 'pink', 'orange', 'gray'];

const label = { key: 'label', label: 'Label', type: 'text', hint: 'Use \\n for a second line, e.g. <code>Write\\nTests</code>' };
const sub = { key: 'sub', label: 'Caption', type: 'text', hint: 'Small text at the top of the key (optional).' };
const iconField = { key: 'icon', label: 'Icon', type: 'select', options: ICONS };
const colorField = { key: 'color', label: 'Color', type: 'select', options: COLORS };

const FORMS = {
  status: {
    title: 'Claude Status',
    about: 'Live state of your Claude Code sessions: working, waiting for approval, done. Tap to jump to the session.',
    fields: [],
  },
  view: {
    title: 'Claude Prompt / Reply',
    about: 'Shows your last prompt or Claude\'s last reply. Tap to copy the full text.',
    fields: [{ key: 'show', label: 'Show', type: 'select', options: [['prompt', 'My last prompt'], ['reply', "Claude's last reply"]] }],
  },
  answer: {
    title: 'Answer Claude',
    about: 'Answers a pending Claude Code permission prompt. Lights up when Claude is waiting. Deny doubles as Stop (Esc) while Claude works.',
    fields: [{ key: 'answer', label: 'Answer', type: 'select', options: [['allow', 'Allow (1)'], ['always', "Allow, don't ask again (2)"], ['deny', 'Deny / Stop (Esc)']] }],
  },
  focus: {
    title: 'Focus Claude',
    about: 'Brings VS Code forward and focuses the Claude Code input (selected code is attached automatically).',
    fields: [label, sub, { key: 'newChat', label: 'New chat', type: 'checkbox', text: 'Start a new conversation' }, iconField, colorField],
  },
  prompt: {
    title: 'Claude Prompt',
    about: 'Sends a prompt or slash command to Claude Code. Select code first and it is attached as context.',
    fields: [
      label,
      { key: 'prompt', label: 'Prompt', type: 'textarea', hint: 'Plain text or a slash command like <code>/compact</code>.' },
      { key: 'submit', label: 'Send', type: 'checkbox', text: 'Press Enter after pasting', default: true },
      { key: 'newChat', label: 'New chat', type: 'checkbox', text: 'Start a new conversation first' },
      { key: 'target', label: 'Target', type: 'select', options: [['vscode', 'Claude in VS Code'], ['frontmost', 'Frontmost app (terminal Claude, etc.)']] },
      sub, iconField, colorField,
    ],
  },
  commit: {
    title: 'Smart Commit',
    about: 'Runs ~/.duo87/bin/smart-commit in the current VS Code workspace: stages changes, Claude writes the message, you confirm.',
    fields: [label, sub, { key: 'push', label: 'Push', type: 'checkbox', text: 'Push after committing' }],
  },
  repo: {
    title: 'Repo Status',
    about: 'Branch, changed files and ahead/behind for the repo you are working in (from your latest Claude session). Tap for Source Control.',
    fields: [{ key: 'repo', label: 'Repo path', type: 'text', hint: 'Optional. Leave empty to follow your latest Claude session.' }],
  },
  banner: {
    title: 'Wide Display',
    about: 'Place two or three of these side by side in one screen row and they join into one wide display: repo, the full branch name, changed files, +/− lines, ahead/behind, last commit, and merges/rebases in progress. Follows your latest Claude session, including SSH and Codespaces.',
    fields: [
      { key: 'press', label: 'Tap', type: 'select', options: [['auto', 'By position: leftmost switches branch, the rest open Source Control'], ['branch', 'Switch branch'], ['scm', 'Source Control'], ['sync', 'Sync (pull + push)'], ['pull', 'Pull'], ['push', 'Push'], ['github', 'Open on GitHub'], ['none', 'Nothing']] },
      { key: 'repo', label: 'Repo path', type: 'text', hint: 'Optional, on the leftmost key. Leave empty to follow your latest Claude session.' },
    ],
  },
  keys: {
    title: 'Shortcut',
    about: 'Sends a keyboard shortcut to an app (VS Code by default).',
    fields: [
      label,
      { key: 'keys', label: 'Keys', type: 'text', hint: 'e.g. <code>cmd+shift+p</code>. Space-separate chords: <code>cmd+k cmd+s</code>.' },
      { key: 'app', label: 'App', type: 'text', hint: 'Bundle id or app name. Empty = VS Code, <code>none</code> = frontmost app.' },
      sub, iconField, colorField,
    ],
  },
  shell: {
    title: 'Run Command',
    about: 'Runs a shell command (zsh login shell). Shows a check or warning when done.',
    fields: [
      label,
      { key: 'command', label: 'Command', type: 'textarea' },
      { key: 'cwd', label: 'Folder', type: 'text', hint: 'Empty or <code>{repo}</code> = your current repo. Or a path like <code>~/Sites/app</code>.' },
      sub, iconField, colorField,
    ],
  },
};

let socket = null;
let context = '';
let settings = {};
let form = null;

function save() {
  if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: 'setSettings', context, payload: settings }));
}

function build() {
  document.getElementById('title').textContent = form.title;
  document.getElementById('about').textContent = form.about;
  const root = document.getElementById('fields');
  root.innerHTML = '';
  for (const f of form.fields) {
    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('label');
    name.textContent = f.label;
    const field = document.createElement('div');
    field.className = 'field';
    let input;
    if (f.type === 'textarea') input = document.createElement('textarea');
    else if (f.type === 'select') {
      input = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '(default)';
      input.appendChild(empty);
      for (const o of f.options) {
        const opt = document.createElement('option');
        [opt.value, opt.textContent] = Array.isArray(o) ? o : [o, o];
        input.appendChild(opt);
      }
    } else {
      input = document.createElement('input');
      input.type = f.type === 'checkbox' ? 'checkbox' : 'text';
    }
    input.id = 'f_' + f.key;
    const current = settings[f.key];
    if (f.type === 'checkbox') input.checked = current === undefined ? Boolean(f.default) : Boolean(current);
    else input.value = f.key === 'label' && typeof current === 'string' ? current.replace(/\n/g, '\\n') : (current || '');
    const update = () => {
      if (f.type === 'checkbox') settings[f.key] = input.checked;
      else if (f.key === 'label') settings[f.key] = input.value.replace(/\\n/g, '\n');
      else settings[f.key] = input.value;
      save();
    };
    input.addEventListener(f.type === 'checkbox' || f.type === 'select' ? 'change' : 'input', update);
    field.appendChild(input);
    if (f.type === 'checkbox' && f.text) {
      const t = document.createElement('span');
      t.textContent = f.text;
      field.appendChild(t);
    }
    if (f.hint) {
      const h = document.createElement('div');
      h.className = 'hint';
      h.innerHTML = f.hint;
      field.appendChild(h);
    }
    row.appendChild(name);
    row.appendChild(field);
    root.appendChild(row);
  }
}

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfo) {
  let action = {};
  try { action = JSON.parse(actionInfo || '{}'); } catch {}
  context = action.context || uuid;
  settings = (action.payload && action.payload.settings) || {};
  const kind = String(action.action || '').split('.').pop();
  form = FORMS[kind] || { title: 'Dev Deck', about: '', fields: [] };
  build();
  socket = new WebSocket('ws://127.0.0.1:' + port);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event: registerEvent, uuid }));
    socket.send(JSON.stringify({ event: 'getSettings', context }));
  };
  socket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.event === 'didReceiveSettings' && msg.payload) {
      const incoming = msg.payload.settings || {};
      // The app may echo our own saves back; rebuilding then would steal focus mid-typing.
      if (JSON.stringify(incoming) === JSON.stringify(settings)) return;
      settings = incoming;
      build();
    }
  };
}
