// Dev Deck — DUO87 Play Deck (MiraBox StreamDock) plugin for developers.
//
// Live Claude Code status and prompts, answers to Claude's permission prompts, smart commits,
// repo status (one key, or a wide display across a row), editor shortcuts and shell commands. Runs on the Node 20 runtime bundled with
// the Play Deck app. State comes from ~/.duo87 (written by the Claude Code hook and smart-commit).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const WebSocket = require('ws');
const render = require('./render');
const gitInfo = require('./git-info');

const HOME = os.homedir();
const DUO = path.join(HOME, '.duo87');
const CLAUDE_DIR = path.join(DUO, 'state', 'claude');
const BRIDGE_DIR = path.join(DUO, 'state', 'bridges');
const COMMIT_FILE = path.join(DUO, 'state', 'commit.json');
const KEYS_BIN = path.join(DUO, 'bin', 'duo87-keys');
const LOG_FILE = path.join(DUO, 'logs', 'plugin.log');
const PREFIX = 'com.duo87.devdeck.';
const VSCODE = 'com.microsoft.VSCode';
const CODE_CLI = ['/usr/local/bin/code', '/opt/homebrew/bin/code',
  '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'].find((p) => fs.existsSync(p));

// Keybindings installed in VS Code's keybindings.json (see ~/.duo87/vscode/keybindings.json).
const HOTKEY = {
  claudeFocus: 'ctrl+alt+f16',
  claudeNew: 'ctrl+alt+f17',
  commit: 'ctrl+alt+f18',
  commitPush: 'ctrl+alt+f19',
  terminalFocus: 'ctrl+shift+f16',
};

const ENV = {
  ...process.env,
  PATH: ['/opt/homebrew/bin', '/usr/local/bin', path.join(HOME, '.local/bin'), '/usr/bin', '/bin', '/usr/sbin', '/sbin',
    process.env.PATH || ''].join(':'),
};

// ---------------------------------------------------------------------------------------------
// Logging

function log(...parts) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    const size = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;
    if (size > 1024 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  } catch {}
}
process.on('uncaughtException', (e) => log('uncaught', e.stack || String(e)));
process.on('unhandledRejection', (e) => log('unhandled', (e && e.stack) || String(e)));

// ---------------------------------------------------------------------------------------------
// Connection to the Play Deck app

