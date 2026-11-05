import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');
const MARK_SVG = path.resolve(PUBLIC_DIR, 'brand', 'kay-chart-mark.svg');

const svg = fs.readFileSync(MARK_SVG, 'utf8');

const sizes = [
  { name: 'icon-192.png', width: 192, height: 192 },
  { name: 'icon-512.png', width: 512, height: 512 },
  { name: 'apple-touch-icon-180.png', width: 180, height: 180 },
];

for (const { name, width, height } of sizes) {
  await sharp(Buffer.from(svg))
    .resize(width, height, {
      fit: 'contain',
      background: { r: 10, g: 10, b: 15, alpha: 1 },
    })
    .png()
    .toFile(path.resolve(PUBLIC_DIR, name));
  console.log(`Generated ${name} (${width}x${height})`);
}

console.log('All icons generated successfully.');
