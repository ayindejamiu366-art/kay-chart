/**
 * Render a brand SVG to PNG at a given width.
 *
 * Navigating straight to an .svg renders it at its intrinsic size and crops
 * anything wider than the viewport, so the asset is loaded into an <img> that is
 * explicitly scaled instead. This makes the preview match how the logo is
 * actually used, at a chosen size.
 *
 * Usage: node tests/_render-brand.cjs <svgPath> <outPng> [width] [height]
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const [svg, out, w = '512', h] = process.argv.slice(2);
  const svgPath = path.resolve(svg).replace(/\\/g, '/');
  const svgData = fs.readFileSync(svgPath, 'utf8');
  const height = h || w;

  const html = `<!doctype html><html><body style="margin:0;background:#0A0A0F;display:flex;align-items:center;justify-content:center;height:100vh">
    <img src="data:image/svg+xml;base64,${Buffer.from(svgData).toString('base64')}"
         style="width:${w}px;height:${height}px;object-fit:contain">
  </body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: Math.max(+w, 200), height: Math.max(+height, 200) },
  });
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  console.log('rendered', out, `${w}x${height}`);
  await browser.close();
})();