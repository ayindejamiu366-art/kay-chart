/**
 * Measure the true ink extents of an SVG and report the viewBox actually
 * needed, so the lockup's viewBox can be fitted to its content instead of
 * guessed at.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const svg = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
  await page.goto('file:///' + path.resolve(svg).replace(/\\/g, '/'));
  await page.waitForTimeout(300);

  const box = await page.evaluate(() => {
    const svgEl = document.querySelector('svg');
    const bb = svgEl.getBBox();
    const vb = svgEl.viewBox.baseVal;
    return {
      bbox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
      viewBox: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
      // How far the ink extends past the declared viewBox.
      overflowRight: Math.round(bb.x + bb.width - (vb.x + vb.width)),
      overflowBottom: Math.round(bb.y + bb.height - (vb.y + vb.height)),
    };
  });

  console.log(JSON.stringify(box, null, 2));
  await browser.close();
})();