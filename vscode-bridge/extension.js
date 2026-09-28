// DUO87 Dev Deck Bridge — runs on your Mac (UI side) in every VS Code window.
//
// In remote windows (Remote-SSH, Codespaces, Dev Containers, WSL) Claude Code runs on the remote,
// so its status hook writes ~/.duo87/state there. This extension copies those files into the Mac's
// ~/.duo87/state through VS Code's own remote file system (no tunnels, no extra SSH sessions), so
// the Play Deck shows remote sessions, their prompts, pending approvals and smart-commit progress.
'use strict';

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const LOCAL_STATE = path.join(os.homedir(), '.duo87', 'state');
const LOCAL_CLAUDE = path.join(LOCAL_STATE, 'claude');
const BRIDGES = path.join(LOCAL_STATE, 'bridges');

function remoteLabel(remoteName, authority) {
  let host = authority.slice(authority.indexOf('+') + 1);
  if (/^[0-9a-f]+$/i.test(host) && host.length % 2 === 0) {
    // Remote-SSH / Dev Containers hex-encode JSON when the host name isn't URI-safe.
    try {
      const info = JSON.parse(Buffer.from(host, 'hex').toString('utf8'));
      host = info.hostName || (info.hostPath && path.basename(info.hostPath)) || host;
    } catch {}
  }
  return host;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function activate(context) {
  const out = vscode.window.createOutputChannel('DUO87 Dev Deck');
  context.subscriptions.push(out);
  const remoteName = vscode.env.remoteName;
  const folder = (vscode.workspace.workspaceFolders || []).find((f) => f.uri.scheme === 'vscode-remote');
  let status = !remoteName ? 'local window (the Claude hook writes state directly)'
    : folder ? 'starting' : 'remote window with no folder open (nothing to mirror)';

  context.subscriptions.push(vscode.commands.registerCommand('duo87.bridge.status', () => {
    vscode.window.showInformationMessage(`DUO87 Dev Deck bridge: ${status}`);
    out.show(true);
  }));
  out.appendLine(status);
  if (!remoteName || !folder) return;

  const authority = folder.uri.authority;
  const id = 'r-' + crypto.createHash('sha1').update(authority).digest('hex').slice(0, 10);
  const prefix = `${id}-`;
  const label = remoteLabel(remoteName, authority);
  const heartbeat = path.join(BRIDGES, `${id}.json`);
  const uri = (p) => vscode.Uri.from({ scheme: 'vscode-remote', authority, path: p });
  const read = async (p) => JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(uri(p))).toString('utf8'));
  const seen = new Map(); // remote session file -> mtime
  let stateDir = null;
  let lastScan = 0;
  let commitMtime = 0;
  let busy = false;

  // The remote home isn't exposed to UI extensions, so look where ~/.duo87 usually is:
  // above the workspace folder (e.g. Kinsta), under /home/* and /Users/*, or /root.
  async function findStateDir() {
    const configured = vscode.workspace.getConfiguration('duo87').get('remoteStateDir');
    if (configured) return String(configured).replace(/\/+$/, '');
    const candidates = [];
    for (let p = folder.uri.path; p && p !== '/'; p = path.posix.dirname(p)) candidates.push(p);
    for (const base of ['/home', '/Users']) {
      try {
        for (const [name, type] of await vscode.workspace.fs.readDirectory(uri(base))) {
          if (type & vscode.FileType.Directory) candidates.push(`${base}/${name}`);
        }
      } catch {}
    }
    candidates.push('/root');
    let best = null;
    let bestTime = -1;
    for (const c of [...new Set(candidates)]) {
      try {
        const st = await vscode.workspace.fs.stat(uri(`${c}/.duo87/state/claude`));
        if (st.mtime > bestTime) { best = `${c}/.duo87/state`; bestTime = st.mtime; }
      } catch {}
    }
    return best;
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      writeJson(heartbeat, { ts: Date.now(), remote: remoteName, authority, label, stateDir });
      if (!stateDir && Date.now() - lastScan > 30000) {
        lastScan = Date.now();
        stateDir = await findStateDir();
        status = stateDir ? `mirroring ${label}:${stateDir}`
          : `no ~/.duo87/state on ${label} yet. Run "duo87 remote" (SSH) or "duo87 codespace" for this machine.`;
        out.appendLine(status);
      }
      if (!stateDir) return;

      let entries;
      try {
        entries = await vscode.workspace.fs.readDirectory(uri(`${stateDir}/claude`));
      } catch {
        stateDir = null;
        return;
      }
      const names = new Set();
      for (const [name, type] of entries) {
        if (!(type & vscode.FileType.File) || !name.endsWith('.json')) continue;
        names.add(name);
        const local = path.join(LOCAL_CLAUDE, prefix + name);
        const st = await vscode.workspace.fs.stat(uri(`${stateDir}/claude/${name}`));
        if (seen.get(name) === st.mtime && fs.existsSync(local)) continue;
        try {
          const data = await read(`${stateDir}/claude/${name}`);
          writeJson(local, { ...data, remote: remoteName, remoteAuthority: authority, remoteLabel: label, bridge: id });
          seen.set(name, st.mtime);
        } catch { /* mid-write on the remote; next tick picks it up */ }
      }
      for (const name of [...seen.keys()]) {
        if (names.has(name)) continue;
        seen.delete(name);
        try { fs.unlinkSync(path.join(LOCAL_CLAUDE, prefix + name)); } catch {}
      }

      // Smart-commit progress on the remote drives the Commit key.
      try {
        const st = await vscode.workspace.fs.stat(uri(`${stateDir}/commit.json`));
        if (st.mtime !== commitMtime) {
          commitMtime = st.mtime;
          const data = await read(`${stateDir}/commit.json`);
          let local = {};
          try { local = JSON.parse(fs.readFileSync(path.join(LOCAL_STATE, 'commit.json'), 'utf8')); } catch {}
          if (!local.ts || data.ts > local.ts) {
            writeJson(path.join(LOCAL_STATE, 'commit.json'), { ...data, remote: remoteName, remoteLabel: label });
          }
        }
      } catch {}
    } catch (e) {
      out.appendLine(`error: ${e.message}`);
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(tick, 1000);
  tick();
  context.subscriptions.push({
    dispose() {
      clearInterval(timer);
      for (const name of seen.keys()) {
        try { fs.unlinkSync(path.join(LOCAL_CLAUDE, prefix + name)); } catch {}
      }
      try { fs.unlinkSync(heartbeat); } catch {}
    },
  });
}

function deactivate() {}

module.exports = { activate, deactivate };
