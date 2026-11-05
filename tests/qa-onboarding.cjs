const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const SECRET = process.env.JWT_SECRET;
const BASE = 'http://localhost:3001/api';
const db = new Database(path.join(__dirname, '..', 'server', 'nocturne.db'), { readonly: false });

const sign = (id, email, name) => jwt.sign({ id, email, name }, SECRET, { expiresIn: '30d' });
const call = async (path, token, body) => {
  const res = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
};

const pref = (uid) => db.prepare('SELECT onboarding_completed FROM user_preferences WHERE user_id = ?').get(uid);

(async () => {
  let fails = 0;
  const check = (label, actual, expected) => {
    const ok = String(actual) === String(expected);
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  };

  // ---------- A. existing user, created before the feature cutoff ----------
  console.log('\nA. Existing user (created 2026-09-07, pre-cutoff)');
  const old = db.prepare("SELECT id, email, name, created_at FROM users WHERE created_at < '2026-09-25' LIMIT 1").get();
  const oldTok = sign(old.id, old.email, old.name);

  const me1 = await call('/auth/me', oldTok);
  check('GET /auth/me status', me1.status, 200);
  check('onboardingCompleted initial', me1.json.user.onboardingCompleted, false);
  check('onboardingEligible (returning user)', me1.json.user.onboardingEligible, false);

  const set1 = await call('/auth/onboarding', oldTok, { completed: true });
  check('POST /auth/onboarding status', set1.status, 200);
  check('db onboarding_completed', pref(old.id).onboarding_completed, 1);

  const me2 = await call('/auth/me', oldTok);
  check('onboardingCompleted after POST', me2.json.user.onboardingCompleted, true);
  check('onboardingEligible still false', me2.json.user.onboardingEligible, false);

  await call('/auth/onboarding', oldTok, { completed: false });
  check('reset back to 0', pref(old.id).onboarding_completed, 0);

  // ---------- B. brand new user, created after the cutoff ----------
  console.log('\nB. Brand new user (created now, post-cutoff)');
  const id = 'usr_qa_' + crypto.randomBytes(5).toString('hex');
  const email = `${id}@qa.local`;
  db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)')
    .run(id, email, 'QA Tester', 'x', new Date().toISOString());
  db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(id);

  const newTok = sign(id, email, 'QA Tester');
  const me3 = await call('/auth/me', newTok);
  check('GET /auth/me status', me3.status, 200);
  check('onboardingEligible (new user)', me3.json.user.onboardingEligible, true);
  check('onboardingCompleted initial', me3.json.user.onboardingCompleted, false);

  await call('/auth/onboarding', newTok, { completed: true });
  check('db onboarding_completed', pref(id).onboarding_completed, 1);

  // ---------- C. security: prefs must not leak across accounts ----------
  console.log('\nC. Cross-account isolation');
  const other = db.prepare('SELECT id, email, name FROM users WHERE id != ? LIMIT 1').get(id);
  const otherTok = sign(other.id, other.email, other.name);
  const me4 = await call('/auth/me', otherTok);
  check('other user completed flag untouched', me4.json.user.onboardingCompleted, false);
  check('other user still ineligible', me4.json.user.onboardingEligible, false);

  // ---------- D. auth required ----------
  console.log('\nD. Auth required');
  const noAuth = await fetch(BASE + '/auth/onboarding', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"completed":true}',
  });
  check('POST without token rejected', noAuth.status, 401);
  const badTok = await call('/auth/onboarding', 'not-a-real-token', { completed: true });
  check('POST with bad token rejected', badTok.status, 401);

  // ---------- cleanup ----------
  db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  console.log('\ncleanup: removed QA user', id);
  console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED'}`);
  process.exit(fails === 0 ? 0 : 1);
})();
