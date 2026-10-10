// Run the generation matrix: tasks x models x variants.
// Each run is a headless agent CLI session (subscription auth, no API keys)
// in a neutral scratch dir, so the agent cannot see the benchmark or grader.
//
//   node scripts/run_gen.cjs [--tasks a,b] [--models haiku,luna] [--variants raw,simple] [--concurrency 4] [--force]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { contaminationFlags } = require('./flags.cjs');

const ROOT = path.join(__dirname, '..');
const WORK = '/private/tmp/cbw';
const TOOLS = path.join(WORK, '_tools');
const CODEX_HOME = '/tmp/cb-codex-home';
const CANVAS = { w: 1200, h: 1200 };
const TIMEOUT_MS = 20 * 60 * 1000;

const MODELS = {
  haiku: { cli: 'claude', model: 'claude-haiku-5-5', effort: 'low' },
  luna: { cli: 'codex', model: 'gpt-6-luna', effort: 'low' },
  sol: { cli: 'codex', model: 'gpt-6.1-sol', effort: 'low' },
  astra: { cli: 'codex', model: 'gpt-6-astra', effort: 'low' },
  sonnet: { cli: 'claude', model: 'claude-sonnet-5-5', effort: 'low' },
};
const VARIANTS = ['raw', 'simple'];

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

function ensureTools() {
  fs.mkdirSync(TOOLS, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts/agent_preview.cjs'), path.join(TOOLS, 'preview.cjs'));
  const nm = path.join(TOOLS, 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(path.join(ROOT, 'node_modules'), nm);
  fs.mkdirSync(CODEX_HOME, { recursive: true });
  const auth = path.join(CODEX_HOME, 'auth.json');
  if (!fs.existsSync(auth)) fs.symlinkSync(path.join(process.env.HOME, '.codex/auth.json'), auth);
}

function buildPrompt(task, variant) {
  const base = fs.readFileSync(path.join(ROOT, 'prompts/gen_base.md'), 'utf8');
  const v = fs.readFileSync(path.join(ROOT, `prompts/variant_${variant}.md`), 'utf8').trim();
  return base
    .replace('{{VARIANT}}', v)
    .replace('{{W}}', CANVAS.w)
    .replace('{{H}}', CANVAS.h)
    .replace('{{TOOLS}}', TOOLS)
    .replaceAll('{{PUBLISHER}}', task.publisher || 'AfterQuery')
    .replaceAll('{{SITE}}', task.site || 'afterquery.com')
    .replace('{{POST_RULE}}', task.postRule
      || `Do not open this post's own page on afterquery.com (${task.url}), its images, or any existing graphic, chart, social card or coverage of this post anywhere. Other pages of afterquery.com are fine as style references.`);
}

function cleanEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^CLAUDE/.test(k) || /^ANTHROPIC_/.test(k) || /^OPENAI_/.test(k)) delete env[k];
  return env;
}

function runAgent(m, prompt, cwd, logPath) {
  return new Promise((resolve) => {
    let cmd, args;
    const env = cleanEnv();
    if (m.cli === 'claude') {
      cmd = path.join(process.env.HOME, '.claude/local/claude');
      args = ['-p', prompt, '--model', m.model, '--effort', m.effort, '--dangerously-skip-permissions',
        '--setting-sources', '', '--strict-mcp-config', '--output-format', 'stream-json', '--verbose'];
    } else {
      cmd = 'codex';
      env.CODEX_HOME = CODEX_HOME;
      args = ['exec', '-m', m.model, '-c', `model_reasoning_effort="${m.effort}"`, '--skip-git-repo-check',
        '--dangerously-bypass-approvals-and-sandbox', '--json', prompt];
    }
    const log = fs.createWriteStream(logPath);
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      log.end(() => resolve({ code, timedOut: signal === 'SIGKILL' }));
    });
  });
}

async function runOne(task, modelKey, variant) {
  const id = `${task.id}__${modelKey}__${variant}`;
  const outDir = path.join(ROOT, 'runs', id);
  if (fs.existsSync(path.join(outDir, 'graphic.html')) && !has('force')) return console.log('skip', id);
  const cwd = path.join(WORK, `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(cwd, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'data/articles', `${task.id}.md`), path.join(cwd, 'article.md'));
  const prompt = buildPrompt(task, variant);
  const m = MODELS[modelKey];
  const started = Date.now();
  console.log('start', id);
  const res = await runAgent(m, prompt, cwd, path.join(cwd, '..', `${path.basename(cwd)}.log`));
  const logPath = path.join(cwd, '..', `${path.basename(cwd)}.log`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const produced = fs.existsSync(path.join(cwd, 'graphic.html'));
  if (produced) fs.cpSync(cwd, outDir, { recursive: true });
  fs.copyFileSync(logPath, path.join(outDir, 'gen.log'));
  const logText = fs.readFileSync(logPath, 'utf8');
  const meta = {
    id, task: task.id, title: task.title, model: modelKey, modelId: m.model, effort: m.effort, variant,
    canvas: CANVAS, produced, exitCode: res.code, timedOut: res.timedOut,
    seconds: Math.round((Date.now() - started) / 1000),
    flags: contaminationFlags(logText, task),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'prompt.md'), prompt);
  console.log(produced ? 'done ' : 'FAIL ', id, `${meta.seconds}s`, meta.flags.join(',') || '');
}

async function main() {
  ensureTools();
  const tasks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tasks.json'), 'utf8'));
  const tf = arg('tasks');
  const models = arg('models', Object.keys(MODELS).join(',')).split(',');
  const variants = arg('variants', VARIANTS.join(',')).split(',');
  const jobs = [];
  for (const t of tasks) {
    if (tf && !tf.split(',').some((s) => t.id.includes(s))) continue;
    for (const m of models) for (const v of variants) jobs.push([t, m, v]);
  }
  const n = Number(arg('concurrency', 4));
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      await runOne(...j).catch((e) => console.error('error', j[0].id, j[1], j[2], e.message));
    }
  }));
}
main();
