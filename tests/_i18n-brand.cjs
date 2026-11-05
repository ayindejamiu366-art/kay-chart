/**
 * Replace the brand name in the remaining translation strings.
 *
 * The first pass handled ASCII-adjacent occurrences. This one works by key on
 * the exact value, so Arabic, Hindi and Tamil strings are replaced by swapping
 * the whole literal rather than by regex-editing inside RTL text, which is where
 * a partial replacement would corrupt the string.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'translations');

// Keys whose value is a translated sentence still carrying the old brand.
// The value is written verbatim; the surrounding translated words are untouched.
const REPLACEMENTS = {
  'SIGNIN_DESCRIPTION': {
    ar: 'سجّل الدخول للمتابعة إلى Kay Chart',
    hi: 'Sign in to continue to Kay Chart',
    ta: 'Sign in to continue to Kay Chart',
  },
  'PROFILE_ITEM_ABOUT_NOCTURNE': {
    ar: 'حول Kay Chart',
    hi: 'Kay Chart के बारे में',
    ta: 'Kay Chart பற்றி',
  },
  'TERMS_ACCEPTANCE': {
    ar: '1. القبول: باستخدامك Kay Chart، فإنك توافق على شروط الخدمة هذه.',
  },
};

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const lang = path.basename(file, '.js');
  const full = path.join(dir, file);
  let text = fs.readFileSync(full, 'utf8');
  let changed = 0;

  for (const [key, byLang] of Object.entries(REPLACEMENTS)) {
    const value = byLang[lang];
    if (!value) continue;

    // Replace only this key's string literal, whatever it currently holds.
    const re = new RegExp(`(\\b${key}\\s*:\\s*)'[^']*'`);
    if (re.test(text)) {
      text = text.replace(re, `$1'${value.replace(/'/g, "\\'")}'`);
      changed++;
    }
  }

  if (changed) {
    fs.writeFileSync(full, text, 'utf8');
    console.log(`${file}: updated ${changed} key(s)`);
  }
}

// The support address is deliberately left as-is; see the final report.
console.log('\nRemaining "Nocturne" occurrences in translations:');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const full = path.join(dir, file);
  fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
    if (/Nocturne|NOCTURNE/.test(line)) {
      console.log(`  ${file}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
  });
}