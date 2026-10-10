// Score graders against Adam's reviews, separately on the dev and held-out
// test articles (data/split.json). Writes reports/eval.md and reports/eval.json.
//
// Ground truth per run:
//   - element labels from click mode. A reviewed run with no labels and a
//     clutter score of 0 means "nothing to cut": every element is blue.
//     Runs marked only with draw-mode strokes are left out of element metrics.
//   - Adam's 0-10 clutter score.
//   - whether his notes say key information is missing or unreadable.
//
//   node scripts/eval.cjs [--graders a,b] [--detail grader] [--split dev]
const fs = require('fs');
const path = require('path');
const { areaShares } = require('./grade.cjs');

const ROOT = path.join(__dirname, '..');
const arg = (n, d) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const split = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/split.json'), 'utf8'));
const problemRuns = new Set(split.humanProblems.runs);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function truth() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'annotations')).sort()) {
    const ann = readJson(path.join(ROOT, 'annotations', f));
    if (!ann.reviewed) continue;
    const dir = path.join(ROOT, 'runs', ann.runId);
    const meta = readJson(path.join(dir, 'meta.json'));
    const { elements } = readJson(path.join(dir, 'elements.json'));
    let labels = ann.labels && Object.keys(ann.labels).length ? ann.labels : null;
    if (!labels && Number(ann.myScore) === 0 && !(ann.elements || []).length) labels = Object.fromEntries(elements.map((e) => [e.id, 'blue']));
    const hs = labels ? areaShares(elements, labels, meta.canvas) : null;
    out.push({
      id: ann.runId, meta, elements, labels, score: ann.myScore === '' || ann.myScore == null ? null : Number(ann.myScore),
      share: hs ? hs.red + hs.orange / 2 : null, problem: problemRuns.has(ann.runId), notes: ann.notes || '',
      set: split.dev.includes(meta.task) ? 'dev' : split.test.includes(meta.task) ? 'test' : null,
    });
  }
  return out;
}

function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function corr(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : NaN;
}
const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

function evalGrader(name, runs, detail) {
  let n = 0, exact = 0, cut = 0;
  const L = ['blue', 'orange', 'red'];
  const conf = Object.fromEntries(L.map((a) => [a, Object.fromEntries(L.map((b) => [b, 0]))]));
  const perRunAcc = [], sa = [], sg = [], shareErr = [], secs = [], usd = [], toks = [];
  let pTP = 0, pFP = 0, pFN = 0, pTN = 0, graded = 0;
  for (const t of runs) {
    const gp = path.join(ROOT, 'runs', t.id, 'grades', `${name}.json`);
    if (!fs.existsSync(gp)) continue;
    const g = readJson(gp);
    graded++;
    const gl = {};
    for (const r of g.regions) for (const id of r.ids) gl[id] = { label: r.label, r };
    if (t.labels) {
      let rn = 0, re = 0;
      for (const e of t.elements) {
        const h = t.labels[e.id], x = gl[e.id];
        // containers are skipped: in click mode they sit under their contents and mostly
        // got their colour from Rest -> blue, so they do not reflect a real judgement
        if (e.kind === 'box' || !h || !x || !conf[h] || conf[h][x.label] === undefined) continue;
        n++; rn++; conf[h][x.label]++;
        if (h === x.label) { exact++; re++; }
        else if (detail) console.log(`  ${t.id.slice(-34)} | Adam ${h} / grader ${x.label} (${x.r.type}, ${x.r.name}) | ${e.kind} ${e.text ? JSON.stringify(e.text.slice(0, 70)) : `${e.w}x${e.h}`}`);
        if ((h === 'red') === (x.label === 'red')) cut++;
      }
      if (rn) perRunAcc.push(re / rn);
      if (t.share != null) shareErr.push(Math.abs(g.metrics.clutterShare - t.share));
    }
    if (t.score != null && g.clutter_score != null) { sa.push(t.score); sg.push(Number(g.clutter_score)); }
    const flagged = (g.missing || []).length > 0;
    if (g.missing) { if (t.problem && flagged) pTP++; else if (!t.problem && flagged) pFP++; else if (t.problem) pFN++; else pTN++; }
    if (g.cost) { if (g.cost.seconds) secs.push(g.cost.seconds); if (g.cost.usd) usd.push(g.cost.usd); if (g.cost.tokens) toks.push(g.cost.tokens); }
  }
  return {
    grader: name, runs: graded, elements: n,
    labelAcc: r1((100 * exact) / n), runAcc: r1(100 * mean(perRunAcc)), cutAcc: r1((100 * cut) / n),
    scoreMAE: r2(mean(sa.map((x, i) => Math.abs(x - sg[i])))), scoreRho: r2(corr(ranks(sa), ranks(sg))),
    shareMAE: r1(mean(shareErr)),
    missing: `${pTP}/${pTP + pFN} caught, ${pFP} false`,
    seconds: r1(mean(secs)), usd: usd.length ? Math.round(mean(usd) * 1000) / 1000 : null, tokens: toks.length ? Math.round(mean(toks)) : null,
    conf,
  };
}

const all = truth();
const graderNames = arg('graders') ? arg('graders').split(',') : [...new Set(all.flatMap((t) => {
  const d = path.join(ROOT, 'runs', t.id, 'grades');
  return fs.existsSync(d) ? fs.readdirSync(d).map((f) => f.slice(0, -5)) : [];
}))].sort();

if (arg('detail')) {
  const set = arg('split', 'dev');
  console.log(`Disagreements, ${arg('detail')}, ${set}:`);
  const r = evalGrader(arg('detail'), all.filter((t) => t.set === set), true);
  console.log(JSON.stringify(r.conf));
  process.exit(0);
}

const cols = ['grader', 'runs', 'labelAcc', 'runAcc', 'cutAcc', 'scoreMAE', 'scoreRho', 'shareMAE', 'missing', 'seconds', 'tokens', 'usd'];
const result = {};
let md = `# Grader eval\n\nGround truth: Adam's reviews of ${all.length} runs. dev = ${split.dev.length} articles used to write prompts; test = ${split.test.length} held-out articles.\n\n`
  + '- labelAcc: % of elements given the same colour as Adam (pooled). runAcc: same, averaged per run so busy graphics do not dominate.\n'
  + '- cutAcc: % agreement on red vs not-red. scoreMAE / scoreRho: error and rank correlation of the 0-10 clutter score.\n'
  + '- shareMAE: error in clutter share, in points. missing: runs where Adam noted missing or unreadable information that the grader also flagged, and false alarms.\n'
  + '- seconds / tokens / usd: mean per graded run (usd is the CLI\'s API-equivalent figure; runs are on subscription).\n';
for (const set of ['test', 'dev']) {
  const runs = all.filter((t) => t.set === set);
  const rows = graderNames.map((g) => evalGrader(g, runs)).filter((r) => r.runs);
  rows.sort((a, b) => (b.runAcc || 0) - (a.runAcc || 0));
  result[set] = rows;
  md += `\n## ${set} (${runs.length} runs, ${runs.filter((t) => t.labels).length} with element labels)\n\n| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n`;
  for (const r of rows) md += `| ${cols.map((c) => r[c] ?? '–').join(' | ')} |\n`;
}
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/eval.md'), md);
fs.writeFileSync(path.join(ROOT, 'reports/eval.json'), JSON.stringify(result, null, 1));
console.log(md);