function arg(name) {
  const i = process.argv.indexOf('-' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const PORT = arg('port');
const PLUGIN_UUID = arg('pluginUUID');
const REGISTER_EVENT = arg('registerEvent') || 'registerPlugin';
let INFO = {};
try { INFO = JSON.parse(arg('info') || '{}'); } catch {}

const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
ws.on('open', () => {
  send({ event: REGISTER_EVENT, uuid: PLUGIN_UUID });
  log('connected', { app: INFO.application, devices: INFO.devices });
  checkAccessibility();
});
ws.on('close', () => process.exit(0));
ws.on('error', (e) => log('ws error', e.message));
ws.on('message', (raw) => {
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  try { handle(msg); } catch (e) { log('handler error', msg.event, e.stack || String(e)); }
});

function send(obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

let DECK = {};
try { DECK = JSON.parse(fs.readFileSync(path.join(DUO, 'config.json'), 'utf8')).deck || {}; } catch {}

// Keys are sent as SVG. If a firmware/app version ever shows them blank, set
// "deck": { "imageFormat": "png" } in ~/.duo87/config.json to rasterize them first (no animations).
const PNG_MODE = DECK.imageFormat === 'png';
const pngCache = new Map();
const PNG_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'devdeck-'));
const MAGICK = ['/opt/homebrew/bin/magick', '/usr/local/bin/magick'].find((p) => fs.existsSync(p));

// Quick Look draws an SVG a little smaller than the thumbnail, into its top-left corner, on
// white. Render at double size, cut the drawing out, then scale it to 144.
function toPng(svg) {
  const key = require('crypto').createHash('sha1').update(svg).digest('hex');
  if (pngCache.has(key)) return Promise.resolve(pngCache.get(key));
  const svgFile = path.join(PNG_TMP, `${key}.svg`);
  fs.writeFileSync(svgFile, svg.replace('width="144" height="144"', 'width="288" height="288"'));
  const out = `${svgFile}.crop.png`;
  return run('/usr/bin/qlmanage', ['-t', '-s', '576', '-o', PNG_TMP, svgFile])
    .then(() => (MAGICK
      ? run(MAGICK, [`${svgFile}.png`, '-bordercolor', 'white', '-border', '1', '-fuzz', '8%', '-trim', '+repage', '-resize', '144x144!', out])
      : run('/usr/bin/sips', ['--cropToHeightWidth', '552', '552', '--cropOffset', '1', '1', `${svgFile}.png`, '--out', out])
        .then(() => run('/usr/bin/sips', ['-z', '144', '144', out]))))
    .then(() => {
      const url = 'data:image/png;base64,' + fs.readFileSync(out).toString('base64');
      if (pngCache.size > 300) pngCache.delete(pngCache.keys().next().value);
      pngCache.set(key, url);
      return url;
    });
}

const lastImage = new Map();
function setImage(context, svg) {
  if (lastImage.get(context) === svg) return;
  lastImage.set(context, svg);
  if (!PNG_MODE) {
    send({ event: 'setImage', context, payload: { target: 0, image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') } });
    return;
  }
  toPng(svg).then((image) => {
    if (lastImage.get(context) === svg) send({ event: 'setImage', context, payload: { target: 0, image } });
  }).catch((e) => log('png render failed', e.message));
}
const setTitle = (context, title) => send({ event: 'setTitle', context, payload: { target: 0, title } });
const showOk = (context) => send({ event: 'showOk', context });
const showAlert = (context) => send({ event: 'showAlert', context });

// ---------------------------------------------------------------------------------------------
// Action instances

const instances = new Map(); // context -> { kind, settings, device, coords }
let tick = 0;

// Columns of each device's grid as the app numbers it (the DUO87 reports 4x3).
const deviceColumns = new Map((INFO.devices || []).map((d) => [d.id, (d.size && d.size.columns) || 4]));

function handle(msg) {
  const { event, action, context, payload = {} } = msg;
  const kind = typeof action === 'string' && action.startsWith(PREFIX) ? action.slice(PREFIX.length) : null;
  switch (event) {
    case 'willAppear':
      if (!kind) return;
      instances.set(context, { kind, settings: payload.settings || {}, device: msg.device, coords: payload.coordinates || null });
      lastImage.delete(context);
      setTitle(context, '');
      if (kind === 'banner') { log('wide display key', { device: msg.device, coordinates: payload.coordinates }); soonBanners(); }
      else draw(context);
      break;
    case 'willDisappear': {
      const inst = instances.get(context);
      instances.delete(context);
      lastImage.delete(context);
      if (inst && inst.kind === 'banner') soonBanners();
      break;
    }
    case 'didReceiveSettings': {
      const inst = instances.get(context);
      if (inst) { inst.settings = payload.settings || {}; lastImage.delete(context); draw(context); }
      break;
    }
    case 'deviceDidConnect': {
      const size = payload.deviceInfo && payload.deviceInfo.size;
      if (msg.device && size && size.columns) deviceColumns.set(msg.device, size.columns);
      break;
    }
    case 'keyDown': {
      const inst = instances.get(context) || { kind, settings: payload.settings || {} };
      if (payload.settings) inst.settings = payload.settings;
      press(context, inst).catch((e) => { log('press failed', inst.kind, e.message); showAlert(context); });
      break;
    }
    case 'systemDidWakeUp':
      readClaude(); readCommit(); drawAll();
      break;
    default:
      break;
  }
}

function drawAll() {
  for (const [context, inst] of instances) if (inst.kind !== 'banner') draw(context);
  drawBanners();
}

// ---------------------------------------------------------------------------------------------
// Claude Code state (written by ~/.duo87/bin/claude-status-hook.js)

const PRIORITY = { permission: 6, question: 5, error: 4, working: 3, done: 2, idle: 1 };
const REMOTE_HEADINGS = { 'ssh-remote': 'SSH', codespaces: 'CODESPACE', 'dev-container': 'CONTAINER', 'attached-container': 'CONTAINER', wsl: 'WSL', tunnel: 'TUNNEL' };
let claude = { sessions: [], primary: null, latestPrompt: null, latestReply: null };

// Remote sessions are mirrored by the VS Code bridge extension; trust them only while that
// window's bridge is alive (it rewrites its heartbeat every second).
function bridgeAlive(id, cache) {
  if (!cache.has(id)) {
    let alive = false;
    try { alive = Date.now() - JSON.parse(fs.readFileSync(path.join(BRIDGE_DIR, `${id}.json`), 'utf8')).ts < 15000; } catch {}
    cache.set(id, alive);
  }
  return cache.get(id);
}

function readClaude() {
  const now = Date.now();
  const sessions = [];
  const bridges = new Map();
  let files = [];
  try { files = fs.readdirSync(CLAUDE_DIR).filter((f) => f.endsWith('.json')); } catch {}
  for (const f of files) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(CLAUDE_DIR, f), 'utf8'));
      const age = now - (s.ts || 0);
      // Sessions that crash never send SessionEnd; drop them once they are clearly stale.
      if (s.state === 'working' ? age > 2 * 3600e3 : age > 12 * 3600e3) continue;
      if (s.bridge && !bridgeAlive(s.bridge, bridges)) continue;
      sessions.push(s);
    } catch {}
  }
  sessions.sort((a, b) => (PRIORITY[b.state] || 0) - (PRIORITY[a.state] || 0) || (b.ts || 0) - (a.ts || 0));
  const byPrompt = sessions.filter((s) => s.prompt).sort((a, b) => (b.promptTs || 0) - (a.promptTs || 0));
  const byReply = sessions.filter((s) => s.reply).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  claude = { sessions, primary: sessions[0] || null, latestPrompt: byPrompt[0] || null, latestReply: byReply[0] || null };
}

