#!/usr/bin/env node
// Builds the interactive guide (docs/index.html, served by GitHub Pages) from guide-template.html
// and the key layout, so the guide always shows the keys that are actually on the deck. Also
// draws docs/images/*.svg for the README. Run: ~/.duo87/bin/duo87 guide
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DUO = path.resolve(__dirname, '..');
const SD_PROFILES = path.join(os.homedir(), 'Library/Application Support/HotSpot/StreamDock/profiles');
const render = require(path.join(DUO, 'plugin/com.duo87.devdeck.sdPlugin/plugin/render.js'));
const layout = JSON.parse(fs.readFileSync(path.join(DUO, 'profile/layout.json'), 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'guide-template.html'), 'utf8');
const OUT = path.join(DUO, 'docs/index.html');
const IMAGES = path.join(DUO, 'docs/images');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// Pages in the order the deck shows them: the order set in the app wins (as in `duo87 build`).
const pages = layout.pages.map((p, i) => ({ ...p, id: p.id || `page${i + 1}` }));
(function sortByInstalledOrder() {
  try {
    const ids = readJson(path.join(DUO, 'profile/ids.json'));
    const man = readJson(path.join(SD_PROFILES, `${ids.profile}.sdProfile`, 'manifest.json'));
    const order = man.Pages.Pages.map((x) => String(x).replace(/\.sdProfile$/, ''));
    const rank = (p) => { const i = order.indexOf(ids.pages[p.id]); return i < 0 ? 1e3 : i; };
    pages.sort((a, b) => rank(a) - rank(b));
  } catch { /* not installed yet: layout order */ }
})();

// A sample repo for the wide display in the preview.
const SAMPLE = { project: 'storefront', branch: 'feature/cache-flush-fix', changes: 3, unstaged: 2, untracked: 1, ins: 120, del: 14,
  ahead: 1, behind: 0, upstream: 'origin/feature/cache-flush-fix' };

