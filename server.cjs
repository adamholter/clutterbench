// ClutterBench review server: run data API + annotation storage + built UI.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 7377);
const ROOT = __dirname;
const RUNS = path.join(ROOT, 'runs');
const ANN = path.join(ROOT, 'annotations');
const DIST = path.join(ROOT, 'ui/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const readJson = (p, def = null) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
};
const safeId = (id) => /^[\w.\-]+$/.test(id) && !id.includes('..');

function grades(dir) {
  const g = {};
  const gd = path.join(dir, 'grades');
  if (fs.existsSync(gd)) for (const f of fs.readdirSync(gd)) if (f.endsWith('.json')) g[f.slice(0, -5)] = readJson(path.join(gd, f));
  return g;
}

function listRuns() {
  if (!fs.existsSync(RUNS)) return [];
  return fs.readdirSync(RUNS).sort().map((id) => {
    const dir = path.join(RUNS, id);
    const meta = readJson(path.join(dir, 'meta.json'));
    if (!meta || !fs.existsSync(path.join(dir, 'shot.png'))) return null;
    const el = readJson(path.join(dir, 'elements.json'), {});
    const ann = readJson(path.join(ANN, `${id}.json`));
    const metrics = {};
    for (const [name, g] of Object.entries(grades(dir))) metrics[name] = { ...g.metrics, clutter_score: g.clutter_score };
    return { ...meta, stats: el.stats, metrics, annotated: !!ann && ((ann.elements || []).length > 0 || Object.keys(ann.labels || {}).length > 0), reviewed: !!ann && !!ann.reviewed };
  }).filter(Boolean);
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function sendFile(res, file) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
  return true;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === 'api' && parts[1] === 'runs' && parts.length === 2) return send(res, 200, listRuns());
    if (parts[0] === 'api' && parts[1] === 'runs' && parts.length === 3 && safeId(parts[2])) {
      const dir = path.join(RUNS, parts[2]);
      const meta = readJson(path.join(dir, 'meta.json'));
      if (!meta) return send(res, 404, { error: 'not found' });
      return send(res, 200, {
        meta,
        ...readJson(path.join(dir, 'elements.json'), { elements: [], stats: {} }),
        grades: grades(dir),
        annotation: readJson(path.join(ANN, `${parts[2]}.json`)),
      });
    }
    if (parts[0] === 'api' && parts[1] === 'annotations' && parts.length === 3 && safeId(parts[2]) && req.method === 'PUT') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        const data = JSON.parse(body);
        fs.mkdirSync(ANN, { recursive: true });
        fs.writeFileSync(path.join(ANN, `${parts[2]}.json`), JSON.stringify({ ...data, runId: parts[2], updatedAt: new Date().toISOString() }, null, 1) + '\n');
        send(res, 200, { ok: true });
      });
      return;
    }
    if (parts[0] === 'runs' && parts.length >= 3 && parts.every(safeId)) {
      if (sendFile(res, path.join(RUNS, ...parts.slice(1)))) return;
      return send(res, 404, { error: 'not found' });
    }
    const file = path.join(DIST, ...parts);
    if (file.startsWith(DIST) && sendFile(res, file)) return;
    if (sendFile(res, path.join(DIST, 'index.html'))) return;
    send(res, 404, 'UI not built. Run: npm run build', 'text/plain');
  } catch (e) {
    send(res, 500, { error: String(e.message) });
  }
}).listen(PORT, () => console.log(`ClutterBench review UI: http://localhost:${PORT}`));
