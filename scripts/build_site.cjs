// Build the public results site into site/: data.json + web-sized screenshots.
// The page itself (site/index.html, app.js, style.css) is static and reads data.json.
//
//   node scripts/build_site.cjs [--grader consensus-v4]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUNS = path.join(ROOT, 'runs');
const SITE = path.join(ROOT, 'site');
const grader = process.argv.includes('--grader') ? process.argv[process.argv.indexOf('--grader') + 1] : 'consensus-v4';

const MODELS = {
  astra: { name: 'GPT-6 Astra', short: 'Astra' },
  haiku: { name: 'Claude Haiku 5.5', short: 'Haiku 5.5' },
  sonnet: { name: 'Claude Sonnet 5.5', short: 'Sonnet 5.5' },
  luna: { name: 'GPT-6 Luna', short: 'Luna' },
  sol: { name: 'GPT-6.1 Sol', short: 'Sol' },
};
const TASKS = {
  'clutterbench-v1-results': 'ClutterBench results',
  'improving-qwen38-27b-on-deepswe': 'DeepSWE',
  'improving-qwen35-9b-on-t3-banking': 'τ³-Banking',
  'how-we-improved-terminal-bench-2-with-tinker-and-harbor': 'Terminal-Bench 2.0',
  'how-afterquery-helped-nvidia-hill-climb-gdpval': 'GDPval with NVIDIA',
  'on-policy-distillation-gdpval': 'On-policy distillation',
  'building-a-frontier-legal-evaluation-in-partnership-with-legora': 'Legora legal eval',
};
// Shown in the comparison and the wall, but left out of the leaderboard: the post
// describes what clutter is, which primes models toward cleaner graphics.
const SHOWCASE = new Set(['clutterbench-v1-results']);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const r1 = (x) => Math.round(x * 10) / 10;

fs.mkdirSync(path.join(SITE, 'shots'), { recursive: true });
const runs = [];
for (const id of fs.readdirSync(RUNS).sort()) {
  const dir = path.join(RUNS, id);
  const gp = path.join(dir, 'grades', `${grader}.json`);
  if (!fs.existsSync(gp) || !fs.existsSync(path.join(dir, 'shot.png'))) continue;
  const meta = readJson(path.join(dir, 'meta.json'));
  if (!MODELS[meta.model] || !TASKS[meta.task]) continue;
  const g = readJson(gp);
  const { elements } = readJson(path.join(dir, 'elements.json'));
  const byId = Object.fromEntries(elements.map((e) => [e.id, e]));
  const img = `shots/${id}.jpg`;
  const out = path.join(SITE, img);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(path.join(dir, 'shot.png')).mtimeMs)
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1200', path.join(dir, 'shot.png'), '--out', out], { stdio: 'ignore' });
  runs.push({
    id, task: meta.task, model: meta.model, variant: meta.variant, img,
    clutter: g.metrics.clutterShare, shares: g.metrics.shares, score: g.clutter_score, words: g.metrics.words,
    missing: (g.missing || []).map((m) => m.what), summary: g.summary,
    // marks: only what the grader would change, as [x, y, w, h] on the 1200px canvas
    marks: g.regions.filter((r) => r.label !== 'blue').map((r) => ({
      label: r.label, type: r.type, name: r.name, reason: r.reason,
      boxes: r.ids.map((i) => byId[i]).filter((e) => e && e.kind !== 'box').map((e) => [e.x, e.y, e.w, e.h]),
    })).filter((m) => m.boxes.length),
    cut: g.regions.filter((r) => r.label === 'red').reduce((n, r) => n + r.ids.length, 0),
    shrunk: g.regions.filter((r) => r.label === 'orange').reduce((n, r) => n + r.ids.length, 0),
  });
}
const board = [];
for (const model of Object.keys(MODELS)) {
  const row = { model, ...MODELS[model] };
  for (const variant of ['raw', 'simple']) {
    const rs = runs.filter((r) => r.model === model && r.variant === variant && !SHOWCASE.has(r.task));
    if (!rs.length) continue;
    const avg = (f) => r1(rs.reduce((s, r) => s + f(r), 0) / rs.length);
    row[variant] = { n: rs.length, clutter: avg((r) => r.clutter), blue: avg((r) => r.shares.blue), orange: avg((r) => r.shares.orange), red: avg((r) => r.shares.red), words: Math.round(avg((r) => r.words)), missing: rs.filter((r) => r.missing.length).length };
  }
  if (row.raw || row.simple) board.push(row);
}
board.sort((a, b) => ((a.raw || {}).clutter ?? 999) - ((b.raw || {}).clutter ?? 999));
let agreement = null;
try { agreement = readJson(path.join(ROOT, 'reports/eval.json')); } catch {}
// the actual prompts, shown in a modal on the site
const rd = (f) => fs.readFileSync(path.join(ROOT, 'prompts', f), 'utf8').trim();
const prompts = {
  raw: rd('variant_raw.md'), simple: rd('variant_simple.md'),
  shared: rd('gen_base.md').replace('{{VARIANT}}', '[the raw or simple instruction above]').replace('{{W}}', 1200).replace('{{H}}', 1200)
    .replace('{{TOOLS}}', '<tools>').replaceAll('{{PUBLISHER}}', 'AfterQuery').replaceAll('{{SITE}}', 'afterquery.com')
    .replace('{{POST_RULE}}', "Do not open this post's own page on afterquery.com, its images, or any existing graphic, chart, social card or coverage of this post anywhere. Other pages of afterquery.com are fine as style references."),
};
const data = { prompts, repo: 'https://github.com/adamholter/clutterbench', builtAt: new Date().toISOString(), grader, canvas: 1200, models: MODELS, tasks: TASKS, showcase: [...SHOWCASE], board, runs, agreement: agreement && { test: (agreement.test || []).find((r) => r.grader === grader) || null } };
fs.writeFileSync(path.join(SITE, 'data.json'), JSON.stringify(data));
console.log(`site data: ${runs.length} runs, grader ${grader}`);
for (const b of board) console.log(' ', b.name.padEnd(18), 'raw', (b.raw || {}).clutter, 'simple', (b.simple || {}).clutter);
