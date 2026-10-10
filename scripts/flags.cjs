// Contamination flags from an agent log. Only what the agent itself issued
// (tool inputs: commands, URLs, queries) counts; tool output that merely lists
// a link to the post does not.
//
//   node scripts/flags.cjs   -> recompute flags in every runs/*/meta.json
const fs = require('fs');
const path = require('path');

const INPUT_KEYS = new Set(['command', 'url', 'query', 'file_path', 'path', 'pattern']);

function issued(logText) {
  const out = [];
  const walk = (v, key) => {
    if (typeof v === 'string') { if (INPUT_KEYS.has(key)) out.push(v); return; }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'results' && k !== 'aggregated_output') walk(x, k);
  };
  for (const line of logText.split('\n')) {
    if (line[0] !== '{') continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type === 'user' || d.type === 'system') continue; // tool results / init
    walk(d, '');
  }
  return out.join('\n');
}

function contaminationFlags(logText, task) {
  const text = issued(logText);
  const flags = [];
  if (text.includes(`/blog/${task.id}`)) flags.push('opened_post_page');
  if (/images\/blog\//.test(text) || text.includes(`images/research/${task.id}`)) flags.push('touched_post_images');
  if (/projects\/clutterbench/i.test(text)) flags.push('saw_benchmark'); // the local repo, not the public site
  if (/(^|[\s"'])(ls|find|cat|grep|rg)\s[^\n]*(\/Users\/adam|~\/)/.test(text)) flags.push('left_workdir');
  // agent harnesses ship skills; a fair run must not read any
  if (/SKILL\.md|\/skills\/|\/plugins\/cache\//i.test(text)) flags.push('read_skill');
  return flags;
}
module.exports = { contaminationFlags, issued };

if (require.main === module) {
  const RUNS = path.join(__dirname, '..', 'runs');
  for (const id of fs.readdirSync(RUNS).sort()) {
    const mp = path.join(RUNS, id, 'meta.json');
    if (!fs.existsSync(mp)) continue;
    const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
    meta.flags = contaminationFlags(fs.readFileSync(path.join(RUNS, id, 'gen.log'), 'utf8'), { id: meta.task });
    fs.writeFileSync(mp, JSON.stringify(meta, null, 2) + '\n');
    if (meta.flags.length) console.log(id, meta.flags.join(','));
  }
}
