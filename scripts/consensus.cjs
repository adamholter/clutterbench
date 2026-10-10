// Consensus grade: run haiku-low-v4 twice; where the two passes differ in any
// way, sonnet-low-v4 breaks the tie. Writes runs/<id>/grades/consensus-v4.json.
//
// Per element the final label is the majority of the passes (Sonnet's label if
// all three differ). Scores take the median. Run after both Haiku passes exist:
//
//   node scripts/grade.cjs --grader haiku-low-v4
//   node scripts/grade.cjs --grader haiku-low-v4-b
//   node scripts/consensus.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { areaShares } = require('./grade.cjs');

const ROOT = path.join(__dirname, '..');
const RUNS = process.env.CB_RUNS || path.join(ROOT, 'runs'); // CB_RUNS: grade something other than benchmark runs
const A = 'haiku-low-v4', B = 'haiku-low-v4-b', T = 'sonnet-low-v4', OUT = 'consensus-v4';
const read = (id, g) => {
  const p = path.join(RUNS, id, 'grades', `${g}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};
const labelMap = (g) => {
  const m = {};
  for (const r of g.regions) for (const id of r.ids) m[id] = r;
  return m;
};
const median = (v) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];

function differs(a, b, elements) {
  const la = labelMap(a), lb = labelMap(b);
  const changed = elements.filter((e) => (la[e.id] || {}).label !== (lb[e.id] || {}).label).length;
  return { changed, any: changed > 0 || a.clutter_score !== b.clutter_score || (a.missing.length > 0) !== (b.missing.length > 0) };
}

const ids = fs.readdirSync(RUNS).filter((id) => fs.existsSync(path.join(RUNS, id, 'elements.json'))).sort();
const need = [];
for (const id of ids) {
  const a = read(id, A), b = read(id, B);
  if (!a || !b) { console.error('missing haiku pass:', id); continue; }
  const { elements } = JSON.parse(fs.readFileSync(path.join(RUNS, id, 'elements.json'), 'utf8'));
  if (differs(a, b, elements).any && !read(id, T)) need.push(id);
}
if (need.length) {
  console.log(`tiebreak needed on ${need.length} runs, calling ${T}`);
  execFileSync('node', [path.join(__dirname, 'grade.cjs'), '--grader', T, '--ids', need.join(','), '--concurrency', '4'], { stdio: 'inherit' });
}

let tie = 0, done = 0;
for (const id of ids) {
  const a = read(id, A), b = read(id, B);
  if (!a || !b) continue;
  const { elements, stats } = JSON.parse(fs.readFileSync(path.join(RUNS, id, 'elements.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(RUNS, id, 'meta.json'), 'utf8'));
  const d = differs(a, b, elements);
  const t = d.any ? read(id, T) : null;
  if (d.any && !t) { console.error('no tiebreak grade for', id); continue; }
  const passes = t ? [t, a, b] : [a]; // order = preference when picking a source region
  const maps = passes.map(labelMap);
  const labelOf = {}, groups = new Map();
  for (const e of elements) {
    const votes = maps.map((m) => (m[e.id] || {}).label).filter(Boolean);
    if (!votes.length) continue;
    const count = {};
    for (const v of votes) count[v] = (count[v] || 0) + 1;
    const top = Object.entries(count).sort((x, y) => y[1] - x[1])[0];
    const final = top[1] >= 2 || votes.length === 1 ? top[0] : votes[0];
    labelOf[e.id] = final;
    const src = maps.findIndex((m) => (m[e.id] || {}).label === final);
    const r = maps[src][e.id];
    const key = `${src}:${r.rid}`;
    if (!groups.has(key)) groups.set(key, { label: final, type: r.type, name: r.name, reason: r.reason, ids: [] });
    groups.get(key).ids.push(e.id);
  }
  const regions = [...groups.values()].map((r, i) => ({ rid: `r${i}`, ...r }));
  const flagged = passes.filter((p) => p.missing.length > 0);
  const missing = flagged.length * 2 > passes.length ? flagged[0].missing : [];
  const shares = areaShares(elements, labelOf, meta.canvas);
  const grade = {
    grader: OUT, protocol: `${A} x2, ${T} tiebreak`, gradedAt: new Date().toISOString(),
    consensus: { haikuAgreed: !d.any, elementsChanged: d.changed, tiebreak: !!t, scores: passes.map((p) => p.clutter_score) },
    main_idea: passes[0].main_idea, ideas: passes[0].ideas, summary: passes[0].summary,
    clutter_score: median(passes.map((p) => Number(p.clutter_score))),
    completeness_score: median(passes.map((p) => Number(p.completeness_score ?? 10))),
    missing, defects: [...new Set(passes.flatMap((p) => p.defects || []))],
    regions,
    metrics: {
      shares, clutterShare: Math.round((shares.red + shares.orange / 2) * 10) / 10,
      ideaCount: passes[0].ideas.length, missingCount: missing.length,
      redByType: regions.filter((r) => r.label === 'red').reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + r.ids.length), m), {}),
      coverage: Math.round((100 * Object.keys(labelOf).length) / (elements.length || 1)),
      words: stats.words, textElements: stats.textElements,
    },
  };
  fs.writeFileSync(path.join(RUNS, id, 'grades', `${OUT}.json`), JSON.stringify(grade, null, 1) + '\n');
  done++; if (t) tie++;
}
console.log(`consensus written for ${done} runs; Haiku passes agreed on ${done - tie}, Sonnet broke ties on ${tie}`);
