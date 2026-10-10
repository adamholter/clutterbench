// Usage: node preview.cjs graphic.html  -> writes preview.png next to it
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const file = path.resolve(process.argv[2] || 'graphic.html');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
    await page.goto('file://' + file, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    const out = path.join(path.dirname(file), 'preview.png');
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 1200 } });
    console.log(`wrote ${out} (page content is ${size.w}x${size.h}, canvas is 1200x1200)`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(String(e)); process.exit(1); });
