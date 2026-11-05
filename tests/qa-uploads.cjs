/**
 * Live upload checks against the running server.
 *
 * The multer upgrade (2.3.x -> 2.4.0) plus the new parts/fields limits and
 * cover sniffing all sit on these two paths, so they are exercised end to end
 * rather than assumed to work: a valid avatar, an oversized avatar, a
 * non-image disguised as one, and a song upload with and without a cover.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env before anything that reads configuration, mirroring tests/setup.cjs.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!';
}

const API = process.env.QA_API_URL || 'http://localhost:3001';
const JWT_SECRET = require(path.join(__dirname, '..', 'server', 'middleware', 'auth.cjs')).JWT_SECRET;
const db = require(path.join(__dirname, '..', 'server', 'db.cjs'));
const jwt = require('jsonwebtoken');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`);
}

/**
 * Build a valid solid-colour PNG of a given size.
 *
 * A 1x1 PNG is not a valid avatar here — the server enforces a 64x64 minimum —
 * so the fixtures are generated rather than pasted as base64.
 */
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  // Raw scanlines: each row is a filter byte (0) plus RGB triples.
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) {
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = 0x4c;      // R - Nocturne lime
      row[2 + x * 3] = 0xa3;      // G
      row[3 + x * 3] = 0xff;      // B
    }
    row.copy(raw, y * row.length);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', require('zlib').deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG_1x1 = makePng(64, 64);
const AVATAR_MIN_DIMENSION = 64;

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
}

