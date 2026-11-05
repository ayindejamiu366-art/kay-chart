const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth.cjs');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit.cjs');
const { validate, schemas } = require('../middleware/validate.cjs');
const { PROFILE_SETUP_LAUNCHED_AT, readProfileState, withProfileState, checkUsernameAvailable, normalizeCountry } = require('../profile.cjs');
const crypto = require('crypto');

const otpRate = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;

const nodemailer = require('nodemailer');

const isProductionEnv = () => process.env.NODE_ENV === 'production';

// The dev OTP bypass is only ever honored outside production. A truthy
// ALLOW_OTP_DEV_CODE in a production process must never cause an OTP to be
// returned to the client, so this is the single source of truth everywhere.
// Evaluated per call so it always reflects the live NODE_ENV.
const devOtpAllowed = () => !isProductionEnv() && process.env.ALLOW_OTP_DEV_CODE === '1';

// Build the transporter lazily so credentials are read at send time, not at
// module load, and so an unconfigured server never constructs a broken client.
let transporter = null;
let transporterKey = '';
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  if (!user || !pass) return null;
  const key = `${user}:${pass}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    transporterKey = key;
  }
  return transporter;
}

async function sendOtpEmail(email, code, purpose = 'signup') {
  const user = process.env.GMAIL_USER;
  const tx = getTransporter();
  if (!tx) {
    // No SMTP configured. Never fabricate success: in production this is a hard
    // failure; outside production we log the code to aid local testing.
    if (isProductionEnv()) throw new Error('Gmail SMTP is not configured');
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[KayChart] Development OTP for ${email}: ${code}`);
    }
    return;
  }
  // Sender name, subject and body are user-facing: these appear in a real inbox.
  const isReset = purpose === 'reset';
  const subject = isReset ? 'Your Kay Chart Password Reset Code' : 'Your Kay Chart Verification Code';
  const lead = isReset ? 'Your password reset code is:' : 'Your verification code is:';
  await tx.sendMail({
    from: `"Kay Chart" <${user}>`,
    to: email,
    subject,
    text: `Your ${isReset ? 'password reset' : 'verification'} code is ${code}. It expires in 5 minutes.`,
    html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;text-align:center">
      <h2 style="color:#1DB954">Kay Chart</h2>
      <p style="font-size:16px;color:#333">${lead}</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1DB954;padding:16px;background:#f5f5f5;border-radius:8px">${code}</div>
      <p style="font-size:14px;color:#666;margin-top:16px">This code expires in 5 minutes.</p>
    </div>`
  });
}

const router = express.Router();

// Onboarding shipped on this date. Accounts that already existed before it are
// treated as returning users and are never shown the first-time tour, even
// though they have never seen it. Shared with the profile-setup backfill in
// db.cjs so both gates flip on the same day.
//
// Compared as a string because SQLite stores `datetime('now')` as
// 'YYYY-MM-DD HH:MM:SS', which sorts correctly and avoids the timezone ambiguity
// of parsing that string as a JS Date.
if (typeof PROFILE_SETUP_LAUNCHED_AT !== 'string') {
  // Guards against a silent regression: comparing against undefined makes every
  // account look pre-existing, which would permanently suppress the tour and the
  // profile setup gate with no error anywhere.
  throw new Error('PROFILE_SETUP_LAUNCHED_AT is not exported by server/profile.cjs');
}
const ONBOARDING_LAUNCHED_AT = PROFILE_SETUP_LAUNCHED_AT;

function readOnboardingPrefs(user) {
  const row = db.prepare('SELECT onboarding_completed FROM user_preferences WHERE user_id = ?').get(user.id);
  return {
    onboardingCompleted: !!(row && row.onboarding_completed),
    onboardingEligible: !!(user.created_at && user.created_at >= ONBOARDING_LAUNCHED_AT),
    ...readProfileState(user.id),
  };
}

router.post('/signup', authLimiter, validate(schemas.authSignup), (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists', code: 'EMAIL_TAKEN' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const id = 'usr_' + uuidv4().slice(0, 8);
    const verification = db.prepare("SELECT * FROM otp_codes WHERE email = ? AND purpose = 'signup' AND verified = 1 AND expires_at > ? ORDER BY created_at DESC LIMIT 1").get(normalizedEmail, new Date().toISOString());
    if (!verification) return res.status(403).json({ error: 'Email verification required' });
    const requestedRole = role === 'artist' ? 'artist' : 'user';
    const userRole = requestedRole;

    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, name, normalizedEmail, hash, userRole);
    // A brand new account always starts profile setup from the first step.
    db.prepare('INSERT INTO user_preferences (user_id, profile_setup_completed, profile_setup_step) VALUES (?, 0, ?)').run(id, 'profile');
    db.prepare("DELETE FROM otp_codes WHERE email = ? AND purpose = 'signup'").run(normalizedEmail);

    const token = jwt.sign({ id, email, name, role: userRole }, JWT_SECRET, { expiresIn: '30d' });
    // A brand new account is always eligible and never already onboarded, so the
    // client can start the tour immediately without waiting for a /auth/me round
    // trip. This is what makes the tour work on the very first render after
    // signup while keeping the OTP flow and token handling untouched.
    res.json({
      token,
      user: withProfileState({
        id, name, email, role: userRole, avatar: null, genres: [], selectedArtists: [],
        onboardingCompleted: false, onboardingEligible: true,
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/signin', authLimiter, validate(schemas.authSignin), (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account was created with Google. Please use Google Sign-In or reset your password.' });
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const pendingToken = jwt.sign({ id: user.id, email: user.email, purpose: 'signin' }, JWT_SECRET, { expiresIn: '10m' });
    const genres = JSON.parse(user.genres || '[]');
    const selectedArtists = JSON.parse(user.selected_artists || '[]');

    res.json({
      pendingToken,
      user: withProfileState({ id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, genres, selectedArtists }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Firebase ID token verification (Google sign-in) ------------------------
// The web client signs in with Firebase Auth (Google provider) and forwards
// the resulting Firebase ID token here. The token is verified against
// Google's public Secure Token certificates, so the server needs no service
// account — only the Firebase project id, which it already has.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let firebaseCerts = null;
let firebaseCertsFetchedAt = 0;
const FIREBASE_CERTS_TTL_MS = 60 * 60 * 1000;

async function getFirebaseCerts() {
  if (firebaseCerts && Date.now() - firebaseCertsFetchedAt < FIREBASE_CERTS_TTL_MS) return firebaseCerts;
  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) throw new Error('Unable to fetch Firebase verification keys');
  firebaseCerts = await res.json();
  firebaseCertsFetchedAt = Date.now();
  return firebaseCerts;
}

async function verifyFirebaseIdToken(idToken) {
  if (!FIREBASE_PROJECT_ID) throw new Error('Firebase project is not configured');
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const { kid } = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const certs = await getFirebaseCerts();
  const cert = certs[kid];
  if (!cert) throw new Error('Unknown token signing key');
  return jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  });
}

router.post('/google', authLimiter, async (req, res) => {
  try {
    const credential = String(req.body.credential || '');
    if (!credential) return res.status(400).json({ error: 'Google credential required' });

    let email = '';
    let name = '';
    let avatar = null;
    let providerUid = '';

    // Preferred: a Firebase ID token from the Google popup flow.
    try {
      const payload = await verifyFirebaseIdToken(credential);
      email = String(payload.email || '').trim().toLowerCase();
      name = payload.name || payload.given_name || email.split('@')[0] || 'User';
      avatar = payload.picture || null;
      providerUid = payload.uid || payload.sub || '';
    } catch (fbErr) {
      // Fallback: a raw Google ID token (Google Identity Services credential)
      // verified against the configured web client id.
      if (!process.env.GOOGLE_CLIENT_ID) {
        console.error('[Auth] Google token verification failed:', fbErr.message);
        return res.status(401).json({ error: 'Invalid Google credential' });
      }
      const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!tokenRes.ok) return res.status(401).json({ error: 'Invalid Google credential' });
      const payload = await tokenRes.json();
      if (payload.aud !== process.env.GOOGLE_CLIENT_ID || payload.email_verified !== 'true' || !payload.email) {
        return res.status(401).json({ error: 'Google account could not be verified' });
      }
      email = payload.email.trim().toLowerCase();
      name = payload.name || payload.given_name || email.split('@')[0] || 'User';
      avatar = payload.picture || null;
      providerUid = payload.sub || '';
    }

    if (!email || !providerUid) {
      return res.status(401).json({ error: 'Google account could not be verified' });
    }

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const isNew = !user;

    if (!user) {
      const id = 'usr_' + uuidv4().slice(0, 8);
      db.prepare('INSERT INTO users (id, name, email, role, avatar, google_id, firebase_uid) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, email, 'user', avatar, providerUid, providerUid);
      // A brand new account always starts profile setup from the first step,
      // same as the OTP signup flow.
      db.prepare('INSERT INTO user_preferences (user_id, profile_setup_completed, profile_setup_step) VALUES (?, 0, ?)').run(id, 'profile');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else if (!user.firebase_uid) {
      db.prepare('UPDATE users SET firebase_uid = ?, google_id = COALESCE(google_id, ?) WHERE id = ?')
        .run(providerUid, providerUid, user.id);
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    const genres = JSON.parse(user.genres || '[]');
    const selectedArtists = JSON.parse(user.selected_artists || '[]');
    res.json({
      token,
      isNew,
      user: withProfileState({ id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, genres, selectedArtists }),
    });
  } catch (err) {
    console.error('[Auth] Google sign-in failed:', err.message);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

router.post('/otp/generate', otpLimiter, validate(schemas.otpGenerate), async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const purpose = ['signin', 'reset'].includes(req.body.purpose) ? req.body.purpose : 'signup';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
    if (purpose === 'signin') {
      try {
        const pending = jwt.verify(String(req.body.pendingToken || ''), JWT_SECRET);
        if (pending.purpose !== 'signin' || pending.email !== email || !db.prepare('SELECT id FROM users WHERE id = ? AND email = ?').get(pending.id, email)) {
          return res.status(401).json({ error: 'Invalid sign-in session' });
        }
      } catch (_) { return res.status(401).json({ error: 'Sign-in session expired' }); }
    }
    if (purpose === 'reset') {
      // Never disclose whether an email is registered: reply with the same
      // shape as a successful send even when no account exists, and skip the
      // email entirely in that case.
      const account = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
      if (!account) return res.json({ success: true, emailConfigured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) });
    }
    const now = Date.now();
    const rateKey = `${email}:${purpose}`;
    if (otpRate.has(rateKey) && now - otpRate.get(rateKey) < OTP_RESEND_MS) {
      return res.status(429).json({ error: 'Please wait before requesting another code' });
    }
    otpRate.set(rateKey, now);
    db.prepare('DELETE FROM otp_codes WHERE email = ? AND purpose = ?').run(email, purpose);
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
    db.prepare('INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES (?, ?, ?, ?)').run(email, codeHash, expiresAt, purpose);
    const emailConfigured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
    try {
      await sendOtpEmail(email, code, purpose);
    } catch (err) {
      // Delivery failed. Roll back the just-created code and the rate-limit
      // marker so the user can retry immediately instead of being stuck behind
      // a 60s cooldown while holding a code that was never delivered. The code
      // is never returned to the client here, in any environment.
      db.prepare('DELETE FROM otp_codes WHERE email = ? AND purpose = ?').run(email, purpose);
      otpRate.delete(rateKey);
      console.error('[Auth] Failed to send verification email:', err.message);
      return res.status(502).json({ error: 'Failed to send verification email' });
    }
    const response = { success: true, emailConfigured };
    // Only reachable outside production (see devOtpAllowed definition).
    if (devOtpAllowed()) {
      response.devCode = code;
      response.expiresAt = expiresAt;
    }
    return res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/otp/verify', authLimiter, validate(schemas.otpVerify), (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const purpose = ['signin', 'reset'].includes(req.body.purpose) ? req.body.purpose : 'signup';
    const code = String(req.body.code || '').trim();
    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Email and 6-digit code required' });
    const otp = db.prepare('SELECT rowid AS id, * FROM otp_codes WHERE email = ? AND purpose = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1').get(email, purpose);
    if (!otp) return res.status(400).json({ error: 'No active OTP found' });
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);
      return res.status(400).json({ error: 'OTP expired' });
    }
    if (otp.attempts >= 5) return res.status(400).json({ error: 'Too many attempts' });
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(otp.code), Buffer.from(hash))) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ? AND verified = 0').run(email, purpose);
      return res.status(400).json({ error: 'Invalid code' });
    }
    db.prepare('UPDATE otp_codes SET verified = 1 WHERE email = ? AND purpose = ? AND verified = 0').run(email, purpose);
    if (purpose === 'signin') {
      const pendingToken = String(req.body.pendingToken || '');
      let pending;
      try { pending = jwt.verify(pendingToken, JWT_SECRET); } catch (_) { return res.status(401).json({ error: 'Sign-in session expired' }); }
      if (pending.purpose !== 'signin' || pending.email !== email) return res.status(401).json({ error: 'Invalid sign-in session' });
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND email = ?').get(pending.id, email);
      if (!user) return res.status(401).json({ error: 'User not found' });
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ success: true, token, user: withProfileState({ id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, genres: JSON.parse(user.genres || '[]'), selectedArtists: JSON.parse(user.selected_artists || '[]') }) });
    }
    if (purpose === 'reset') {
      // Hand back a short-lived, single-purpose token instead of a session so
      // the client can only set a new password, never call authenticated APIs.
      // `jti` pins the token to this specific verified OTP row so /confirm can
      // mark it consumed and reject any replay of the same token.
      const resetToken = jwt.sign({ email, purpose: 'password_reset', jti: String(otp.id) }, JWT_SECRET, { expiresIn: '15m' });
      return res.json({ success: true, resetToken });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// Completes a password reset started via the `reset` OTP flow. The caller
// proves ownership of the email with the short-lived resetToken issued by
// /auth/otp/verify, then chooses a new password. This also works for accounts
// created with Google, which gain email/password sign-in as a result.
router.post('/password-reset/confirm', authLimiter, validate(schemas.passwordResetConfirm), (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    let payload;
    try {
      payload = jwt.verify(resetToken, JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ error: 'Reset link expired. Please start again.' });
    }
    if (payload.purpose !== 'password_reset' || !payload.email || !payload.jti) {
      return res.status(401).json({ error: 'Invalid reset token' });
    }
    // The token is single-use: `jti` points at the OTP row that was verified for
    // this reset. Consuming it (verified = 2) means a replayed token finds no
    // matching row and is rejected.
    const otpRow = db.prepare("SELECT rowid FROM otp_codes WHERE rowid = ? AND purpose = 'reset' AND verified = 1").get(Number(payload.jti));
    if (!otpRow) {
      return res.status(401).json({ error: 'This reset link has already been used. Please start again.' });
    }
    const email = String(payload.email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    if (!user) return res.status(404).json({ error: 'No account found for this email' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    // Consume the verified reset OTP (single-use) and clear any leftover ones.
    db.prepare('UPDATE otp_codes SET verified = 2 WHERE rowid = ?').run(Number(payload.jti));
    db.prepare("DELETE FROM otp_codes WHERE LOWER(email) = ? AND purpose = 'reset'").run(email);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/update-profile', authMiddleware, (req, res) => {
  try {
    const { name, avatar, genres, selectedArtists, username, country } = req.body;

    if (username !== undefined) {
      // Re-saving the caller's own username must not conflict with their own row.
      const me = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
      const result = checkUsernameAvailable(username, me ? me.username : null);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, code: result.error === 'USERNAME_TAKEN' ? 'USERNAME_TAKEN' : undefined });
      }
      db.prepare('UPDATE users SET username = ?, username_normalized = ? WHERE id = ?')
        .run(result.username, result.normalized, req.user.id);
    }
    if (country !== undefined) {
      const result = normalizeCountry(country);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      db.prepare('UPDATE users SET country = ? WHERE id = ?').run(result.country, req.user.id);
    }
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
    if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
    if (genres) db.prepare('UPDATE users SET genres = ? WHERE id = ?').run(JSON.stringify(genres), req.user.id);
    if (selectedArtists) db.prepare('UPDATE users SET selected_artists = ? WHERE id = ?').run(JSON.stringify(selectedArtists), req.user.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({
      user: withProfileState({
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        genres: JSON.parse(user.genres || '[]'),
        selectedArtists: JSON.parse(user.selected_artists || '[]'),
      }),
    });
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'USERNAME_TAKEN', code: 'USERNAME_TAKEN' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/update-role', authMiddleware, (req, res) => {
  try {
    const { userId, role } = req.body;
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (!['user', 'artist', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (userId === req.user.id && role !== 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
      if (adminCount <= 1) return res.status(400).json({ error: 'Cannot remove the last administrator' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user.password_hash) return res.status(400).json({ error: 'Google accounts cannot change password' });
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/update-avatar', authMiddleware, (req, res) => {
  try {
    const { avatar } = req.body;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar || null, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({
      user: withProfileState({
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        genres: JSON.parse(user.genres || '[]'),
        selectedArtists: JSON.parse(user.selected_artists || '[]'),
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users/stats', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const liked = db.prepare('SELECT COUNT(*) as c FROM liked_songs WHERE user_id = ?').get(req.user.id).c;
    const playlists = db.prepare('SELECT COUNT(*) as c FROM playlists WHERE user_id = ?').get(req.user.id).c;
    const downloads = db.prepare('SELECT COUNT(*) as c FROM downloads WHERE user_id = ?').get(req.user.id).c;
    const plays = db.prepare('SELECT COUNT(*) as c FROM play_history WHERE user_id = ?').get(req.user.id).c;
    const memberSince = user.created_at;
    res.json({ liked, playlists, downloads, plays, memberSince });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const users = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC').all();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        genres: JSON.parse(user.genres || '[]'),
        selectedArtists: JSON.parse(user.selected_artists || '[]'),
        createdAt: user.created_at,
        ...readOnboardingPrefs(user)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Persist first-time onboarding completion. Stored server-side so the tour does
// not reappear for a returning user on a different browser or device, which a
// localStorage flag alone could not guarantee.
router.post('/onboarding', authMiddleware, (req, res) => {
  try {
    const completed = req.body?.completed === false ? 0 : 1;
    const result = db.prepare(
      'UPDATE user_preferences SET onboarding_completed = ? WHERE user_id = ?'
    ).run(completed, req.user.id);
    if (!result.changes) {
      // Preferences row is missing (e.g. a user created before it was seeded).
      db.prepare('INSERT OR IGNORE INTO user_preferences (user_id, onboarding_completed) VALUES (?, ?)').run(req.user.id, completed);
    }
    res.json({ ok: true, onboardingCompleted: !!completed });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