let commitState = null;
function readCommit() {
  try { commitState = JSON.parse(fs.readFileSync(COMMIT_FILE, 'utf8')); } catch { commitState = null; }
}

function watch(dir, onChange) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    let timer = null;
    fs.watch(dir, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 60);
    });
  } catch (e) {
    log('watch failed', dir, e.message);
  }
}

watch(CLAUDE_DIR, () => { readClaude(); drawAll(); });
watch(path.dirname(COMMIT_FILE), () => { readCommit(); drawAll(); });
readClaude();
readCommit();

// Heartbeat: animations, relative times, and a safety re-read in case fs.watch misses events.
let beat = 0;
setInterval(() => {
  beat += 1;
  if (!PNG_MODE) tick = beat; // PNG mode: no spinners/blinking, so images rarely change
  if (beat % 3 === 0) { readClaude(); readCommit(); }
  drawAll();
}, 1000);

// ---------------------------------------------------------------------------------------------
// Repo status (for repo keys)

const repoCache = new Map(); // dir -> { info, at, pending }

// The repo you're working in: from settings, else the Claude session you prompted most recently
// that is in a git repo (a remote one carries a git snapshot from the hook, since its files
// aren't reachable from the Mac), else your last smart commit's repo. Going by your prompts,
// not every tool call, keeps it steady while Claude works in several places.
function activeRepo(settings) {
  if (settings && settings.repo) return { dir: settings.repo.replace(/^~(?=\/|$)/, HOME) };
  const inRepo = (session) => {
    if (session.remote) return Boolean(session.git);
    const dir = session.root || session.cwd || '';
    return Boolean(dir) && (repoInfo(dir).error || '') !== 'not a git repo';
  };
  const recent = (session) => session.promptTs || session.ts || 0;
  const pick = claude.sessions.filter(inRepo).sort((a, b) => recent(b) - recent(a))[0];
  if (pick && pick.remote) return { remote: pick };
  if (pick) return { dir: pick.root || pick.cwd, session: pick };
  if (commitState && commitState.repo && !commitState.remote) return { dir: commitState.repo };
  return { dir: '' };
}

function activeRepoDir(settings) {
  return activeRepo(settings).dir || '';
}