const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const SYMBOL = { cmd: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃' };
const KEYNAME = { enter: '↩', esc: 'Esc', '`': '`', '\\': '\\', '/': '/', left: '←', right: '→', up: '↑', down: '↓' };
function pretty(combo) {
  return String(combo || '').split(/\s+/).filter(Boolean).map((c) => {
    const parts = c.toLowerCase().split('+');
    const key = parts.pop();
    return parts.map((m) => SYMBOL[m] || m).join('') + (KEYNAME[key] || key.toUpperCase());
  }).join(' then ');
}

// What the F16–F19 combos do (mirrors ~/.duo87/vscode/keybindings.json).
const HYPER = {
  'ctrl+alt+f16': 'Claude Code: Focus input',
  'ctrl+alt+f17': 'Claude Code: New conversation',
  'ctrl+alt+f18': 'Run task “DUO87: Smart Commit”',
  'ctrl+alt+f19': 'Run task “DUO87: Smart Commit + Push”',
  'ctrl+shift+f16': 'Terminal: Focus (for Claude running in the VS Code terminal)',
  'ctrl+shift+f17': 'Git: Pull',
  'ctrl+shift+f18': 'Git: Push',
  'ctrl+shift+f19': 'Git: Sync',
  'alt+shift+f16': 'Run task “DUO87: Create PR” (gh pr create --web)',
  'alt+shift+f17': 'Run task “DUO87: View PR” (gh pr view --web)',
  'alt+shift+f18': 'Run task “DUO87: Open on GitHub” (gh browse)',
  'alt+shift+f19': 'Git: Stash',
  'cmd+alt+f16': 'Git: Undo Last Commit',
  'cmd+alt+f17': 'Git: Checkout to… (switch branch)',
  'cmd+alt+f18': 'Claude Code: Accept Proposed Changes',
  'cmd+alt+f19': 'Claude Code: Reject Proposed Changes',
};
const VSCODE_DEFAULTS = {
  'cmd+shift+p': 'Command Palette', 'cmd+p': 'Quick Open (go to file)', 'cmd+shift+f': 'Search across files',
  'ctrl+`': 'Toggle the terminal panel', f12: 'Go to Definition', f2: 'Rename Symbol', 'shift+alt+f': 'Format Document',
  'cmd+/': 'Toggle line comment', 'cmd+b': 'Toggle the primary sidebar', 'cmd+\\': 'Split the editor',
  'ctrl+shift+g': 'Open Source Control',
};

// Where a page key goes, like `duo87 build` labels it: next on the last page wraps to page 1.
function navigation(key, index) {
  const at = (i) => ({ label: pages[i].name, sub: `Page ${i + 1}`, index: i + 1 });
  if (key.native === 'page.next') return index + 1 < pages.length ? { ...at(index + 1), icon: 'next' } : { ...at(0), icon: 'first', wrap: true };
  if (key.native === 'page.previous') return index > 0 ? { ...at(index - 1), icon: 'prev' } : { ...at(pages.length - 1), icon: 'prev', wrap: true };
  if (key.native === 'page.goto') {
    const i = typeof key.page === 'string' ? pages.findIndex((p) => p.id === key.page) : (key.page || 1) - 1;
    return { ...at(Math.max(0, i)), icon: 'first' };
  }
  return {};
}

const TAP = {
  branch: ['Tap this part to switch branch.', 'cmd+alt+f17', 'Git: Checkout to…'],
  scm: ['Tap this part to open Source Control.', 'ctrl+shift+g', 'Source Control'],
  sync: ['Tap this part to sync (pull, then push).', 'ctrl+shift+f19', 'Git: Sync'],
  pull: ['Tap this part to pull.', 'ctrl+shift+f17', 'Git: Pull'],
  push: ['Tap this part to push.', 'ctrl+shift+f18', 'Git: Push'],
  github: ['Tap this part to open the repo on GitHub.', 'alt+shift+f18', 'task “DUO87: Open on GitHub”'],
};

function describe(key, nav = {}, slot = null) {
  const s = key.settings || {};
  if (key.native === 'page.next' || key.native === 'page.previous' || key.native === 'page.goto') {
    return { title: `Go to ${nav.label}`, does: `Switches the screen to page ${nav.index}, ${nav.label}${nav.wrap ? ' (back to the start)' : ''}.`, sends: 'Built-in page action' };
  }
  if (key.native === 'scene') return { title: 'Switch profile', does: 'Rotates to your other Play Deck profiles (Keyboard, Touchbar, and any you add).', sends: 'Built-in Scene Shift' };
  switch (key.action) {
    case 'status': return { title: 'Claude status', does: 'Live state of your Claude Code sessions: Ready, Working (with the tool it is running), Approve?, Question, Done or Error. A badge counts busy sessions. Tap to jump to that session’s VS Code window and focus the Claude input.', sends: 'Reads ~/.duo87/state/claude (written by the hook)' };
    case 'view': return s.show === 'reply'
      ? { title: 'Claude’s last reply', does: 'Shows the start of Claude’s last reply. Tap to copy the full text.', sends: 'Copies to the clipboard' }
      : { title: 'Your last prompt', does: 'Shows the last prompt you sent to Claude Code. Tap to copy the full text.', sends: 'Copies to the clipboard' };
    case 'answer':
      if (s.answer === 'deny') return { title: 'Deny / Stop', does: 'Lights red while Claude waits for permission; tap to deny. While Claude is working it turns into Stop and interrupts it.', sends: pretty('esc') + ' in the Claude panel' };
      if (s.answer === 'always') return { title: 'Allow always', does: 'Approves the pending request and tells Claude not to ask again for it.', sends: '2 in the Claude panel' };
      return { title: 'Allow', does: 'Blinks green while Claude waits for permission; tap to approve once.', sends: '1 in the Claude panel' };
    case 'focus': return s.newChat
      ? { title: 'New Claude chat', does: 'Brings VS Code forward and starts a fresh Claude Code conversation.', sends: pretty('ctrl+alt+f17') + ' → Claude Code: New conversation' }
      : { title: 'Focus Claude', does: 'Brings VS Code forward and puts the cursor in the Claude input. Selected code is attached automatically.', sends: pretty('ctrl+alt+f16') + ' → Claude Code: Focus input' };
    case 'prompt': return { title: `Prompt: ${String(s.label || '').replace(/\n/g, ' ')}`, does: `“${s.prompt}”`, sends: `Focuses Claude, pastes the prompt${s.submit === false ? '' : ' and presses ↩'}` };
    case 'commit': return s.push
      ? { title: 'Smart Commit + Push', does: 'Same as Commit, then pushes (sets the upstream on a branch’s first push).', sends: pretty('ctrl+alt+f19') + ' → task “DUO87: Smart Commit + Push”' }
      : { title: 'Smart Commit', does: 'Stages everything if nothing is staged, has Claude Haiku write the message in your repo’s style, and shows it for editing before committing.', sends: pretty('ctrl+alt+f18') + ' → task “DUO87: Smart Commit”' };
    case 'repo': return { title: 'Repo status', does: 'Branch, changed-file count, and commits ahead/behind for the repo your latest Claude session is in. Tap to open Source Control.', sends: pretty('ctrl+shift+g') };
    case 'banner': {
      const where = slot && slot.of > 1 ? ['left', 'middle', 'right'][slot.of === 2 && slot.slot === 1 ? 2 : slot.slot] || `key ${slot.slot + 1}` : 'single';
      const tap = s.press && s.press !== 'auto' ? s.press : slot && slot.of > 1 && slot.slot === 0 ? 'branch' : 'scm';
      const [sentence, combo, command] = TAP[tap] || TAP.scm;
      return {
        title: `Git display (${where})`,
        does: 'One display across the whole row: repo, the full branch name, changed files, lines added/removed, commits ahead/behind, the last commit’s age, and any merge, rebase or conflicts in progress. It follows the repo of the Claude session you prompted most recently, SSH and Codespaces included. ' + sentence,
        sends: `${pretty(combo)} → ${command}`,
      };
    }
    case 'keys': {
      const k = String(s.keys || '').toLowerCase();
      const what = HYPER[k] || VSCODE_DEFAULTS[k] || 'Custom shortcut';
      return { title: String(s.label || '').replace(/\n/g, ' '), does: `${what}.`, sends: `${pretty(k)} to VS Code` };
    }
    case 'shell': return { title: String(s.label || 'Run'), does: `Runs: ${s.command}`, sends: 'Shell command' };
    default: return { title: key.action || key.native, does: '', sends: '' };
  }
}

function keySvg(key, nav, slot) {
  if (key.action === 'banner') return render.gitBanner(SAMPLE, { count: slot ? slot.of : 1, age: '3m' })[slot ? slot.slot : 0];
  if (key.action) return render.defaultKey(key.action, key.settings || {});
  return render.iconKey({ label: key.label || nav.label || '', icon: key.icon || nav.icon || 'next', color: key.color || 'gray', sub: key.sub != null ? key.sub : (nav.sub || '') });
}

// Screen rows of 3 keys. pos is "x,y" on the screen (0,0 = top-left).
const deck = pages.map((page, index) => {
  const keys = [];
  (page.rows || []).forEach((row, y) => {
    let run = [];
    const flush = () => { run.forEach((k, i) => { k.slot = { slot: i, of: run.length }; }); run = []; };
    row.forEach((key, x) => {
      if (!key) { flush(); return; }
      const k = { key, x, y };
      if (key.action === 'banner') run.push(k); else flush();
      keys.push(k);
    });
    flush();
  });
  return {
    name: page.name,
    index: index + 1,
    keys: keys.map(({ key, x, y, slot }) => {
      const nav = navigation(key, index);
      const svg = keySvg(key, nav, slot);
      return { pos: `${x},${y}`, wide: key.action === 'banner', svg, img: uri(svg), ...describe(key, nav, slot) };
    }),
  };
});

// The wide display in a few states, for step 6.
const banners = [
  { info: SAMPLE, age: '3m', caption: 'Working: 3 files changed, one commit to push' },
  { info: { project: 'api', branch: 'main', upstream: 'origin/main' }, age: '2h', caption: 'Clean and in sync with origin' },
  { info: { project: 'storefront', branch: 'feature/checkout-tax', conflicts: 2, changes: 5, op: { kind: 'rebase', step: 2, total: 5 }, ahead: 3, behind: 1, upstream: 'origin/x' }, age: '12m', heading: 'SSH', caption: 'On an SSH host, stopped mid-rebase with 2 conflicts' },
].map((b) => {
  const svgs = render.gitBanner(b.info, { count: 3, age: b.age, heading: b.heading });
  return { caption: b.caption, svgs, imgs: svgs.map(uri) };
});

const states = [
  { img: uri(render.statusKey({ state: 'working', project: 'storefront', detail: 'Bash · Run test suite', meta: '1:24', tick: 1 })), caption: 'Working: Claude is running a tool' },
  { img: uri(render.statusKey({ state: 'permission', project: 'storefront', detail: 'Bash: npm run migrate', tick: 0 })), caption: 'Approve?: Claude is waiting on you' },
  { img: uri(render.iconKey({ label: 'Allow', icon: 'check', color: 'green', sub: '1', strong: true })), caption: 'Allow lights up with it' },
  { img: uri(render.statusKey({ state: 'done', project: 'storefront', meta: '2m' })), caption: 'Done: your turn again' },
  { img: uri(render.busyKey({ label: 'Writing…', sub: 'storefront', tick: 2 })), caption: 'Smart Commit writing the message' },
  { img: uri(render.iconKey({ label: 'a1b2c3d', icon: 'check', color: 'green', sub: 'storefront', strong: true })), caption: 'Committed (short hash)' },
];

const hyperRows = Object.entries(HYPER).map(([combo, what]) => `<tr><td><kbd>${pretty(combo)}</kbd></td><td><code>${combo}</code></td><td>${what}</td></tr>`).join('\n');

const html = template
  .replace('/*__DECK__*/[]', JSON.stringify(deck.map((page) => ({ ...page, keys: page.keys.map(({ svg, ...k }) => k) }))))
  .replace('/*__STATES__*/[]', JSON.stringify(states))
  .replace('/*__BANNERS__*/[]', JSON.stringify(banners.map(({ svgs, ...b }) => b)))
  .replace('<!--__HYPER_ROWS__-->', hyperRows)
  .replace(/__GENERATED__/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`  ✓ guide → ${OUT.replace(os.homedir(), '~')} (${Math.round(html.length / 1024)} KB)`);

// README images, drawn from the same keys: each key is a nested <svg>, which clips to its own
// 144x144 box just like the screen does. Keys sit GAP apart, so the wide display lines up.
const K = 144;
const GAP = 36;
const LABEL_FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const nest = (svg, x, y) => svg.replace('<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"', `<svg x="${x}" y="${y}" width="${K}" height="${K}"`);
const doc = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;

const PAD = 40;
const pageW = 3 * K + 2 * GAP + 2 * PAD;
const pageH = 4 * K + 3 * GAP + 2 * PAD;
const SPACE = 56;
let pagesBody = '';
deck.forEach((page, i) => {
  const ox = i * (pageW + SPACE);
  pagesBody += `<rect x="${ox + 1}" y="1" width="${pageW - 2}" height="${pageH - 2}" rx="46" fill="#06080a" stroke="#2b323b" stroke-width="2"/>`;
  for (const k of page.keys) {
    const [x, y] = k.pos.split(',').map(Number);
    pagesBody += nest(k.svg, ox + PAD + x * (K + GAP), PAD + y * (K + GAP));
  }
  pagesBody += `<text x="${ox + pageW / 2}" y="${pageH + 50}" text-anchor="middle" font-family="${LABEL_FONT}" font-size="32" font-weight="bold" fill="#8b949e">${page.index} · ${page.name}</text>`;
});
fs.mkdirSync(IMAGES, { recursive: true });
fs.writeFileSync(path.join(IMAGES, 'deck.svg'), doc(deck.length * pageW + (deck.length - 1) * SPACE, pageH + 70, pagesBody));

const rowH = K + 2 * 18;
let wideBody = '';
banners.forEach((b, i) => {
  const oy = i * (rowH + 64);
  wideBody += `<rect x="0" y="${oy}" width="${3 * K + 2 * GAP + 36}" height="${rowH}" rx="26" fill="#000000"/>`;
  b.svgs.forEach((svg, j) => { wideBody += nest(svg, 18 + j * (K + GAP), oy + 18); });
  wideBody += `<text x="4" y="${oy + rowH + 38}" font-family="${LABEL_FONT}" font-size="24" fill="#8b949e">${b.caption}</text>`;
});
fs.writeFileSync(path.join(IMAGES, 'wide-display.svg'), doc(680, banners.length * (rowH + 64) - 12, wideBody));
console.log(`  ✓ README images → ${IMAGES.replace(os.homedir(), '~')}`);

// docs/keys.md: the same key reference for readers on GitHub.
const md = (v) => String(v || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const where = (pos) => { const [x, y] = pos.split(',').map(Number); return `row ${y + 1}, key ${x + 1}`; };
let keysMd = '# Keys\n\n'
  + '<!-- Generated by src/build-guide.js from profile/layout.json. Run `~/.duo87/bin/duo87 guide` to refresh. -->\n\n'
  + 'Every key on the Dev Deck, page by page. The screen is 3 keys wide and 4 tall; rows count from the top. '
  + 'The [interactive guide](https://bryanlittlefield.github.io/dev-deck/) shows the same keys on a preview of the screen.\n\n'
  + '![The three pages](images/deck.svg)\n';
for (const page of deck) {
  keysMd += `\n## ${page.index}. ${page.name}\n\n| Key | Name | What it does | Sends |\n|---|---|---|---|\n`;
  for (const k of page.keys) keysMd += `| ${where(k.pos)} | ${md(k.title)} | ${md(k.does)} | ${md(k.sends)} |\n`;
}
keysMd += '\n## F16–F19 bindings\n\nThese live in VS Code\'s user `keybindings.json` (template: [`vscode/keybindings.json`](../vscode/keybindings.json)). '
  + 'No physical key sends F16–F19, so they can\'t collide with anything.\n\n| Keys | keybindings.json | Runs |\n|---|---|---|\n';
for (const [combo, what] of Object.entries(HYPER)) keysMd += `| ${pretty(combo)} | \`${combo}\` | ${md(what)} |\n`;
fs.writeFileSync(path.join(DUO, 'docs/keys.md'), keysMd);
console.log('  ✓ key reference → docs/keys.md');
