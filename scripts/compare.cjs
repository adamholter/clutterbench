// Compare a grader's labels with Adam's annotations and write
// reports/feedback-<grader>.md: the material for the next grader prompt.
//
// Adam's labels come from click mode (annotation.labels, exact) and, for
// elements he did not click, from draw-mode strokes: a stroke's colour is
// assigned to the smallest element under enough of its points.
//
//   node scripts/compare.cjs [--grader luna-v1]
const fs = require('fs');
const path = require('path');
const { areaShares } = require('./grade.cjs');

const ROOT = path.join(__dirname, '..');
const grader = process.argv.includes('--grader') ? process.argv[process.argv.indexOf('--grader') + 1] : 'luna-v1';
const PALETTE = { red: [224, 49, 49], orange: [240, 140, 0], blue: [25, 113, 194] };
const PAD = 12, STEP = 4, MIN_POINTS = 4;

function colourOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  let best = null, bd = Infinity;
  for (const [k, c] of Object.entries(PALETTE)) {
    const d = c.reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0);
    if (d < bd) { bd = d; best = k; }
  }
  return bd < 120 ** 2 ? best : null;
}

// densified points of a user-drawn element, in scene (= canvas px) coordinates
function pointsOf(el) {
  let pts;
  if (el.points && el.points.length) pts = el.points.map(([x, y]) => [el.x + x, el.y + y]);
  else if (['rectangle', 'ellipse', 'diamond'].includes(el.type)) {
    pts = [];
    for (let y = el.y; y <= el.y + el.height; y += STEP) for (let x = el.x; x <= el.x + el.width; x += STEP) pts.push([x, y]);
    return pts;
  } else return [];
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    out.push(pts[i]);
    if (i + 1 < pts.length) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const n = Math.floor(Math.hypot(x2 - x1, y2 - y1) / STEP);
      for (let k = 1; k < n; k++) out.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
    }
  }
  return out;
}

function humanLabels(elements, strokes) {
  const votes = {};
  for (const s of strokes) {
    const c = colourOf(s.strokeColor);
    if (!c) continue;
    for (const [x, y] of pointsOf(s)) {
      // a point votes for the smallest element under it, so marks on a label
      // inside a card do not relabel the whole card
      let hit = null;
      for (const e of elements) {
        if (x < e.x - PAD || x > e.x + e.w + PAD || y < e.y - PAD || y > e.y + e.h + PAD) continue;
        if (!hit || e.w * e.h < hit.w * hit.h) hit = e;
      }
      if (hit) ((votes[hit.id] = votes[hit.id] || {})[c] = (votes[hit.id][c] || 0) + 1);
    }
  }
  const labels = {};
  for (const [id, v] of Object.entries(votes)) {
    const [c, n] = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
    if (n >= MIN_POINTS) labels[id] = c;
  }
  return labels;
}