function repoInfo(dir) {
  if (!dir) return { error: 'no repo yet' };
  const cached = repoCache.get(dir);
  if (!cached || (!cached.pending && Date.now() - cached.at > 4000)) {
    const entry = cached || { info: null, at: 0 };
    entry.pending = true;
    repoCache.set(dir, entry);
    gitInfo.snapshot(dir, { env: ENV }).then((info) => {
      const next = info ? { project: path.basename(dir), ...info } : { project: path.basename(dir), error: 'not a git repo' };
      const changed = JSON.stringify({ ...next, ts: 0 }) !== JSON.stringify({ ...(entry.info || {}), ts: 0 });
      entry.pending = false;
      entry.at = Date.now();
      entry.info = next;
      if (changed) drawAll();
    });
  }
  return (repoCache.get(dir) || {}).info || { project: path.basename(dir), error: 'reading git…' };
}

// ---------------------------------------------------------------------------------------------
// Wide displays: banner keys side by side in one screen row are drawn as one display.
//
// The DUO87 screen is portrait: 3 keys across and 4 down, filled in the order the app numbers
// its 4x3 grid ("column,row", row by row). Override with "deck": { "screenColumns": N }.

const SCREEN_COLUMNS = DECK.screenColumns || 3;

function screenPos(inst) {
  if (inst.coords && Number.isInteger(inst.coords.column) && Number.isInteger(inst.coords.row)) {
    const i = inst.coords.row * (deviceColumns.get(inst.device) || 4) + inst.coords.column;
    return { row: `${inst.device}|${Math.floor(i / SCREEN_COLUMNS)}`, x: i % SCREEN_COLUMNS };
  }
  // No coordinates from the app: use the slot baked into the profile by `duo87 build`.
  const s = inst.settings || {};
  if (s.group != null) return { row: `${inst.device}|g${s.group}`, x: +s.slot || 0 };
  return null;
}

// Runs of adjacent banner keys, each left to right: [[context, …], …]
function bannerGroups() {
  const rows = new Map();
  const alone = [];
  for (const [context, inst] of instances) {
    if (inst.kind !== 'banner') continue;
    const pos = screenPos(inst);
    if (!pos) { alone.push([context]); continue; }
    if (!rows.has(pos.row)) rows.set(pos.row, []);
    rows.get(pos.row).push({ context, x: pos.x });
  }
  const groups = [...alone];
  for (const keys of rows.values()) {
    keys.sort((a, b) => a.x - b.x);
    let run = [];
    for (const k of keys) {
      if (run.length && k.x !== run[run.length - 1].x + 1) { groups.push(run.map((r) => r.context)); run = []; }
      run.push(k);
    }
    if (run.length) groups.push(run.map((r) => r.context));
  }
  return groups;
}

function commitAge(ts) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 48 * 60) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function bannerImages(settings, count) {
  const repo = activeRepo(settings);
  if (repo.remote) {
    const r = repo.remote;
    // Snapshots from an older remote kit lack "upstream"; show their ahead/behind anyway.
    const info = r.git ? { project: r.project, upstream: 'unknown', ...r.git } : { project: r.project, error: 'waiting for git' };
    return render.gitBanner(info, { count, heading: REMOTE_HEADINGS[r.remote] || 'REMOTE', age: commitAge(info.last && info.last.ts) });
  }
  const info = repoInfo(repo.dir);
  return render.gitBanner(info, { count, age: commitAge(info.last && info.last.ts) });
}

function drawBanners() {
  for (const group of bannerGroups()) {
    const images = bannerImages(instances.get(group[0]).settings || {}, group.length);
    group.forEach((context, i) => setImage(context, images[i]));
  }
}

// Page switches bring keys in one at a time; wait for the whole row before drawing it.
let bannerTimer = null;
function soonBanners() {
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(drawBanners, 80);
}

// What tapping a banner key does: the leftmost key switches branch, the others open Source
// Control. Nothing pushes by default (VS Code's Sync can push without asking); a key's "press"
// setting can choose sync, pull, push or GitHub instead.
const BANNER_TAPS = {
  branch: 'cmd+alt+f17', scm: 'ctrl+shift+g', sync: 'ctrl+shift+f19', pull: 'ctrl+shift+f17', push: 'ctrl+shift+f18', github: 'alt+shift+f18',
};
function bannerTap(context, settings) {
  if (settings.press && settings.press !== 'auto') return settings.press;
  const group = bannerGroups().find((g) => g.includes(context)) || [context];
  return group.length > 1 && group[0] === context ? 'branch' : 'scm';
}