/** Minimal multipart/form-data body builder. */
function multipart(parts) {
  const boundary = '----nocturne' + Math.random().toString(36).slice(2, 10);
  const chunks = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (p.filename !== undefined) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n` +
        `Content-Type: ${p.contentType || 'application/octet-stream'}\r\n\r\n`
      ));
      chunks.push(p.data);
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.data}\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function post(pathname, { token, parts }) {
  return new Promise((resolve, reject) => {
    const { body, contentType } = multipart(parts);
    const url = new URL(API + pathname);
    const headers = { 'Content-Type': contentType, 'Content-Length': body.length };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: 'POST', headers },
      (res) => {
        const out = [];
        res.on('data', (c) => out.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(out).toString('utf8') }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

(async () => {
  // Find an admin (can self-approve) and a plain user.
  const admin = db.prepare("SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1").get();
  const artist = db.prepare("SELECT id, email, name FROM users WHERE role = 'artist' OR role = 'admin' LIMIT 1").get();
  if (!admin) { console.log('SKIP: no admin user in the database to exercise uploads'); process.exit(0); }
  const adminToken = tokenFor(admin);

  // --- 1. valid avatar accepted -------------------------------------------
  const good = await post('/api/profile/avatar', {
    token: adminToken,
    parts: [{ name: 'avatar', filename: 'me.png', contentType: 'image/png', data: PNG_1x1 }],
  });
  let avatarOk = false, avatarNote = good.body.slice(0, 120);
  try { avatarOk = JSON.parse(good.body).avatar_url || JSON.parse(good.body).avatar; } catch { /* non-JSON */ }
  check('valid PNG avatar accepted', good.status === 200 && !!avatarOk,
    `status ${good.status}; ${avatarNote}`);

  // --- 2. non-image disguised as .png rejected -----------------------------
  const disguised = await post('/api/profile/avatar', {
    token: adminToken,
    parts: [{ name: 'avatar', filename: 'evil.png', contentType: 'image/png', data: Buffer.from('<script>alert(1)</script>'.repeat(4)) }],
  });
  check('non-image disguised as .png rejected', disguised.status >= 400,
    `status ${disguised.status}; ${disguised.body.slice(0, 100)}`);

  // --- 3. oversized avatar rejected ---------------------------------------
  const big = Buffer.alloc(6 * 1024 * 1024, 0x41);
  PNG_1x1.copy(big, 0); // keep a valid signature so size is what fails
  const oversize = await post('/api/profile/avatar', {
    token: adminToken,
    parts: [{ name: 'avatar', filename: 'big.png', contentType: 'image/png', data: big }],
  });
  check('oversized avatar (>5MB) rejected', oversize.status >= 400,
    `status ${oversize.status}; ${oversize.body.slice(0, 100)}`);

  // --- 4. too many fields (parts limit) -----------------------------------
  const manyFields = [{ name: 'avatar', filename: 'me.png', contentType: 'image/png', data: PNG_1x1 }];
  for (let i = 0; i < 40; i++) manyFields.push({ name: `f${i}`, data: 'x' });
  const flooded = await post('/api/profile/avatar', { token: adminToken, parts: manyFields });
  check('multipart field flood rejected by parts/fields limit', flooded.status >= 400,
    `status ${flooded.status}; ${flooded.body.slice(0, 100)}`);

  // --- 5. song upload with audio only -------------------------------------
  const songToken = (artist && artist.id !== admin.id) ? tokenFor(artist) : adminToken;
  const audio = Buffer.alloc(2048, 0x00);
  Buffer.from('ID3').copy(audio, 0);
  const songNoCover = await post('/api/songs', {
    token: songToken,
    parts: [
      { name: 'title', data: `QA Upload ${Date.now()}` },
      { name: 'albumName', data: 'QA Album' },
      { name: 'duration', data: '180' },
      { name: 'mood', data: 'chill' },
      { name: 'genre', data: 'Pop' },
      { name: 'audio', filename: 'track.mp3', contentType: 'audio/mpeg', data: audio },
    ],
  });
  let songCreated = false, songId = null;
  try { const j = JSON.parse(songNoCover.body); songId = j.song && j.song.id; songCreated = !!songId; } catch { /* */ }
  check('song upload with audio only accepted', songNoCover.status === 200 && songCreated,
    `status ${songNoCover.status}; id=${songId}; ${songNoCover.body.slice(0, 120)}`);

  // --- 6. song upload with a real cover ------------------------------------
  const songWithCover = await post('/api/songs', {
    token: songToken,
    parts: [
      { name: 'title', data: `QA Upload Cover ${Date.now()}` },
      { name: 'duration', data: '200' },
      { name: 'genre', data: 'Pop' },
      { name: 'audio', filename: 'track2.mp3', contentType: 'audio/mpeg', data: audio },
      { name: 'cover', filename: 'cover.png', contentType: 'image/png', data: PNG_1x1 },
    ],
  });
  let coverOk = false, coverSongId = null;
  try { const j = JSON.parse(songWithCover.body); coverSongId = j.song && j.song.id; coverOk = !!j.song; } catch { /* */ }
  check('song upload with valid cover accepted', songWithCover.status === 200 && coverOk,
    `status ${songWithCover.status}; id=${coverSongId}; ${songWithCover.body.slice(0, 120)}`);

  // --- 7. song cover that is not an image rejected -------------------------
  const badCover = await post('/api/songs', {
    token: songToken,
    parts: [
      { name: 'title', data: `QA Bad Cover ${Date.now()}` },
      { name: 'genre', data: 'Pop' },
      { name: 'audio', filename: 'track3.mp3', contentType: 'audio/mpeg', data: audio },
      { name: 'cover', filename: 'cover.png', contentType: 'image/png', data: Buffer.from('MZ not an image at all') },
    ],
  });
  check('song cover that is not an image rejected', badCover.status >= 400,
    `status ${badCover.status}; ${badCover.body.slice(0, 100)}`);

  // --- cleanup: remove the QA rows we created ------------------------------
  for (const id of [songId, coverSongId]) {
    if (!id) continue;
    const row = db.prepare('SELECT cover, audio_url FROM songs WHERE id = ?').get(id);
    db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    for (const p of [row && row.cover, row && row.audio_url]) {
      if (!p) continue;
      const abs = path.join(__dirname, '..', 'server', p);
      try { fs.unlinkSync(abs); } catch { /* already gone */ }
    }
  }
  console.log(`\ncleaned up QA song rows: ${[songId, coverSongId].filter(Boolean).join(', ') || 'none'}`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length} passed, ${failed.length} failed ===`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('upload check crashed:', e); process.exit(1); });