const L = ['blue', 'orange', 'red'];
const conf = Object.fromEntries(L.map((a) => [a, Object.fromEntries(L.map((b) => [b, 0]))]));
const lines = [];
let agreeV = 0, disagreeV = 0, scored = [];
const shares = [];
const annDir = path.join(ROOT, 'annotations');
for (const f of fs.existsSync(annDir) ? fs.readdirSync(annDir).sort() : []) {
  const ann = JSON.parse(fs.readFileSync(path.join(annDir, f), 'utf8'));
  const dir = path.join(ROOT, 'runs', ann.runId);
  const gp = path.join(dir, 'grades', `${grader}.json`);
  if (!fs.existsSync(gp)) continue;
  const grade = JSON.parse(fs.readFileSync(gp, 'utf8'));
  const { elements } = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8'));
  const byId = Object.fromEntries(elements.map((e) => [e.id, e]));
  const gl = {};
  for (const r of grade.regions) for (const id of r.ids) gl[id] = { label: r.label, region: r };
  const hl = { ...humanLabels(elements, ann.elements || []), ...(ann.labels || {}) };
  const misses = [];
  for (const [id, h] of Object.entries(hl)) {
    const g = gl[id];
    if (!g || !conf[h] || conf[h][g.label] === undefined) continue;
    conf[h][g.label]++;
    if (g.label !== h) misses.push(`  - Adam **${h}**, grader ${g.label} (${g.region.type}, "${g.region.name}"): ${byId[id].kind} ${byId[id].text ? `"${byId[id].text}"` : `${byId[id].w}x${byId[id].h}`}`);
  }
  const verdicts = (ann.verdicts || {})[grader] || {};
  const vl = [];
  for (const r of grade.regions) {
    const v = verdicts[r.rid];
    if (!v || v.agree == null) continue;
    if (v.agree) agreeV++;
    else {
      disagreeV++;
      vl.push(`  - "${r.name}" graded ${r.label}/${r.type}${v.shouldBe ? `, should be **${v.shouldBe}**` : ''}${v.comment ? `: ${v.comment}` : ''} (grader said: ${r.reason})`);
    }
  }
  for (const m of grade.missing || []) {
    const v = verdicts[m.mid];
    if (!v || v.agree == null) continue;
    if (v.agree) agreeV++;
    else { disagreeV++; vl.push(`  - missing "${m.what}" rejected (grader said: ${m.why})`); }
  }
  if (ann.myScore !== '' && ann.myScore != null) scored.push([Number(ann.myScore), grade.clutter_score]);
  // Adam's own clutter share, once he has labelled nearly everything
  let shareLine = '';
  if (Object.keys(hl).length >= elements.length * 0.8) {
    const canvas = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')).canvas;
    const hs = areaShares(elements, hl, canvas);
    const mine = Math.round((hs.red + hs.orange / 2) * 10) / 10;
    shares.push([mine, grade.metrics.clutterShare]);
    shareLine = `Clutter share: Adam ${mine}%, grader ${grade.metrics.clutterShare}%.`;
  }
  if (!misses.length && !vl.length && !ann.notes && !ann.missing && !shareLine) continue;
  lines.push(`\n## ${ann.runId}`);
  if (ann.myScore !== '' && ann.myScore != null) lines.push(`Adam score ${ann.myScore}/10, grader ${grade.clutter_score}/10.`);
  if (shareLine) lines.push(shareLine);
  if (ann.notes) lines.push(`Notes: ${ann.notes}`);
  if (ann.missing) lines.push(`Adam says missing: ${ann.missing}${(grade.missing || []).length ? ` | grader says missing: ${grade.missing.map((m) => m.what).join('; ')}` : ' | grader found nothing missing'}`);
  const notes = (ann.elements || []).filter((e) => e.type === 'text' && e.text).map((e) => `  - (${colourOf(e.strokeColor) || 'note'}) ${e.text.replace(/\n/g, ' ')}`);
  if (notes.length) lines.push('Notes written on the canvas:', ...notes);
  if (vl.length) lines.push('Rejected regions:', ...vl);
  if (misses.length) lines.push('Stroke disagreements:', ...misses);
}
const total = L.reduce((s, a) => s + L.reduce((t, b) => t + conf[a][b], 0), 0);
const same = L.reduce((s, a) => s + conf[a][a], 0);
const head = [
  `# Grader feedback: ${grader}`,
  '',
  `Element agreement with Adam's strokes: ${total ? `${Math.round((100 * same) / total)}% (${same}/${total})` : 'no overlapping labels yet'}`,
  `Region verdicts: ${agreeV} agreed, ${disagreeV} rejected`,
  scored.length ? `Score gap (grader minus Adam), mean: ${(scored.reduce((s, [a, g]) => s + (g - a), 0) / scored.length).toFixed(1)} over ${scored.length} runs` : '',
  shares.length ? `Clutter share gap (grader minus Adam), mean: ${(shares.reduce((s, [a, g]) => s + (g - a), 0) / shares.length).toFixed(1)} points over ${shares.length} fully labelled runs` : '',
  '',
  'Confusion (rows = Adam, columns = grader):',
  '',
  `| | ${L.join(' | ')} |`, `|---|${L.map(() => '---').join('|')}|`,
  ...L.map((a) => `| ${a} | ${L.map((b) => conf[a][b]).join(' | ')} |`),
];
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
const out = path.join(ROOT, 'reports', `feedback-${grader}.md`);
fs.writeFileSync(out, [...head, ...lines].join('\n') + '\n');
console.log(head.slice(2, 6).filter(Boolean).join('\n'));
console.log('wrote', out);
