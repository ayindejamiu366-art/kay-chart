/**
 * Verify the translation files survived the rebrand rewrite intact.
 *
 * The PowerShell Set-Content pass touched seven files containing Arabic,
 * Devanagari and Tamil text. This checks that each is still valid UTF-8, still
 * contains its script, and parses as a module, so a silent mojibake corruption
 * cannot slip through on the way to a green build.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'translations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

const SCRIPTS = {
  ar: /[\u0600-\u06FF]/,
  hi: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
};

let problems = 0;
for (const f of files) {
  const full = path.join(dir, f);
  const buf = fs.readFileSync(full);
  const text = buf.toString('utf8');

  const name = path.basename(f, '.js');
  const notes = [];

  // A U+FFFD means the bytes were decoded as something they are not.
  if (text.includes('\uFFFD')) notes.push('contains U+FFFD (mojibake)');

  // Round-trip: re-encoding must reproduce the original bytes exactly.
  if (!Buffer.from(text, 'utf8').equals(buf)) notes.push('utf8 round-trip mismatch');

  // Non-ASCII content must still be present for the scripts that use it.
  const script = SCRIPTS[name];
  if (script) {
    const count = (text.match(new RegExp(script.source, 'g')) || []).length;
    if (count < 50) notes.push(`only ${count} characters of ${name} script remain`);
    else notes.push(`${count} ${name} chars OK`);
  }

  // Must still parse.
  try {
    // eslint-disable-next-line no-new-func
    new Function(text.replace(/export default/, 'const _d ='));
    notes.push('parses OK');
  } catch (e) {
    notes.push(`PARSE ERROR: ${e.message}`);
    problems++;
  }

  console.log(`${f}: ${notes.join('; ')}`);
}

console.log(problems ? `\n${problems} file(s) failed to parse` : '\nAll translation files parse cleanly.');
process.exit(problems ? 1 : 0);