// ---------------------------------------------------------------------------------------------
// Drawing

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - (ts || 0)) / 1000));
  if (s < 60) return PNG_MODE ? 'now' : `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function elapsed(ts) {
  const s = Math.max(0, Math.round((Date.now() - (ts || 0)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function pendingAsk() {
  return claude.sessions.find((s) => s.state === 'permission' || s.state === 'question') || null;
}

function draw(context) {
  const inst = instances.get(context);
  if (!inst) return;
  const s = inst.settings || {};
  const p = claude.primary;
  switch (inst.kind) {
    case 'status': {
      if (!p) return setImage(context, render.statusKey({ state: 'none', project: 'Start Claude', tick }));
      const live = claude.sessions.filter((x) => x.state === 'working' || x.state === 'permission' || x.state === 'question').length;
      let detail = '';
      if (p.state === 'working') detail = [p.tool, p.detail].filter(Boolean).join(' · ') || 'Thinking…';
      else if (p.state === 'permission' || p.state === 'question') detail = p.ask || p.message || '';
      else if (p.state === 'error') detail = String(p.error || '').replace(/_/g, ' ');
      const meta = p.state === 'working' && !PNG_MODE ? elapsed(p.since || p.promptTs) : ago(p.ts);
      const heading = REMOTE_HEADINGS[p.remote] || (p.remote ? 'REMOTE' : 'CLAUDE');
      return setImage(context, render.statusKey({ state: p.state, project: p.project, detail, meta, count: live, tick, heading }));
    }
    case 'view': {
      const reply = s.show === 'reply';
      const src = reply ? claude.latestReply : claude.latestPrompt;
      return setImage(context, render.textKey({
        heading: reply ? 'CLAUDE' : 'YOU',
        color: reply ? 'claude' : 'blue',
        body: src ? (reply ? src.reply : src.prompt) : '',
        meta: src ? ago(reply ? src.ts : src.promptTs) : '',
        empty: reply ? "Claude's last reply shows here" : 'Your last prompt shows here',
      }));
    }
    case 'answer': {
      const ask = pendingAsk();
      const answer = s.answer || 'allow';
      if (answer === 'deny') {
        const working = claude.sessions.some((x) => x.state === 'working');
        if (!ask && working) return setImage(context, render.iconKey({ label: 'Stop', icon: 'stop', color: 'red', sub: 'Esc' }));
        return setImage(context, render.iconKey({ label: 'Deny', icon: 'x', color: 'red', sub: ask ? 'Esc' : '', dim: !ask, strong: Boolean(ask) }));
      }
      const look = answer === 'always'
        ? { label: 'Always', icon: 'checks', sub: '2' }
        : { label: 'Allow', icon: 'check', sub: '1' };
      const blink = answer === 'allow' ? tick % 2 === 0 : true;
      return setImage(context, render.iconKey({ ...look, color: 'green', dim: !ask, strong: Boolean(ask) && blink, sub: ask ? look.sub : '' }));
    }
    case 'focus':
    case 'prompt':
    case 'keys':
    case 'shell':
      return setImage(context, render.defaultKey(inst.kind, s));
    case 'commit': {
      const c = commitState;
      const fresh = c && Date.now() - (c.ts || 0) < (c.status === 'running' ? 5 * 60e3 : 2 * 60e3);
      if (fresh && c.status === 'running') {
        const step = { staging: 'Staging…', writing: 'Writing…', confirm: 'Confirm…', pushing: 'Pushing…' }[c.step] || 'Working…';
        return setImage(context, render.busyKey({ label: step, sub: c.project, tick }));
      }
      if (fresh && c.status === 'success') {
        return setImage(context, render.iconKey({ label: c.hash || 'Done', icon: c.pushed ? 'push' : 'check', color: 'green', sub: c.project, strong: true }));
      }
      if (fresh && c.status === 'error') {
        return setImage(context, render.iconKey({ label: 'Failed', icon: 'x', color: 'red', sub: c.project, strong: true }));
      }
      if (fresh && c.status === 'nothing') {
        return setImage(context, render.iconKey({ label: 'No changes', icon: 'commit', color: 'gray', sub: c.project }));
      }
      return setImage(context, render.defaultKey('commit', s));
    }
    case 'banner':
      return soonBanners();
    case 'repo': {
      const repo = activeRepo(s);
      if (repo.remote) {
        const r = repo.remote;
        return setImage(context, render.repoKey(r.git ? { project: r.project, ...r.git } : { project: r.project, error: 'waiting for git info' }));
      }
      return setImage(context, render.repoKey(repoInfo(repo.dir)));
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Doing things

function run(file, args, options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { env: ENV, timeout: 20000, ...options }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function keys(context, steps) {
  const r = await run(KEYS_BIN, steps);
  if (r.code !== 0) {
    log('duo87-keys failed', r.code, r.stderr.trim(), steps.join(' '));
    showAlert(context);
    if (r.code === 3) notify('Dev Deck needs Accessibility access',
      'System Settings > Privacy & Security > Accessibility > enable DUO87_Play_Deck, then restart it.');
  }
  return r.code === 0;
}

function notify(title, message) {
  execFile('osascript', ['-e', 'on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run', title, message], { env: ENV });
}

async function checkAccessibility() {
  const r = await run(KEYS_BIN, ['check']);
  log('accessibility check:', r.stdout.trim() || r.stderr.trim());
}

// Where to send keys for a Claude session: its VS Code window, a VS Code terminal, or a terminal app.
function sessionTarget(session) {
  if (session && session.remoteAuthority) {
    // Remote window (SSH, Codespaces, container): reopening its folder URI focuses that window.
    const folder = session.root || session.cwd || '';
    const folderUri = folder ? `vscode-remote://${session.remoteAuthority}${encodeURI(folder)}` : '';
    return { app: VSCODE, folderUri, focus: session.term === 'vscode' && session.entrypoint !== 'claude-vscode' ? HOTKEY.terminalFocus : HOTKEY.claudeFocus };
  }
  if (!session || session.entrypoint === 'claude-vscode' || !session.term) {
    return { app: VSCODE, folder: session && (session.root || session.cwd), focus: HOTKEY.claudeFocus };
  }
  switch (session.term) {
    case 'vscode': return { app: VSCODE, folder: session.root || session.cwd, focus: HOTKEY.terminalFocus };
    case 'iTerm.app': return { app: 'com.googlecode.iterm2' };
    case 'Apple_Terminal': return { app: 'com.apple.Terminal' };
    case 'WarpTerminal': return { app: 'dev.warp.Warp-Stable' };
    case 'ghostty': return { app: 'com.mitchellh.ghostty' };
    default: return { app: VSCODE, folder: session.root || session.cwd, focus: HOTKEY.claudeFocus };
  }
}

