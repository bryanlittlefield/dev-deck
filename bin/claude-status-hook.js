#!/usr/bin/env node
// Claude Code hook -> ~/.duo87/state/claude/<session>.json
//
// Registered (async) for every lifecycle event in ~/.claude/settings.json. The DUO87 Dev Deck
// plugin watches these files to show live Claude status, your last prompt, Claude's last reply,
// and pending permission requests on the Play Deck touch screen.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), '.duo87', 'state', 'claude');
const startedAt = Date.now();
// Events after which the repo may have changed; the deck shows this snapshot for remote repos.
const GIT_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'Stop', 'SubagentStop']);
const GIT_TOOLS = new Set(['Bash', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

// Ships next to this file (also in the remote kit). Without it the hook still reports status.
let gitInfo = null;
try { gitInfo = require('./git-info.js'); } catch {}

function gitSnapshot(dir) {
  return gitInfo ? gitInfo.snapshotSync(dir) : null;
}

function writeState(file, state) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function clip(text, max) {
  if (typeof text !== 'string') return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

function toolDetail(name, input) {
  input = input || {};
  const base = (p) => (typeof p === 'string' ? path.basename(p) : '');
  switch (name) {
    case 'Bash': return clip(input.description || input.command, 80);
    case 'Edit': case 'MultiEdit': case 'Write': case 'Read': case 'NotebookEdit':
      return base(input.file_path || input.notebook_path);
    case 'Grep': case 'Glob': return clip(input.pattern, 60);
    case 'WebFetch': try { return new URL(input.url).host; } catch { return ''; }
    case 'WebSearch': return clip(input.query, 60);
    case 'Task': case 'Agent': return clip(input.description || input.subagent_type, 60);
    case 'AskUserQuestion': {
      const q = Array.isArray(input.questions) && input.questions[0];
      return clip((q && (q.question || q.header)) || 'Question', 80);
    }
    default: return '';
  }
}

function toolLabel(name) {
  if (typeof name !== 'string') return '';
  const mcp = name.match(/^mcp__(.+?)__(.+)$/);
  return mcp ? `${mcp[1]}: ${mcp[2]}` : name;
}

function main(input) {
  const event = input.hook_event_name;
  const sid = String(input.session_id || 'unknown').replace(/[^\w.-]/g, '_');
  const file = path.join(DIR, sid + '.json');

  if (event === 'SessionEnd') {
    try { fs.unlinkSync(file); } catch {}
    return;
  }

  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  // Async hooks can finish out of order; never let an older event overwrite a newer one.
  if (prev.ts && prev.ts > startedAt) return;

  const s = Object.assign({}, prev, {
    session: sid,
    cwd: input.cwd || prev.cwd || '',
    root: process.env.CLAUDE_PROJECT_DIR || prev.root || input.cwd || '',
    event,
    ts: startedAt,
    mode: input.permission_mode || prev.mode || '',
    entrypoint: process.env.CLAUDE_CODE_ENTRYPOINT || prev.entrypoint || '',
    term: process.env.TERM_PROGRAM || prev.term || '',
  });
  if (s.root || s.cwd) s.project = path.basename(s.root || s.cwd);
  const subagent = Boolean(input.agent_id);

  switch (event) {
    case 'SessionStart':
      Object.assign(s, { state: 'idle', tool: '', detail: '', ask: '', since: startedAt });
      break;
    case 'UserPromptSubmit':
      Object.assign(s, {
        state: 'working', prompt: clip(input.prompt, 600), promptTs: startedAt,
        reply: '', tool: '', detail: '', ask: '', since: startedAt,
      });
      break;
    case 'PreToolUse': {
      const tool = input.tool_name || '';
      if (tool === 'AskUserQuestion' && !subagent) {
        Object.assign(s, { state: 'question', tool, detail: '', ask: toolDetail(tool, input.tool_input) });
      } else {
        Object.assign(s, { state: 'working', tool: toolLabel(tool), detail: toolDetail(tool, input.tool_input) });
      }
      break;
    }
    case 'PermissionRequest':
      Object.assign(s, {
        state: 'permission', tool: toolLabel(input.tool_name),
        ask: [toolLabel(input.tool_name), toolDetail(input.tool_name, input.tool_input)].filter(Boolean).join(': '),
      });
      break;
    case 'PostToolUse':
    case 'PostToolUseFailure':
      if (s.state === 'permission' || s.state === 'question' || s.state === 'working') {
        Object.assign(s, { state: 'working', ask: '' });
      }
      if (event === 'PostToolUseFailure') s.lastError = clip(input.error, 120);
      break;
    case 'Notification': {
      const type = input.notification_type || '';
      if (type === 'permission_prompt') {
        Object.assign(s, { state: 'permission', ask: s.ask || clip(input.message, 80) });
      } else if (type === 'elicitation_dialog' || type === 'agent_needs_input') {
        Object.assign(s, { state: 'question', ask: clip(input.message, 80) });
      } else if (type === 'idle_prompt' && s.state !== 'permission') {
        s.state = 'done';
      }
      s.message = clip(input.message, 120);
      break;
    }
    case 'Stop':
      Object.assign(s, {
        state: 'done', reply: clip(input.last_assistant_message, 600),
        tool: '', detail: '', ask: '', since: startedAt,
      });
      break;
    case 'StopFailure':
      Object.assign(s, { state: 'error', error: input.error_type || 'unknown', ask: '', since: startedAt });
      break;
    case 'SubagentStop':
      if (s.state !== 'permission' && s.state !== 'question') s.state = 'working';
      break;
    default:
      break;
  }

  writeState(file, s);

  // Git snapshot last: it can take a moment, so merge it into whatever is current by then.
  const repoDir = s.root || s.cwd;
  const wantsGit = GIT_EVENTS.has(event) || (event === 'PostToolUse' && GIT_TOOLS.has(input.tool_name));
  if (!wantsGit || !repoDir) return;
  const git = gitSnapshot(repoDir);
  if (!git) return;
  let current;
  try { current = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; } // session ended meanwhile
  if (current.git && current.git.ts > git.ts) return;
  writeState(file, { ...current, git });
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try { main(JSON.parse(raw || '{}')); } catch { /* never disturb Claude Code */ }
  process.exit(0);
});
