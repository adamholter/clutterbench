// Render every run's graphic.html to shot.png and extract elements.json:
// the visible text / shape / box units with their bounding boxes. The grader
// labels these by id, which gives exact regions for the annotation overlay.
//
//   node scripts/shot.cjs [--only substr] [--force]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const RUNS = process.env.CB_RUNS || path.join(ROOT, 'runs'); // CB_RUNS: grade something other than benchmark runs

function extractInPage(W, H) {
  const out = [];
  const seen = new Set();
  const clip = (r) => {
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    const x2 = Math.min(W, r.right), y2 = Math.min(H, r.bottom);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(x2 - x), h: Math.round(y2 - y) };
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02;
  };
  const transparent = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
  const push = (kind, el, rect, extra) => {
    const b = clip(rect);
    if (b.w < 2 || b.h < 2) return;
    const key = `${kind}:${b.x}:${b.y}:${b.w}:${b.h}:${extra.text || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, tag: el.tagName.toLowerCase(), ...b, ...extra });
  };
  const SHAPES = new Set(['rect', 'circle', 'ellipse', 'path', 'line', 'polyline', 'polygon']);
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    let hidden = false;
    for (let p = el.parentElement; p; p = p.parentElement) if (!visible(p)) { hidden = true; break; }
    if (hidden) continue;
    const tag = el.tagName.toLowerCase();
    const cs = getComputedStyle(el);
    if (['script', 'style', 'defs', 'clippath', 'lineargradient', 'pattern', 'mask', 'title'].includes(tag)) continue;
    if (el.closest('defs, clipPath, pattern, mask, linearGradient')) continue;

    // text units: one per element that directly owns text
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText.length) {
      const range = document.createRange();
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const n of ownText) {
        range.selectNodeContents(n);
        for (const q of range.getClientRects()) {
          l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
        }
      }
      if (r > l) {
        push('text', el, { left: l, top: t, right: r, bottom: b }, {
          text: ownText.map((n) => n.textContent.trim()).join(' ').replace(/\s+/g, ' ').slice(0, 160),
          fontSize: Math.round(parseFloat(cs.fontSize)),
          color: cs.fill && el instanceof SVGElement ? cs.fill : cs.color,
        });
      }
    }
    const rect = el.getBoundingClientRect();
    if (el instanceof SVGElement) {
      if (SHAPES.has(tag)) {
        const fill = transparent(cs.fill) || cs.fill === 'none' ? null : cs.fill;
        const stroke = transparent(cs.stroke) || cs.stroke === 'none' ? null : cs.stroke;
        if (fill || stroke) push('shape', el, rect, { color: fill || stroke });
      }
      continue;
    }
    if (tag === 'img') { push('image', el, rect, { text: el.alt || '' }); continue; }
    const hasBg = !transparent(cs.backgroundColor) || cs.backgroundImage !== 'none';
    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
    if (hasBg || hasBorder) {
      const area = rect.width * rect.height;
      if (area > W * H * 0.9) continue; // page background
      // "box" = container with children; "shape" = leaf mark such as a bar
      push(el.children.length ? 'box' : 'shape', el, rect, { color: hasBg ? cs.backgroundColor : cs.borderTopColor });
    }
  }
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  return out.map((e, i) => ({ id: `e${i}`, ...e }));
}

async function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const force = process.argv.includes('--force');
  const browser = await chromium.launch();
  try {
    for (const id of fs.readdirSync(RUNS).sort()) {
      const dir = path.join(RUNS, id);
      const html = path.join(dir, 'graphic.html');
      const metaPath = path.join(dir, 'meta.json');
      const hasUrl = fs.existsSync(metaPath) && JSON.parse(fs.readFileSync(metaPath, 'utf8')).url;
      if ((!fs.existsSync(html) && !hasUrl) || (only && !id.includes(only))) continue;
      if (fs.existsSync(path.join(dir, 'elements.json')) && !force) continue;
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
      const { w, h } = meta.canvas;
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      await page.goto(meta.url || 'file://' + html, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const content = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
      await page.screenshot({ path: path.join(dir, 'shot.png'), clip: { x: 0, y: 0, width: w, height: h } });
      const elements = await page.evaluate(`(${extractInPage.toString()})(${w}, ${h})`);
      await page.close();
      const texts = elements.filter((e) => e.kind === 'text');
      const stats = {
        elements: elements.length,
        textElements: texts.length,
        words: texts.reduce((n, e) => n + e.text.split(/\s+/).filter(Boolean).length, 0),
        fontSizes: [...new Set(texts.map((e) => e.fontSize))].length,
        overflow: content.w > w + 1 || content.h > h + 1,
        content,
      };
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify({ canvas: meta.canvas, stats, elements }, null, 1) + '\n');
      console.log(id, JSON.stringify(stats));
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
