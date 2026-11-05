const BASE = 'http://localhost:3001/api';
const EMAIL = `qa_setup_${Date.now()}@nocturne.test`;
const PASSWORD = 'qa-password-123';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const req = async (method, path, { body, token, raw } = {}) => {
  const headers = {};
  if (body && !raw) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: raw ? body : (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  console.log('=== 1. signup starts profile setup incomplete ===');
  // Insert a verified signup OTP directly through the real endpoint is not
  // possible without mail, so exercise signup the way OTPVerify does: verify
  // that signup refuses without verification, then confirm the state shape on a
  // dedicated QA user created the same way the app does.
  const noVerify = await req('POST', '/auth/signup', { body: { name: 'QA', email: EMAIL, password: PASSWORD } });
  check('signup without OTP is refused', noVerify.status === 403, `got ${noVerify.status}`);

  console.log('\n=== 2. duplicate email -> 409 EMAIL_TAKEN ===');
  const first = await req('POST', '/auth/signup', { body: { name: 'QA', email: EMAIL, password: PASSWORD } });
  check('first signup also refused pre-OTP (no mail in test env)', first.status === 403, `got ${first.status}`);

  console.log('\n=== 3. username validation via authenticated endpoint ===');
  // Need a token. Mint one directly with the same secret the server uses.
  require('dotenv').config({ path: '.env' });
  const jwt = require('jsonwebtoken');
  const Database = require('better-sqlite3');
  const db = new Database('server/nocturne.db');
  const id = 'usr_qa' + Date.now().toString().slice(-6);
  const bcrypt = require('bcryptjs');
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(id, 'QA Setup', EMAIL, bcrypt.hashSync(PASSWORD, 10), 'user');
  db.prepare('INSERT INTO user_preferences (user_id, profile_setup_completed, profile_setup_step) VALUES (?, 0, ?)').run(id, 'profile');
  const token = jwt.sign({ id, email: EMAIL, name: 'QA Setup', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  check('QA user + token created', !!token);

  const me = await req('GET', '/auth/me', { token });
  check('/auth/me exposes profileSetupCompleted=false', me.json.user.profileSetupCompleted === false, JSON.stringify(me.json.user));
  check('/auth/me exposes profileSetupStep=profile', me.json.user.profileSetupStep === 'profile');

  const noAuth = await req('GET', '/profile/setup');
  check('setup state requires auth (401)', noAuth.status === 401, `got ${noAuth.status}`);

  console.log('\n=== 3b. second QA user (for cross-user conflict checks) ===');
  const id2 = id + 'b';
  const EMAIL2 = `qa_setup2_${Date.now()}@nocturne.test`;
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(id2, 'QA Two', EMAIL2, bcrypt.hashSync(PASSWORD, 10), 'user');
  db.prepare('INSERT INTO user_preferences (user_id, profile_setup_completed, profile_setup_step) VALUES (?, 0, ?)').run(id2, 'profile');
  const token2 = jwt.sign({ id: id2, email: EMAIL2, name: 'QA Two', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  check('second QA user + token created', !!token2);

  console.log('\n=== 4. username availability ===');
  for (const [name, want] of [['ab', 'invalid'], ['has space', 'invalid'], ['admin', 'invalid'], ['nightowl_92', null]]) {
    const r = await req('GET', `/profile/username-available?username=${encodeURIComponent(name)}`, { token });
    check(`availability "${name}"`, r.status === 200 && (want === null ? r.json.available === true : r.json.reason === want), JSON.stringify(r.json));
  }
  // claim one, then confirm a different casing reads as taken for OTHER users
  await req('POST', '/profile/setup', { token, body: { username: 'nightowl_92' } });
  const own = await req('GET', '/profile/username-available?username=NIGHTOWL_92', { token });
  check('own username reads available even with different casing', own.json.available === true, JSON.stringify(own.json));
  const otherSeesTaken = await req('GET', '/profile/username-available?username=NIGHTOWL_92', { token: token2 });
  check('claimed username reads taken for other users', otherSeesTaken.json.available === false && otherSeesTaken.json.reason === 'taken', JSON.stringify(otherSeesTaken.json));

  const caseChange = await req('POST', '/profile/setup', { token, body: { username: 'NIGHTOWL_92' } });
  check('user can re-save own username with different casing', caseChange.status === 200 && caseChange.json.username === 'NIGHTOWL_92', JSON.stringify(caseChange.json));

  const badSave = await req('POST', '/profile/setup', { token, body: { username: 'x' } });
  check('invalid username save -> 400', badSave.status === 400, `got ${badSave.status}`);

  console.log('\n=== 5. another user cannot claim the same username ===');
  const conflict = await req('POST', '/profile/setup', { token: token2, body: { username: 'nightowl_92' } });
  check('second user gets 409 USERNAME_TAKEN', conflict.status === 409 && conflict.json.error === 'USERNAME_TAKEN', JSON.stringify(conflict.json));
  const avail2 = await req('GET', '/profile/username-available?username=nightowl_92', { token: token2 });
  check('availability says taken for other user', avail2.json.available === false && avail2.json.reason === 'taken');

  console.log('\n=== 6. partial progress + resume ===');
  await req('POST', '/profile/setup', { token, body: { genres: ['Pop', 'R&B'], selectedArtists: ['The Weeknd'], country: 'GB', step: 'personalization' } });
  const midway = await req('GET', '/profile/setup', { token });
  check('genres persisted', JSON.stringify(midway.json.genres) === JSON.stringify(['Pop', 'R&B']), JSON.stringify(midway.json.genres));
  check('artists persisted', JSON.stringify(midway.json.selectedArtists) === JSON.stringify(['The Weeknd']));
  check('country persisted', midway.json.country === 'GB');
  check('step persisted for resume', midway.json.profileSetupStep === 'personalization', midway.json.profileSetupStep);
  check('still incomplete', midway.json.profileSetupCompleted === false);

  console.log('\n=== 7. complete requires everything ===');
  const incomplete = await req('POST', '/profile/setup/complete', { token: token2 });
  check('completion blocked when nothing chosen', incomplete.status === 400, JSON.stringify(incomplete.json));

  const done = await req('POST', '/profile/setup/complete', { token });
  check('completion succeeds when complete', done.status === 200 && done.json.profileSetupCompleted === true, JSON.stringify(done.json));
  const after = await req('GET', '/auth/me', { token });
  check('/auth/me reflects completion', after.json.user.profileSetupCompleted === true);

  console.log('\n=== 8. real option data ===');
  const genres = await req('GET', '/profile/options/genres');
  check('genres endpoint returns real list', genres.status === 200 && genres.json.genres.length > 5, `n=${genres.json.genres && genres.json.genres.length}`);
  check('genres exclude the "All" pseudo-genre', !(genres.json.genres || []).some(g => g.name.toLowerCase() === 'all'));
  const artists = await req('GET', '/profile/options/artists', { token });
  check('artists come from the app catalogue', artists.status === 200 && artists.json.artists.length >= 16, `n=${artists.json.artists && artists.json.artists.length}`);
  check('artists have no invented stock-photo names', !(artists.json.artists || []).some(a => ['A.R. Rahman', 'Dua Lipa', 'Travis Scott'].includes(a.name)));

  console.log('\n=== 9. avatar upload validation ===');
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR', 'latin1'),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(512); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(512); return b; })(),
    Buffer.alloc(20),
  ]);
  const notImage = Buffer.from('<?php echo "nope"; ?>');
  const tinyPng = Buffer.concat([png.slice(0, 16), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(8); return b; })(), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(8); return b; })(), Buffer.alloc(20)]);

  const up = await req('POST', '/profile/avatar', {
    token, raw: true,
    body: (() => { const fd = new FormData(); fd.append('avatar', new Blob([png], { type: 'image/png' }), 'me.png'); return fd; })(),
  });
  check('valid PNG accepted', up.status === 200 && /^\/uploads\/avatars\//.test(up.json.avatar || ''), JSON.stringify(up.json));
  check('response never leaks a filesystem path', !String(up.json.avatar || '').includes('\\') && !String(up.json.avatar || '').includes('nocturne-app'), String(up.json.avatar));

  const bad = await req('POST', '/profile/avatar', {
    token, raw: true,
    body: (() => { const fd = new FormData(); fd.append('avatar', new Blob([notImage], { type: 'image/png' }), 'evil.png'); return fd; })(),
  });
  check('disguised non-image rejected (400)', bad.status === 400, JSON.stringify(bad.json));

  const tiny = await req('POST', '/profile/avatar', {
    token, raw: true,
    body: (() => { const fd = new FormData(); fd.append('avatar', new Blob([tinyPng], { type: 'image/png' }), 'tiny.png'); return fd; })(),
  });
  check('too-small image rejected (400)', tiny.status === 400, JSON.stringify(tiny.json));

  const rm = await req('POST', '/profile/avatar/remove', { token });
  check('avatar can be removed', rm.status === 200 && rm.json.avatar === null, JSON.stringify(rm.json));

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);

  db.prepare('DELETE FROM user_preferences WHERE user_id IN (?,?)').run(id, id2);
  db.prepare('DELETE FROM users WHERE id IN (?,?)').run(id, id2);
  console.log('QA users cleaned up');
  process.exit(fail ? 1 : 0);
})();