// Bring the right window forward. `code <folder>` focuses the VS Code window that has it open.
async function focusSession(session) {
  const t = sessionTarget(session);
  if (t.app === VSCODE && t.folderUri && CODE_CLI) {
    await run(CODE_CLI, ['--folder-uri', t.folderUri], { timeout: 8000 });
  } else if (t.app === VSCODE && t.folder && CODE_CLI && fs.existsSync(t.folder)) {
    await run(CODE_CLI, [t.folder], { timeout: 8000 });
  }
  const steps = ['activate', t.app];
  if (t.focus) steps.push('wait', '80', 'key', t.focus, 'wait', '320');
  return steps;
}

// Bring forward the VS Code window of the repo a git key shows (its Claude session's window,
// remote ones included), so git commands land in the right workspace.
async function focusRepoWindow(settings) {
  const repo = activeRepo(settings);
  const session = repo.remote || repo.session;
  if (session && CODE_CLI && (session.remoteAuthority || session.entrypoint === 'claude-vscode' || session.term === 'vscode')) {
    const t = sessionTarget(session);
    if (t.folderUri) await run(CODE_CLI, ['--folder-uri', t.folderUri], { timeout: 8000 });
    else if (t.folder && fs.existsSync(t.folder)) await run(CODE_CLI, [t.folder], { timeout: 8000 });
  }
  return ['activate', VSCODE, 'wait', '120'];
}

