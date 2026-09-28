// SVG key renderer for Dev Deck. Keys are drawn at 144x144 and scaled by the Play Deck app.
// Sticks to SVG features Qt's renderer supports: no CSS, filters, masks or foreignObject.
'use strict';

const SIZE = 144;
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';

const C = {
  bg: '#0d1117', text: '#e6edf3', muted: '#8b949e', faint: '#484f58',
  claude: '#d97757', blue: '#58a6ff', green: '#3fb950', amber: '#d29922', red: '#f85149',
  purple: '#bc8cff', teal: '#39c5cf', pink: '#f778ba', gray: '#8b949e', orange: '#f0883e',
};

// Stroke icons on a 24x24 grid (Lucide-style shapes, drawn from scratch).
const ICONS = {
  spark: '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  reply: '<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.3 19.2A1.2 1.2 0 0 0 5.3 21h13.4a1.2 1.2 0 0 0 1-1.8L14 9.5V3"/><path d="M7.5 15h9"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  refactor: '<path d="M21 4v6h-6"/><path d="M3 20v-6h6"/><path d="M5.5 9A7.5 7.5 0 0 1 18 6.5L21 10"/><path d="M3 14l3 3.5A7.5 7.5 0 0 0 18.5 15"/>',
  compress: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  checks: '<path d="M17 6L7 16l-4.5-4.5"/><path d="M22 9l-7.5 7.5-1.5-1.5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M2.5 12h6"/><path d="M15.5 12h6"/>',
  push: '<path d="M12 20V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/><path d="M4 21h16"/>',
  pull: '<path d="M12 4v15"/><path d="M5.5 12.5L12 19l6.5-6.5"/><path d="M4 3h16"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  pr: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M15 3.5L12.5 6 15 8.5"/>',
  globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19"/><path d="M12 2.5a14.5 14.5 0 0 1 0 19a14.5 14.5 0 0 1 0-19"/>',
  stash: '<rect x="2.5" y="3.5" width="19" height="5" rx="1"/><path d="M4.5 8.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5"/><path d="M10 12.5h4"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  diff: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
  file: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  terminal: '<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>',
  definition: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/><path d="M3 5v14"/>',
  rename: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M13.5 20.5h7"/>',
  format: '<path d="M21 10H7"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H7"/>',
  comment: '<path d="M8 3L4 21"/><path d="M14 3l-4 18"/><path d="M20 3l-4 18"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  split: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
  scm: '<circle cx="6" cy="18" r="2.5"/><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7"/><path d="M18 11.5c0 3.5-4 4-9.5 5.5"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  zen: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  first: '<path d="M18 5l-7 7 7 7"/><path d="M7 5v14"/>',
  layers: '<path d="M12 2.5L2.5 7.5 12 12.5l9.5-5z"/><path d="M2.5 16.5L12 21.5l9.5-5"/><path d="M2.5 12L12 17l9.5-5"/>',
  sync: '<path d="M21 4v5h-5"/><path d="M3 20v-5h5"/><path d="M19.4 9A8 8 0 0 0 5.2 7.2L3 9.5"/><path d="M4.6 15a8 8 0 0 0 14.2 1.8L21 14.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15.5h6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  clipboard: '<rect x="8" y="2.5" width="8" height="4" rx="1"/><path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2"/>',
  wide: '<rect x="1.5" y="7" width="21" height="10" rx="2"/><path d="M8.5 7v10M15.5 7v10"/>',
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mix(hex, other, amount) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(other);
  return '#' + a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount)).toString(16).padStart(2, '0')).join('');
}

function color(name) {
  if (!name) return C.blue;
  return name.startsWith('#') ? name : (C[name] || C.blue);
}

