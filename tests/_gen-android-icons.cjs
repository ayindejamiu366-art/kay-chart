/**
 * Render the Kay Chart mark into the Android launcher PNG densities.
 *
 * `@capacitor/assets` is not installed and adding it for this would mean a new
 * dependency plus a build step, so the existing SVG is rasterised directly with
 * the browser already used for visual QA. This produces the legacy (pre-Oreo)
 * square/round icons that the mipmap-*dpi folders hold.
 *
 * `ic_launcher` is the square icon and `ic_launcher_round` the circular mask;
 * both are generated from the same mark so they stay consistent.
 *
 * Usage: node tests/_gen-android-icons.cjs
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARK = path.join(ROOT, 'public', 'brand', 'kay-chart-mark.svg');

// Standard launcher densities.
const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const markSvg = fs.readFileSync(MARK, 'utf8');
const b64 = Buffer.from(markSvg).toString('base64');

/**
 * Wrap the mark for a given shape.
 * - square: the mark sits on the app's own dark tile, matching the web favicon.
 * - round:  the same, clipped to a circle the way the legacy icon expects.
 */
function page(size, shape) {
  const radius = shape === 'round' ? '50%' : '22%';
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:#0A0A0F;display:flex;align-items:center;justify-content:center;overflow:hidden">
    <div style="width:100%;height:100%;border-radius:${radius};overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0A0A0F">
      <img src="data:image/svg+xml;base64,${b64}" style="width:100%;height:100%">
    </div>
  </body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  let written = 0;

  for (const { dir, size } of DENSITIES) {
    const outDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', dir);
    if (!fs.existsSync(outDir)) continue;

    for (const [file, shape] of [['ic_launcher', 'square'], ['ic_launcher_round', 'round']]) {
      const page_ = await browser.newPage({ viewport: { width: size, height: size } });
      await page_.setContent(page(size, shape), { waitUntil: 'load' });
      await page_.waitForTimeout(120);
      await page_.screenshot({
        path: path.join(outDir, `${file}.png`),
        omitBackground: false,
      });
      await page_.close();
      written++;
    }
    console.log(`${dir}: ${size}px`);
  }

  await browser.close();
  console.log(`\nwrote ${written} launcher PNG(s)`);
})();