async function press(context, inst) {
  const s = inst.settings || {};
  switch (inst.kind) {
    case 'status': {
      const target = pendingAsk() || claude.primary;
      const steps = await focusSession(target);
      return keys(context, steps);
    }
    case 'focus': {
      const steps = ['activate', VSCODE, 'wait', '80', 'key', s.newChat ? HOTKEY.claudeNew : HOTKEY.claudeFocus];
      return keys(context, steps);
    }
    case 'view': {
      const reply = s.show === 'reply';
      const src = reply ? claude.latestReply : claude.latestPrompt;
      const textValue = src ? (reply ? src.reply : src.prompt) : '';
      if (!textValue) return showAlert(context);
      // Copy the full text (the key only shows the start of it).
      const pb = spawn('pbcopy', { env: ENV });
      pb.stdin.end(textValue);
      return showOk(context);
    }
    case 'answer': {
      const ask = pendingAsk();
      const answer = s.answer || 'allow';
      if (!ask) {
        const working = claude.sessions.find((x) => x.state === 'working');
        if (answer === 'deny' && working) {
          const steps = await focusSession(working);
          return keys(context, [...steps, 'key', 'esc']);
        }
        return showAlert(context);
      }
      const key = answer === 'deny' ? 'esc' : answer === 'always' ? '2' : '1';
      const steps = await focusSession(ask);
      const ok = await keys(context, [...steps, 'wait', '150', 'key', key]);
      if (ok) showOk(context);
      return ok;
    }
    case 'prompt': {
      const text = String(s.prompt || '').trim();
      if (!text) return showAlert(context);
      const steps = [];
      if ((s.target || 'vscode') === 'vscode') {
        steps.push('activate', VSCODE, 'wait', '80');
        if (s.newChat) steps.push('key', HOTKEY.claudeNew, 'wait', '600');
        steps.push('key', HOTKEY.claudeFocus, 'wait', '350');
      }
      steps.push('paste', text);
      if (s.submit !== false) steps.push('wait', '150', 'key', 'enter');
      return keys(context, steps);
    }
    case 'commit': {
      if (commitState && commitState.status === 'running' && Date.now() - commitState.ts < 5 * 60e3) {
        return showAlert(context); // one at a time
      }
      return keys(context, ['activate', VSCODE, 'wait', '120', 'key', s.push ? HOTKEY.commitPush : HOTKEY.commit]);
    }
    case 'repo': {
      const steps = await focusRepoWindow(s);
      return keys(context, [...steps, 'key', 'ctrl+shift+g']);
    }
    case 'banner': {
      const combo = BANNER_TAPS[bannerTap(context, s)];
      if (!combo) return undefined; // "none"
      const steps = await focusRepoWindow(s);
      return keys(context, [...steps, 'key', combo]);
    }
    case 'keys': {
      const combos = String(s.keys || '').trim().split(/\s+/).filter(Boolean);
      if (!combos.length) return showAlert(context);
      const steps = [];
      if (s.app !== 'none') steps.push('activate', s.app || VSCODE, 'wait', '60');
      combos.forEach((combo, i) => { if (i) steps.push('wait', '60'); steps.push('key', combo); });
      return keys(context, steps);
    }
    case 'shell': {
      const command = String(s.command || '').trim();
      if (!command) return showAlert(context);
      let cwd = s.cwd ? s.cwd.replace(/^~(?=\/|$)/, HOME) : HOME;
      if (!s.cwd || s.cwd === '{repo}') cwd = activeRepoDir({}) || HOME;
      const r = await run('/bin/zsh', ['-lc', command], { cwd, timeout: 120000 });
      log('shell', command, 'in', cwd, '->', r.code, (r.stderr || r.stdout).trim().slice(0, 300));
      if (r.code === 0) showOk(context);
      else { showAlert(context); notify(s.label || 'Command failed', (r.stderr || r.stdout).trim().slice(0, 180) || `exit ${r.code}`); }
      return r.code === 0;
    }
    default:
      return undefined;
  }
}
