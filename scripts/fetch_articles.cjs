// Fetch AfterQuery blog posts and save text-only markdown (figures stripped so
// the generating agent cannot copy the post's existing graphics).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');

const ROOT = path.join(__dirname, '..');
const SLUGS = [
  'improving-qwen38-27b-on-deepswe',
  'improving-qwen35-9b-on-t3-banking',
  'how-we-improved-terminal-bench-2-with-tinker-and-harbor',
  'how-afterquery-helped-nvidia-hill-climb-gdpval',
  'on-policy-distillation-gdpval',
  'building-a-frontier-legal-evaluation-in-partnership-with-legora',
];

async function main() {
  // keep existing tasks and article text untouched; only fetch what is new
  const tasksPath = path.join(ROOT, 'data/tasks.json');
  const tasks = fs.existsSync(tasksPath) ? JSON.parse(fs.readFileSync(tasksPath, 'utf8')) : [];
  for (const slug of SLUGS) {
    const known = tasks.find((t) => t.id === slug);
    if (known && fs.existsSync(path.join(ROOT, 'data/articles', `${slug}.md`))) continue;
    const url = `https://www.afterquery.com/blog/${slug}`;
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const doc = new JSDOM(html).window.document;
    const article = doc.querySelector('article');
    if (!article) throw new Error(`no <article> in ${slug}`);
    const title = (article.querySelector('h1') || doc.querySelector('h1')).textContent.trim();
    const figures = article.querySelectorAll('img, picture, figure, svg, video, iframe, nav, button').length;
    article.querySelectorAll('img, picture, figure, svg, video, iframe, nav, button, script, style').forEach((n) => n.remove());
    // drop the "Table of Contents" block and back link
    article.querySelectorAll('a').forEach((a) => {
      if (/^←/.test(a.textContent.trim())) a.remove();
    });
    const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
    td.use(gfm);
    let md = td.turndown(article.innerHTML).replace(/\n{3,}/g, '\n\n').trim();
    md = md.replace(/Table of Contents[\s\S]*?(?=\n\n[A-Z“"])/, '').replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(path.join(ROOT, 'data/articles', `${slug}.md`), md + '\n');
    if (!known) tasks.push({ id: slug, title, url, words: md.split(/\s+/).length, strippedFigures: figures });
    console.log(slug, md.split(/\s+/).length, 'words');
  }
  fs.writeFileSync(path.join(ROOT, 'data/tasks.json'), JSON.stringify(tasks, null, 2) + '\n');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
