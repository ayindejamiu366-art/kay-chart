const fs = require('fs');
const sw = fs.readFileSync('./dist/sw.js', 'utf8');

const matches = sw.matchAll(/\{url:"([^"]+)"/g);
const urls = [];
for (const m of matches) urls.push(m[1]);
console.log('Total precached entries:', urls.length);

// Check for sensitive patterns
const sensitive = urls.filter(u => /\/api\/auth|\/api\/.*\/otp|stream|\.mp3|\.jwt/.test(u));
console.log('Sensitive entries found:', sensitive.length);
if (sensitive.length > 0) console.log(sensitive);

// Check for icons
const icons = urls.filter(u => /icon-192|icon-512|apple-touch/.test(u));
console.log('Icon entries:', JSON.stringify(icons));

// Check for API entries in precache
const apiEntries = urls.filter(u => u.startsWith('/api'));
console.log('API entries in precache:', apiEntries.length);

// Check for auth endpoint patterns
const authPatterns = urls.filter(u => /auth|otp|login|sign/.test(u));
console.log('Auth-related entries:', authPatterns.length);
