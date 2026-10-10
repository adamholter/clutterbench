// Grade each run for clutter with a cheap model via the headless CLI.
// Writes runs/<id>/grades/<grader>.json. Several graders can coexist so their
// labels can be compared against Adam's annotations.
//
//   node scripts/grade.cjs [--grader haiku-v1] [--only substr] [--concurrency 4] [--force]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUNS = process.env.CB_RUNS || path.join(ROOT, 'runs'); // CB_RUNS: grade something other than benchmark runs

// name -> model + prompt file. Add entries here to try other graders.
const GRADERS = {
  'haiku-v1': { cli: 'claude', model: 'claude-haiku-5-5', effort: 'low', prompt: 'grader_v1.md' },
  'sonnet-v1': { cli: 'claude', model: 'claude-sonnet-5-5', effort: 'low', prompt: 'grader_v1.md' },
  'luna-v1': { cli: 'codex', model: 'gpt-6-luna', effort: 'low', prompt: 'grader_v1.md' },
  'haiku-v2': { cli: 'claude', model: 'claude-haiku-5-5', effort: 'low', prompt: 'grader_v2.md' },
  'luna-v2': { cli: 'codex', model: 'gpt-6-luna', effort: 'low', prompt: 'grader_v2.md' },
};
// v3 prompt across models and reasoning efforts: <model>-<effort>-v3
const V3_MODELS = { haiku: ['claude', 'claude-haiku-5-5'], sonnet: ['claude', 'claude-sonnet-5-5'], luna: ['codex', 'gpt-6-luna'] };
for (const [m, [cli, model]] of Object.entries(V3_MODELS))
  for (const effort of ['low', 'medium', 'high', 'xhigh'])
    for (const v of ['v3', 'v4']) GRADERS[`${m}-${effort}-${v}`] = { cli, model, effort, prompt: `grader_${v}.md` };
// second independent pass of the same grader, for the consensus protocol
GRADERS['haiku-low-v4-b'] = { ...GRADERS['haiku-low-v4'] };

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
}

function elementLines(elements) {
  return elements
    .map((e) => `${e.id} ${e.kind} ${e.x},${e.y},${e.w},${e.h}${e.fontSize ? ` ${e.fontSize}px` : ''}${e.text ? ` "${e.text}"` : ''}`)
    .join('\n');
}

function callClaude(g, prompt, cwd) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^CLAUDE/.test(k) || /^ANTHROPIC_/.test(k)) delete env[k];
    const child = spawn(path.join(process.env.HOME, '.claude/local/claude'),
      ['-p', prompt, '--model', g.model, '--effort', g.effort, '--dangerously-skip-permissions', '--setting-sources', '',
        '--strict-mcp-config', '--tools', 'Read', '--output-format', 'json'],
      { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const d = JSON.parse(out);
        if (d.is_error) return reject(new Error(`grader error: ${String(d.result).slice(0, 200)}`));
        const u = d.usage || {};
        resolve({ text: d.result, usd: d.total_cost_usd, tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0), outputTokens: u.output_tokens });
      } catch (e) {
        reject(new Error(`grader exit ${code}: ${(err || out).slice(0, 300)}`));
      }
    });
  });
}

