/**
 * Strip UTF-8 BOMs introduced by the PowerShell rebrand pass.
 *
 * Rewriting the bytes without the leading EFBBBF restores the original encoding
 * exactly; no other byte is touched, so the Arabic/Hindi/Tamil content written
 * earlier in this rebrand is preserved byte for byte.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.gradle', 'test-results', 'playwright-report']);
const TARGETS = ['src', 'server', 'public', 'tests', 'android/app/src/main/res/values'];
const ROOT_FILES = [
  'package.json', 'package-lock.json', 'index.html',
  'postcss.config.js', 'vite.config.js', 'vitest.config.js', 'tailwind.config.js',
  'eslint.config.js', 'capacitor.config.ts', 'playwright.skeleton.config.js',
  'playwright.celebration.config.js',
];

const fixed = [];

function strip(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(file, buf.subarray(3));
    fixed.push(path.relative(ROOT, file).replace(/\\/g, '/'));
  }
}

for (const rel of ROOT_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) strip(full);
}
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(js|jsx|cjs|mjs|ts|tsx|json|html|css|xml)$/.test(e.name)) strip(full);
  }
}
for (const t of TARGETS) {
  const full = path.join(ROOT, t);
  if (fs.existsSync(full)) walk(full);
}

console.log(`stripped BOM from ${fixed.length} file(s)`);
fixed.forEach((f) => console.log(`  ${f}`));