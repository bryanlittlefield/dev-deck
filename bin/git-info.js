// Git summary for the Dev Deck: branch, changed files, ahead/behind, stash, last commit, and any
// merge/rebase in progress. Used by the Claude status hook (sync, also on SSH hosts and
// codespaces) and by the Play Deck plugin (async). Every command runs with optional locks off,
// so polling never holds .git/index.lock while you run git yourself.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const COMMANDS = {
  status: ['status', '--porcelain=v2', '--branch', '--show-stash'],
  gitDir: ['rev-parse', '--absolute-git-dir'],
  last: ['log', '-1', '--format=%h%x1f%ct%x1f%s'],
  diff: ['diff', 'HEAD', '--shortstat'],
};

const args = (dir, cmd) => ['--no-optional-locks', '-C', dir, ...cmd];

function parseStatus(out) {
  const info = {
    branch: '', detached: false, oid: '', upstream: '', ahead: 0, behind: 0,
    staged: 0, unstaged: 0, untracked: 0, conflicts: 0, changes: 0, stash: 0,
  };
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.oid ')) info.oid = line.slice(13) === '(initial)' ? '' : line.slice(13, 20);
    else if (line.startsWith('# branch.head ')) info.branch = line.slice(14);
    else if (line.startsWith('# branch.upstream ')) info.upstream = line.slice(18);
    else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) { info.ahead = +m[1]; info.behind = +m[2]; }
    } else if (line.startsWith('# stash ')) info.stash = +line.slice(8) || 0;
    else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      info.changes += 1;
      if (line[2] !== '.') info.staged += 1;
      if (line[3] !== '.') info.unstaged += 1;
    } else if (line.startsWith('u ')) { info.changes += 1; info.conflicts += 1; }
    else if (line.startsWith('? ')) { info.changes += 1; info.untracked += 1; }
  }
  if (info.branch === '(detached)') { info.detached = true; info.branch = info.oid || 'detached'; }
  return info;
}

function parseLast(out) {
  const [hash, ts, subject] = String(out || '').trim().split('\x1f');
  return hash ? { hash, ts: (+ts || 0) * 1000, subject: (subject || '').slice(0, 200) } : null;
}

function parseDiff(out) {
  const n = (re) => +((String(out || '').match(re) || [])[1] || 0);
  return { files: n(/(\d+) files? changed/), ins: n(/(\d+) insertions?/), del: n(/(\d+) deletions?/) };
}

// Merge, rebase (with step), cherry-pick, revert or bisect in progress.
function operation(gitDir) {
  if (!gitDir) return null;
  const has = (p) => fs.existsSync(path.join(gitDir, p));
  const read = (p) => { try { return fs.readFileSync(path.join(gitDir, p), 'utf8').trim(); } catch { return ''; } };
  for (const d of ['rebase-merge', 'rebase-apply']) {
    if (has(d)) {
      const step = +(read(`${d}/msgnum`) || read(`${d}/next`)) || 0;
      const total = +(read(`${d}/end`) || read(`${d}/last`)) || 0;
      return { kind: 'rebase', step, total };
    }
  }
  if (has('MERGE_HEAD')) return { kind: 'merge' };
  if (has('CHERRY_PICK_HEAD')) return { kind: 'cherry-pick' };
  if (has('REVERT_HEAD')) return { kind: 'revert' };
  if (has('BISECT_LOG')) return { kind: 'bisect' };
  return null;
}

function combine(results) {
  const info = parseStatus(results.status);
  info.op = operation(String(results.gitDir || '').trim());
  info.last = parseLast(results.last);
  Object.assign(info, parseDiff(results.diff));
  info.ts = Date.now();
  return info;
}

// Blocking version for the hook. Returns null outside a git repo.
function snapshotSync(dir, { timeout = 3000 } = {}) {
  const run = (cmd) => execFileSync('git', args(dir, cmd), { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] });
  const soft = (cmd) => { try { return run(cmd); } catch { return ''; } };
  let status;
  try { status = run(COMMANDS.status); } catch { return null; }
  return combine({ status, gitDir: soft(COMMANDS.gitDir), last: soft(COMMANDS.last), diff: soft(COMMANDS.diff) });
}

// Non-blocking version for the plugin. Resolves to null outside a git repo.
function snapshot(dir, { env = process.env, timeout = 4000 } = {}) {
  const run = (cmd) => new Promise((resolve) => {
    execFile('git', args(dir, cmd), { env, timeout }, (err, stdout) => resolve(err ? null : String(stdout)));
  });
  return Promise.all([run(COMMANDS.status), run(COMMANDS.gitDir), run(COMMANDS.last), run(COMMANDS.diff)])
    .then(([status, gitDir, last, diff]) => (status == null ? null : combine({ status, gitDir, last, diff })));
}

module.exports = { snapshot, snapshotSync, parseStatus, parseLast, parseDiff };