function wrap(text, maxChars, maxLines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (let word of words) {
    while (word.length > maxChars) {
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + '…';
    return kept;
  }
  return lines;
}

function fit(text, maxChars) {
  const s = String(text || '');
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
}

function frame(accent, { strong = false, dim = false } = {}) {
  const tint = dim ? '#11151b' : mix(accent, C.bg, strong ? 0.34 : 0.13);
  const edge = dim ? '#21262d' : mix(accent, C.bg, strong ? 0.9 : 0.42);
  // Full-bleed black first so the rounded corners blend with the screen between keys.
  return `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="#000000"/>`
    + `<rect x="1" y="1" width="${SIZE - 2}" height="${SIZE - 2}" rx="22" ry="22" fill="${tint}"/>`
    + `<rect x="3.5" y="3.5" width="${SIZE - 7}" height="${SIZE - 7}" rx="19.5" ry="19.5" fill="none" stroke="${edge}" stroke-width="${strong ? 5 : 3}"/>`;
}

function icon(name, cx, cy, size, stroke, width = 2) {
  const body = ICONS[name] || ICONS.bolt;
  const s = +(size / 24).toFixed(4);
  return `<g transform="translate(${cx - size / 2},${cy - size / 2}) scale(${s})" fill="none" stroke="${stroke}"`
    + ` stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

function text(x, y, value, { size = 18, fill = C.text, weight = 'normal', anchor = 'middle' } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}"`
    + ` fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;
}

function labelLines(label) {
  const raw = String(label || '').split('\n');
  if (raw.length > 1) return raw.slice(0, 2);
  return raw[0].length > 11 ? wrap(raw[0], 11, 2) : raw;
}

// Generic key: icon on top, one or two label lines below, optional small caption on top.
function iconKey({ label = '', icon: iconName = 'bolt', color: colorName, sub = '', dim = false, strong = false, badge = '' } = {}) {
  const accent = dim ? C.faint : color(colorName);
  const lines = labelLines(label);
  const two = lines.length > 1;
  const iconY = sub ? (two ? 56 : 62) : (two ? 50 : 56);
  let body = frame(accent, { dim, strong });
  if (sub) body += text(72, 25, fit(sub, 17), { size: 14, fill: dim ? C.faint : C.muted });
  body += icon(iconName, 72, iconY, two ? 42 : 50, strong ? C.text : accent, 2.1);
  const fill = dim ? C.muted : C.text;
  if (two) {
    body += text(72, 108, lines[0], { size: 18, weight: 'bold', fill });
    body += text(72, 128, lines[1], { size: 18, weight: 'bold', fill });
  } else if (lines[0]) {
    body += text(72, 121, lines[0], { size: lines[0].length > 8 ? 19 : 21, weight: 'bold', fill });
  }
  if (badge) {
    body += `<circle cx="120" cy="24" r="14" fill="${accent}"/>`;
    body += text(120, 30, badge, { size: 15, weight: 'bold', fill: C.bg });
  }
  return svg(body);
}

// Spinner arc used while something is running. `tick` advances the rotation.
function spinner(cx, cy, r, stroke, tick) {
  const angle = (tick * 45) % 360;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${mix(stroke, C.bg, 0.25)}" stroke-width="6"/>`
    + `<g transform="rotate(${angle},${cx},${cy})"><path d="M${cx},${cy - r} A${r},${r} 0 0,1 ${cx + r},${cy}"`
    + ` fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/></g>`;
}

// Small up/down chevron drawn as a path (system fonts may lack arrow glyphs).
function arrow(x, y, up, stroke) {
  const d = up ? `M${x},${y + 3} L${x + 5},${y - 3} L${x + 10},${y + 3}` : `M${x},${y - 3} L${x + 5},${y + 3} L${x + 10},${y - 3}`;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const STATUS_LOOK = {
  none: { color: C.faint, word: 'No session', icon: 'spark' },
  idle: { color: C.blue, word: 'Ready', icon: 'spark' },
  working: { color: C.claude, word: 'Working', icon: 'spark' },
  permission: { color: C.amber, word: 'Approve?', icon: 'shield' },
  question: { color: C.purple, word: 'Question', icon: 'message' },
  done: { color: C.green, word: 'Done', icon: 'check' },
  error: { color: C.red, word: 'Error', icon: 'x' },
};

// Live Claude Code status: state word, project, and what Claude is doing / asking.
function statusKey({ state = 'none', project = '', detail = '', meta = '', count = 0, tick = 0, heading = 'CLAUDE' } = {}) {
  const look = STATUS_LOOK[state] || STATUS_LOOK.none;
  const alert = state === 'permission' || state === 'question';
  const blinkOn = !alert || tick % 2 === 0;
  let body = frame(look.color, { strong: alert && blinkOn, dim: state === 'none' });
  const spin = state === 'working' ? (tick * 30) % 360 : 0;
  body += `<g transform="rotate(${spin},23,22)">${icon(look.icon, 23, 22, 19, look.color, 2.6)}</g>`;
  body += text(38, 27, heading, { size: heading.length > 7 ? 11 : 13, weight: 'bold', fill: look.color, anchor: 'start' });
  if (count > 1) {
    body += `<circle cx="123" cy="22" r="11" fill="${look.color}"/>`;
    body += text(123, 27, String(count), { size: 14, weight: 'bold', fill: C.bg });
  } else if (meta && heading.length <= 7) {
    body += text(131, 27, meta, { size: 13, fill: C.muted, anchor: 'end' });
  }
  body += text(72, 71, look.word, { size: look.word.length > 8 ? 21 : 25, weight: 'bold' });
  const lines = detail ? wrap(detail, 16, 2) : [];
  if (lines.length === 2) {
    body += text(72, 100, lines[0], { size: 15 });
    body += text(72, 119, lines[1], { size: 15 });
  } else if (lines.length === 1) {
    body += text(72, 100, lines[0], { size: 15 });
    if (project) body += text(72, 121, fit(project, 17), { size: 14, fill: C.muted });
  } else if (project) {
    body += text(72, 104, fit(project, 17), { size: 15, fill: C.muted });
  }
  return svg(body);
}

// Multi-line text view (last prompt / Claude's last reply).
function textKey({ heading = '', body: content = '', color: colorName = 'blue', meta = '', empty = '' } = {}) {
  const accent = color(colorName);
  let body = frame(accent);
  body += text(14, 26, heading, { size: 13, weight: 'bold', fill: accent, anchor: 'start' });
  if (meta) body += text(130, 26, meta, { size: 13, fill: C.muted, anchor: 'end' });
  const lines = content ? wrap(content, 17, 5) : wrap(empty, 16, 3);
  lines.forEach((line, i) => {
    body += text(14, 50 + i * 20, line, { size: 15.5, fill: content ? C.text : C.muted, anchor: 'start' });
  });
  return svg(body);
}

// Smart commit / generic "running" key.
function busyKey({ label = '', color: colorName = 'green', sub = '', tick = 0 } = {}) {
  const accent = color(colorName);
  let body = frame(accent);
  if (sub) body += text(72, 25, fit(sub, 17), { size: 14, fill: C.muted });
  body += spinner(72, 62, 22, accent, tick);
  body += text(72, 121, fit(label, 12), { size: 19, weight: 'bold' });
  return svg(body);
}

// Repository summary: branch, changes, ahead/behind.
function repoKey({ project = '', branch = '', changes = 0, ahead = 0, behind = 0, error = '' } = {}) {
  const accent = error ? C.faint : changes ? C.amber : C.green;
  let body = frame(accent, { dim: Boolean(error) });
  body += text(14, 26, fit(project || 'REPO', 14).toUpperCase(), { size: 13, weight: 'bold', fill: accent, anchor: 'start' });
  body += icon('branch', 30, 58, 28, accent, 2.3);
  body += text(52, 66, fit(branch || (error ? 'no repo' : '—'), 9), { size: 18, weight: 'bold', anchor: 'start' });
  const line1 = error ? fit(error, 18) : changes ? `${changes} changed` : 'clean';
  body += text(72, 102, line1, { size: 16, fill: error ? C.muted : C.text });
  if (!error) {
    body += arrow(36, 118, true, C.muted) + text(51, 124, String(ahead), { size: 16, fill: C.muted, anchor: 'start' });
    body += arrow(82, 118, false, C.muted) + text(97, 124, String(behind), { size: 16, fill: C.muted, anchor: 'start' });
  }
  return svg(body);
}

// Icon-only tile for the app's action list.
function iconTile(name, colorName) {
  const accent = color(colorName);
  return svg(frame(accent) + icon(name, 72, 72, 84, accent, 2.2));
}

// ---------------------------------------------------------------------------------------------
// Wide display: adjacent keys in one screen row drawn as a single banner.
//
// The banner is drawn once across `count` keys, then cut into one 144x144 slice per key. GAP is
// the dark strip between keys on the screen, in the same units (the DUO87 shows 80 px keys about
// 20 px apart), so the frame lines up across it. Text never straddles a gap: it is broken into
// pieces that each fit one key, preferably after "/", "-", "_", "." or a space.

const GAP = 36;
const EDGE = 14; // margin at the banner's rounded ends
const SEAM = 10; // margin next to a gap
const INNER = SIZE - 2 * EDGE;

// Advance widths (1/1000 em) of Helvetica Neue for ASCII 32-126, measured with CoreText.
const WIDTHS = {
  normal: [278, 259, 426, 556, 556, 1000, 630, 278, 259, 259, 352, 600, 278, 389, 278, 333, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 556, 278, 278, 600, 600, 600, 556, 800, 648, 685, 722, 704, 611, 574, 759, 722, 259, 519, 667, 556, 871,
    722, 760, 648, 760, 685, 648, 574, 722, 611, 926, 611, 648, 611, 259, 333, 259, 600, 500, 222, 537, 593, 537, 593, 537,
    296, 574, 556, 222, 222, 519, 222, 853, 556, 574, 593, 593, 333, 500, 315, 556, 500, 758, 518, 500, 480, 333, 222, 333, 600],
  bold: [278, 278, 463, 556, 556, 1000, 685, 278, 296, 296, 407, 600, 278, 407, 278, 371, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 556, 278, 278, 600, 600, 600, 556, 800, 685, 704, 741, 741, 648, 593, 759, 741, 295, 556, 722, 593, 907,
    741, 778, 667, 778, 722, 649, 611, 741, 630, 944, 667, 667, 648, 333, 371, 333, 600, 500, 259, 574, 611, 574, 611, 574,
    333, 611, 593, 258, 278, 574, 258, 906, 593, 611, 611, 611, 389, 537, 352, 593, 520, 814, 537, 519, 519, 333, 223, 333, 600],
};

function measure(value, size, weight = 'normal') {
  const table = weight === 'bold' ? WIDTHS.bold : WIDTHS.normal;
  let total = 0;
  for (const ch of String(value == null ? '' : value)) {
    const code = ch.codePointAt(0);
    total += code >= 32 && code <= 126 ? table[code - 32] : ch === '…' ? 1000 : 620;
  }
  return (total / 1000) * size * 1.04; // a little slack for hinting
}

// Cut `value` with an ellipsis so it fits `width`.
function clamp(value, size, width, weight = 'normal') {
  let s = String(value == null ? '' : value);
  if (measure(s, size, weight) <= width) return s;
  while (s && measure(s + '…', size, weight) > width) s = s.slice(0, -1);
  return s + '…';
}

// Largest of `sizes` at which `value` fits `width`; the smallest, cut to fit, otherwise.
function fitText(value, sizes, width, weight = 'normal') {
  for (const size of sizes) if (measure(value, size, weight) <= width) return { size, text: String(value) };
  const size = sizes[sizes.length - 1];
  return { size, text: clamp(value, size, width, weight) };
}

const TOKENS = /[^\s/_.-]+[\s/_.-]*|[\s/_.-]+/g;

// Pack tokens into slots (widths[i] each), in order, breaking only between tokens.
// Returns the pieces, or null when they don't fit.
function pack(tokens, size, widths, weight) {
  const pieces = [];
  let cur = '';
  for (const t of tokens) {
    const slot = widths[pieces.length];
    if (slot == null) return null;
    if (measure((cur + t).trimEnd(), size, weight) <= slot) { cur += t; continue; }
    if (!cur) return null;
    pieces.push(cur.trimEnd());
    cur = t.trimStart();
    const next = widths[pieces.length];
    if (next == null || measure(cur.trimEnd(), size, weight) > next) return null;
  }
  if (cur.trim()) pieces.push(cur.trimEnd());
  return pieces;
}

// Break `value` into pieces, one per slot, preferably after "/", "-", "_", "." or a space.
// Long values lose tokens from the middle ("…") before any word is split.
function flow(value, size, widths, weight = 'bold', { elide = false } = {}) {
  const tokens = String(value).match(TOKENS) || [];
  const direct = pack(tokens, size, widths, weight);
  if (direct || !elide) return direct;
  for (let drop = 1; drop < tokens.length - 1; drop++) {
    const keep = tokens.length - 1 - drop;
    const pieces = pack([...tokens.slice(0, keep), '…' + tokens[tokens.length - 1]], size, widths, weight);
    if (pieces) return pieces;
  }
  return null;
}

// Last resort: break anywhere, and cut what still doesn't fit.
function hardFlow(value, size, widths, weight = 'bold') {
  const chars = [...String(value)];
  const pieces = [];
  let i = 0;
  while (pieces.length < widths.length && i < chars.length) {
    let cur = '';
    while (i < chars.length && measure(cur + chars[i], size, weight) <= widths[pieces.length]) cur += chars[i++];
    if (!cur) cur = chars[i++];
    pieces.push(cur);
  }
  const lastSlot = pieces.length - 1;
  if (i < chars.length) pieces[lastSlot] = clamp(pieces[lastSlot] + chars.slice(i).join(''), size, widths[lastSlot], weight);
  return pieces;
}

// Biggest size at which the branch fits on one line across the keys, else on two lines, else
// with the middle elided, else cut.
function layoutBranch(value, widths) {
  const n = widths.length;
  const split = (pieces, size) => ({ size, lines: pieces.length > n ? [pieces.slice(0, n), pieces.slice(n)] : [pieces] });
  for (const size of [44, 40, 36, 33, 30, 27]) {
    const pieces = flow(value, size, widths);
    if (pieces) return split(pieces, size);
  }
  const both = [...widths, ...widths];
  for (const size of [27, 25, 23, 22]) {
    const pieces = flow(value, size, both);
    if (pieces) return split(pieces, size);
  }
  const elided = flow(value, 22, both, 'bold', { elide: true });
  return split(elided || hardFlow(value, 22, both), 22);
}

// Same frame as a single key, stretched over the whole banner: rounded only at the two ends,
// with no edge between keys, so the row reads as one strip.
function bannerFrame(width, accent, { strong = false, dim = false } = {}) {
  const tint = dim ? '#11151b' : mix(accent, C.bg, strong ? 0.3 : 0.13);
  const edge = dim ? '#21262d' : mix(accent, C.bg, strong ? 0.9 : 0.42);
  return `<rect x="0" y="0" width="${width}" height="${SIZE}" fill="#000000"/>`
    + `<rect x="1" y="1" width="${width - 2}" height="${SIZE - 2}" rx="22" ry="22" fill="${tint}"/>`
    + `<rect x="3.5" y="3.5" width="${width - 7}" height="${SIZE - 7}" rx="19.5" ry="19.5" fill="none" stroke="${edge}" stroke-width="${strong ? 5 : 3}"/>`;
}

// Up/down chevron sized for banner text.
function chevron(x, y, up, stroke) {
  const d = up ? `M${x},${y + 4} L${x + 6.5},${y - 4} L${x + 13},${y + 4}` : `M${x},${y - 4} L${x + 6.5},${y + 4} L${x + 13},${y - 4}`;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const OP_LABEL = { merge: 'MERGING', rebase: 'REBASE', 'cherry-pick': 'CHERRY-PICK', revert: 'REVERTING', bisect: 'BISECTING' };

// Most important thing to flag, if any: an operation in progress, conflicts, detached HEAD,
// staged files, stashes.
function bannerAlert(info) {
  if (info.op) {
    const step = info.op.kind === 'rebase' && info.op.total ? ` ${info.op.step}/${info.op.total}` : '';
    return { text: (OP_LABEL[info.op.kind] || String(info.op.kind).toUpperCase()) + step, color: C.red };
  }
  if (info.conflicts) return { text: `${info.conflicts} CONFLICT${info.conflicts > 1 ? 'S' : ''}`, color: C.red };
  if (info.detached) return { text: 'DETACHED', color: C.amber };
  if (info.staged) return { text: `${info.staged} STAGED`, color: C.green };
  if (info.stash) return { text: `${info.stash} STASHED`, color: C.muted };
  return null;
}

// Git status across a row of keys: repo, the whole branch name, changed files, +/- lines,
// commits ahead/behind, age of the last commit, and any merge/rebase in progress.
// Returns one SVG per key, left to right. `heading` names a remote (SSH, CODESPACE); `age` is
// the last commit's age.
function gitBanner(info = {}, { count = 3, heading = '', age = '' } = {}) {
  if (count < 2) return [repoKey(info)];
  const width = count * SIZE + (count - 1) * GAP;
  const last = count - 1;
  // Text box of each key: wider margins at the rounded ends than next to a gap.
  const left = (i) => i * (SIZE + GAP) + (i === 0 ? EDGE : SEAM);
  const right = (i) => i * (SIZE + GAP) + SIZE - (i === last ? EDGE : SEAM);
  const widths = Array.from({ length: count }, (_, i) => right(i) - left(i));
  const error = info.error || '';
  const busy = Boolean(info.op || info.conflicts);
  const accent = error ? C.faint : busy ? C.red : info.changes ? C.amber : info.ahead || info.behind ? C.blue : C.green;
  let body = bannerFrame(width, accent, { dim: Boolean(error), strong: busy });

  const branch = error ? null : layoutBranch(info.branch || '—', widths);
  const two = Boolean(branch && branch.lines.length > 1);
  const top = two ? 31 : 36;
  const bottom = two ? 130 : 125;
  const small = two ? 20 : 22;

  // Top line: repo, then an alert (merge, conflicts, staged…), then remote + last commit age.
  const alert = error ? null : bannerAlert(info);
  const alertAt = alert ? (count > 2 ? 1 : last) : -1;
  const repoName = info.project || 'git';
  const spill = count > 2 && alertAt !== 1 ? [widths[1]] : [];
  let repo = null;
  let iconShown = true;
  for (const size of [19, 17]) {
    const pieces = flow(repoName, size, [widths[0] - 25, ...spill], 'bold');
    if (pieces) { repo = { size, pieces }; break; }
  }
  if (!repo) {
    iconShown = false; // long names get the icon's room too
    for (const size of [19, 17, 15]) {
      const pieces = flow(repoName, size, [widths[0], ...spill], 'bold');
      if (pieces) { repo = { size, pieces }; break; }
    }
  }
  if (!repo) repo = { size: 17, pieces: [clamp(repoName, 17, widths[0] - 25, 'bold')] }, iconShown = true;
  if (iconShown) body += icon('branch', left(0) + 9, top - 7, 20, accent, 2.4);
  repo.pieces.forEach((piece, i) => {
    const x = i ? left(i) : left(0) + (iconShown ? 25 : 0);
    body += text(x, top, piece, { size: repo.size, weight: 'bold', fill: accent, anchor: 'start' });
  });
  if (alert) {
    const fitted = fitText(alert.text, [19, 17, 15], widths[alertAt], 'bold');
    const anchor = alertAt === last ? 'end' : 'start';
    body += text(anchor === 'end' ? right(alertAt) : left(alertAt), top, fitted.text,
      { size: fitted.size, weight: 'bold', fill: alert.color, anchor });
  }
  if (alertAt !== last && (heading || (age && !error))) {
    // Right-aligned: [SSH] [commit icon] 3m
    let x = right(last);
    if (age && !error) {
      body += text(x, top, age, { size: 19, fill: C.muted, anchor: 'end' });
      x -= measure(age, 19);
      body += icon('commit', x - 11, top - 7, 18, C.muted, 2.4);
      x -= 26;
    }
    if (heading) {
      const room = x - left(last);
      if (room > 20) body += text(x, top, clamp(heading, 19, room, 'bold'), { size: 19, weight: 'bold', fill: accent, anchor: 'end' });
    }
  }

  if (error) {
    // What's wrong, then a hint, each broken across the keys like the branch.
    const msg = flow(error, 27, widths, 'bold') || hardFlow(error, 27, widths);
    msg.forEach((piece, i) => { body += text(left(i), 86, piece, { size: 27, weight: 'bold', fill: C.muted, anchor: 'start' }); });
    const hint = error === 'no repo yet' ? 'Start Claude in a repo' : '';
    const pieces = hint ? flow(hint, 19, widths, 'normal') || [] : [];
    pieces.forEach((piece, i) => { body += text(left(i), 124, piece, { size: 19, fill: C.faint, anchor: 'start' }); });
    return slices(body, count);
  }

  // Middle: the whole branch, in pieces that each fit one key.
  const ys = two ? [67, 98] : [88];
  branch.lines.forEach((pieces, row) => pieces.forEach((piece, i) => {
    body += text(left(i), ys[row], piece, { size: branch.size, weight: 'bold', anchor: 'start' });
  }));

  // Bottom line: changed files · +/- lines · ahead/behind.
  if (info.conflicts || info.changes) {
    const n = String(info.conflicts || info.changes);
    const word = info.conflicts ? (info.conflicts > 1 ? 'conflicts' : 'conflict') : 'changed';
    body += text(left(0), bottom, n, { size: small, weight: 'bold', fill: info.conflicts ? C.red : C.amber, anchor: 'start' });
    const x = left(0) + measure(n + ' ', small, 'bold'); // SVG drops leading spaces, so offset instead
    body += text(x, bottom, clamp(word, small, widths[0] - (x - left(0))), { size: small, fill: C.text, anchor: 'start' });
  } else {
    body += icon('check', left(0) + 9, bottom - 7, 20, C.green, 3);
    body += text(left(0) + 24, bottom, 'clean', { size: small, weight: 'bold', fill: C.green, anchor: 'start' });
  }
  if (count > 2) {
    if (info.ins || info.del) {
      const plus = `+${info.ins || 0}`;
      body += text(left(1), bottom, plus, { size: small, weight: 'bold', fill: C.green, anchor: 'start' });
      body += text(left(1) + measure(plus + ' ', small, 'bold'), bottom, `−${info.del || 0}`, { size: small, weight: 'bold', fill: C.red, anchor: 'start' });
    } else if (info.untracked) {
      body += text(left(1), bottom, `${info.untracked} new`, { size: small, fill: C.muted, anchor: 'start' });
    }
  }
  if (info.detached || !info.upstream) {
    body += text(right(last), bottom, info.detached ? 'no branch' : 'not pushed', { size: small, fill: C.muted, anchor: 'end' });
  } else {
    const ahead = String(info.ahead || 0);
    const behind = String(info.behind || 0);
    const downX = right(last) - measure(behind, small, 'bold') - 17;
    const upX = downX - 14 - measure(ahead, small, 'bold') - 17;
    const upColor = info.ahead ? C.blue : C.muted;
    const downColor = info.behind ? C.amber : C.muted;
    body += chevron(upX, bottom - 8, true, upColor) + text(upX + 17, bottom, ahead, { size: small, weight: 'bold', fill: upColor, anchor: 'start' });
    body += chevron(downX, bottom - 8, false, downColor) + text(right(last), bottom, behind, { size: small, weight: 'bold', fill: downColor, anchor: 'end' });
  }
  return slices(body, count);
}

// Cut a banner body into one 144x144 key image per key.
function slices(body, count) {
  return Array.from({ length: count }, (_, i) => svg(`<g transform="translate(${-i * (SIZE + GAP)},0)">${body}</g>`));
}

// Resting look of each action (also used for the static images baked into the profile).
function defaultKey(kind, s = {}) {
  switch (kind) {
    case 'status':
      return statusKey({ state: 'none', project: 'Start Claude' });
    case 'view': {
      const reply = s.show === 'reply';
      return textKey({ heading: reply ? 'CLAUDE' : 'YOU', color: reply ? 'claude' : 'blue',
        empty: reply ? "Claude's last reply shows here" : 'Your last prompt shows here' });
    }
    case 'answer':
      if (s.answer === 'deny') return iconKey({ label: 'Deny', icon: 'x', color: 'red', dim: true });
      if (s.answer === 'always') return iconKey({ label: 'Always', icon: 'checks', color: 'green', dim: true });
      return iconKey({ label: 'Allow', icon: 'check', color: 'green', dim: true });
    case 'focus':
      return iconKey({ label: s.label || (s.newChat ? 'New Chat' : 'Claude'), icon: s.icon || (s.newChat ? 'plus' : 'spark'),
        color: s.color || 'claude', sub: s.sub != null ? s.sub : (s.newChat ? '' : 'Focus') });
    case 'prompt':
      return iconKey({ label: s.label || 'Prompt', icon: s.icon || 'message', color: s.color || 'claude',
        sub: s.sub != null ? s.sub : 'Claude' });
    case 'commit':
      return iconKey({ label: s.label || (s.push ? 'Commit+Push' : 'Commit'), icon: s.push ? 'push' : 'commit',
        color: 'green', sub: s.sub != null ? s.sub : 'AI' });
    case 'repo':
      return repoKey({ project: 'repo', branch: 'branch' });
    case 'banner':
      return iconKey({ label: 'Wide Git', icon: 'wide', color: 'green', sub: 'Row display' });
    case 'keys':
      return iconKey({ label: s.label || s.keys || 'Shortcut', icon: s.icon || 'keyboard', color: s.color || 'blue', sub: s.sub || '' });
    case 'shell':
      return iconKey({ label: s.label || 'Run', icon: s.icon || 'terminal', color: s.color || 'blue', sub: s.sub || '' });
    default:
      return iconKey({ label: s.label || kind, icon: s.icon || 'bolt', color: s.color || 'gray', sub: s.sub || '' });
  }
}

module.exports = { iconKey, iconTile, statusKey, textKey, busyKey, repoKey, gitBanner, defaultKey, measure, ICONS, C, wrap };