function callCodex(g, prompt, cwd) {
  return new Promise((resolve, reject) => {
    const out = path.join(require('os').tmpdir(), `cb-grade-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
    const child = spawn('codex', ['exec', '-m', g.model, '-c', `model_reasoning_effort="${g.effort}"`, '--skip-git-repo-check',
      '-s', 'read-only', '-i', path.join(cwd, 'shot.png'), '-o', out, '--', prompt],
      { cwd: require('os').tmpdir(), env: { ...process.env, CODEX_HOME: '/tmp/cb-codex-home' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '', so = '';
    child.stdout.on('data', (d) => (so += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const text = fs.readFileSync(out, 'utf8');
        fs.rmSync(out, { force: true });
        const m = /tokens used\s*\n?\s*([\d,]+)/.exec(so + err);
        resolve({ text, tokens: m ? Number(m[1].replace(/,/g, '')) : null });
      } catch (e) { reject(new Error(`grader exit ${code}: ${err.slice(-300)}`)); }
    });
  });
}

function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('no JSON in grader reply');
  return JSON.parse(text.slice(s, e + 1));
}

// Paint labels onto a coarse grid: containers first, leaf marks on top.
// A container contributes only its border ring, so a card's empty interior
// counts for nothing. Shares are of painted pixels: blank canvas is not rewarded.
function areaShares(elements, labelOf, canvas) {
  const S = 4, gw = Math.ceil(canvas.w / S), gh = Math.ceil(canvas.h / S);
  const grid = new Uint8Array(gw * gh);
  const code = { blue: 1, orange: 2, red: 3, none: 4 };
  const order = [...elements].sort((a, b) => (a.kind === 'box') === (b.kind === 'box') ? b.w * b.h - a.w * a.h : a.kind === 'box' ? -1 : 1);
  for (const e of order) {
    const c = code[labelOf[e.id] || 'none'];
    const x0 = Math.floor(e.x / S), y0 = Math.floor(e.y / S);
    const x1 = Math.min(gw, Math.ceil((e.x + e.w) / S)), y1 = Math.min(gh, Math.ceil((e.y + e.h) / S));
    const ring = e.kind === 'box' ? 2 : Infinity;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (x - x0 < ring || x1 - 1 - x < ring || y - y0 < ring || y1 - 1 - y < ring) grid[y * gw + x] = c;
  }
  const n = [0, 0, 0, 0, 0];
  for (const v of grid) n[v]++;
  const painted = n[1] + n[2] + n[3] + n[4] || 1;
  const pct = (v) => Math.round((1000 * v) / painted) / 10;
  return { blue: pct(n[1]), orange: pct(n[2]), red: pct(n[3]), unlabelled: pct(n[4]), paintedOfCanvas: Math.round((1000 * painted) / grid.length) / 10 };
}

async function gradeOne(id, name, g, force) {
  const dir = path.join(RUNS, id);
  const outPath = path.join(dir, 'grades', `${name}.json`);
  if (!fs.existsSync(path.join(dir, 'elements.json'))) return;
  if (fs.existsSync(outPath) && !force) return;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const { canvas, elements, stats } = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8'));
  const prompt = fs.readFileSync(path.join(ROOT, 'prompts', g.prompt), 'utf8')
    .replace('{{SHOT}}', path.join(dir, 'shot.png'))
    .replace('{{W}}', canvas.w).replace('{{H}}', canvas.h)
    .replace('{{ARTICLE}}', fs.readFileSync(fs.existsSync(path.join(dir, 'article.md')) ? path.join(dir, 'article.md') : path.join(ROOT, 'data/articles', `${meta.task}.md`), 'utf8'))
    .replace('{{ELEMENTS}}', elementLines(elements));
  let raw, parsed, cost;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    try {
      const t0 = Date.now();
      raw = await (g.cli === 'codex' ? callCodex : callClaude)(g, prompt, dir);
      cost = { seconds: Math.round((Date.now() - t0) / 100) / 10, usd: raw.usd ?? null, tokens: raw.tokens ?? null, outputTokens: raw.outputTokens ?? null };
      parsed = parseJson(raw.text);
    } catch (e) {
      if (attempt === 1 || /limit/i.test(e.message)) return console.error('FAIL', id, name, e.message.slice(0, 160));
    }
  }
  const known = new Set(elements.map((e) => e.id));
  const labelOf = {};
  const regions = (parsed.regions || []).map((r, i) => {
    const ids = (r.ids || []).filter((x) => known.has(x) && !labelOf[x]);
    for (const x of ids) labelOf[x] = r.label;
    return { rid: `r${i}`, label: r.label, type: r.type, name: r.name || '', reason: r.reason || '', ids };
  }).filter((r) => r.ids.length);
  const shares = areaShares(elements, labelOf, canvas);
  const grade = {
    grader: name, model: g.model, effort: g.effort, prompt: g.prompt, gradedAt: new Date().toISOString(),
    main_idea: parsed.main_idea, ideas: parsed.ideas || [], clutter_score: parsed.clutter_score, summary: parsed.summary,
    missing: (parsed.missing || []).map((m, i) => ({ mid: `m${i}`, what: m.what || '', why: m.why || '' })),
    completeness_score: parsed.completeness_score ?? null,
    defects: parsed.defects || [],
    cost,
    regions,
    metrics: {
      shares,
      // headline: share of drawn area that is clutter (orange counts half)
      clutterShare: Math.round((shares.red + shares.orange / 2) * 10) / 10,
      ideaCount: (parsed.ideas || []).length,
      missingCount: (parsed.missing || []).length,
      redByType: regions.filter((r) => r.label === 'red').reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + 1), m), {}),
      coverage: Math.round((100 * Object.keys(labelOf).length) / (elements.length || 1)),
      words: stats.words, textElements: stats.textElements,
    },
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(grade, null, 1) + '\n');
  console.log(id, name, `clutter=${grade.metrics.clutterShare}%`, `score=${grade.clutter_score}`, `ideas=${grade.metrics.ideaCount}`, `missing=${grade.metrics.missingCount}`, `cov=${grade.metrics.coverage}%`);
}

async function main() {
  const name = arg('grader', 'haiku-v1');
  const g = GRADERS[name];
  if (!g) throw new Error(`unknown grader ${name}; have ${Object.keys(GRADERS)}`);
  const only = arg('only');
  const force = process.argv.includes('--force');
  const exact = arg('ids') ? new Set(arg('ids').split(',')) : null;
  const ids = fs.readdirSync(RUNS).filter((id) => (!only || id.includes(only)) && (!exact || exact.has(id))).sort();
  let i = 0;
  await Promise.all(Array.from({ length: Number(arg('concurrency', 4)) }, async () => {
    while (i < ids.length) await gradeOne(ids[i++], name, g, force);
  }));
}
module.exports = { areaShares };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
