/**
 * Find files carrying a UTF-8 BOM.
 *
 * PowerShell 5.1's `Set-Content -Encoding UTF8` prepends a BOM. Node's JSON and
 * JS loaders reject it outright ("Unexpected token '\uFEFF'"), which is how this
 * surfaced during the build. This scans the working tree so every affected file
 * is found rather than the one that happens to break the build first.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.gradle', 'test-results', 'playwright-report']);

// Directories to inspect.
const TARGETS = [
  'src', 'server', 'public', 'tests', 'android/app/src/main/res/values',
];
// Individual root files.
const ROOT_FILES = [
  'package.json', 'package-lock.json', 'index.html',
  'postcss.config.js', 'vite.config.js', 'vitest.config.js', 'tailwind.config.js',
  'eslint.config.js', 'capacitor.config.ts', 'playwright.skeleton.config.js',
  'playwright.celebration.config.js',
];

const found = [];

function scan(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return; }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    found.push(path.relative(ROOT, file).replace(/\\/g, '/'));
  }
}

for (const rel of ROOT_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) scan(full);
}

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(js|jsx|cjs|mjs|ts|tsx|json|html|css|xml)$/.test(e.name)) scan(full);
  }
}
for (const t of TARGETS) {
  const full = path.join(ROOT, t);
  if (fs.existsSync(full)) walk(full);
}

if (found.length) {
  console.log(`BOM found in ${found.length} file(s):`);
  found.forEach((f) => console.log(`  ${f}`));
} else {
  console.log('No BOMs found.');
}
process.exit(found.length ? 1 : 0);