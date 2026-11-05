// OTP email delivery behaviour.
//
// These tests pin down the security-critical contract of /api/auth/otp/generate:
//   - an OTP value must never appear in the response outside an explicitly
//     enabled, non-production dev bypass;
//   - a successful send returns a generic success payload;
//   - a failed send returns a safe error and never exposes the code;
//   - the code is single-use and short-lived.
//
// `nodemailer` is mocked so no real email is ever sent from the test suite.

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only-32chars!!';

// Patch nodemailer's createTransport before the auth route is loaded so the
// suite never opens a real SMTP connection. `sendMail` is swappable per test.
const nodemailer = require('nodemailer');
let sendMailImpl = () => Promise.resolve({ accepted: ['x'] });
nodemailer.createTransport = () => ({
  sendMail: (opts) => sendMailImpl(opts),
});
const setSendMail = (impl) => { sendMailImpl = impl; };

const { createApp } = require('./setup.cjs');
const db = require('../server/db.cjs');

let app;

beforeAll(() => {
  const result = createApp();
  app = result.app;
});

beforeEach(() => {
  setSendMail(() => Promise.resolve({ accepted: ['x'] }));
  process.env.GMAIL_USER = 'test-sender@example.com';
  process.env.GMAIL_APP_PASSWORD = 'test-app-password';
  process.env.NODE_ENV = 'test';
  delete process.env.ALLOW_OTP_DEV_CODE;
  db.prepare('DELETE FROM otp_codes').run();
  db.prepare("DELETE FROM users WHERE email LIKE 'otp-test-%'").run();
  // The per-IP rate limiters are shared across the suite and would otherwise
  // throttle later tests. Reset their in-memory stores before each test.
  const limiters = require('../server/middleware/rateLimit.cjs');
  for (const limiter of Object.values(limiters)) {
    if (typeof limiter.resetKey === 'function') limiter.resetKey('::ffff:127.0.0.1');
    if (typeof limiter.resetKey === 'function') limiter.resetKey('127.0.0.1');
  }
});

const uniqueEmail = () => `otp-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

describe('OTP email - success path', () => {
  it('sends to the exact submitted address and returns a generic success', async () => {
    const email = uniqueEmail();
    let sentTo = null;
    setSendMail((opts) => { sentTo = opts.to; return Promise.resolve({ accepted: [email] }); });

    const res = await request(app)
      .post('/api/auth/otp/generate')
      .send({ email, purpose: 'signup' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sentTo).toBe(email);
  });

  it('never includes the OTP in the response', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/otp/generate')
      .send({ email, purpose: 'signup' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('devCode');
    const body = JSON.stringify(res.body);
    const row = db.prepare('SELECT code FROM otp_codes WHERE email = ?').get(email);
    // The stored value is a hash; the plaintext must not appear anywhere.
    expect(body).not.toMatch(/\b\d{6}\b/);
    expect(row).toBeTruthy();
    expect(row.code).not.toMatch(/^\d{6}$/);
  });

  it('uses a clear, purpose-appropriate subject', async () => {
    const email = uniqueEmail();
    let subject = null;
    setSendMail((opts) => { subject = opts.subject; return Promise.resolve({}); });

    await request(app).post('/api/auth/otp/generate').send({ email, purpose: 'signup' });
    expect(subject).toMatch(/verification code/i);

    // Reset only sends mail for an account that exists (no account enumeration).
    const bcrypt = require('bcryptjs');
    const resetEmail = uniqueEmail();
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run('usr_otp_reset', 'Reset User', resetEmail, bcrypt.hashSync('password123', 10), 'user');
    await request(app).post('/api/auth/otp/generate').send({ email: resetEmail, purpose: 'reset' });
    expect(subject).toMatch(/password reset/i);
    db.prepare('DELETE FROM users WHERE email = ?').run(resetEmail);
  });
});

describe('OTP email - failure path', () => {
  it('returns a safe error when delivery fails and exposes no OTP', async () => {
    const email = uniqueEmail();
    setSendMail(() => Promise.reject(new Error('SMTP connection refused')));

    const res = await request(app)
      .post('/api/auth/otp/generate')
      .send({ email, purpose: 'signup' });

    expect(res.status).toBe(502);
    expect(res.body).not.toHaveProperty('devCode');
    expect(JSON.stringify(res.body)).not.toMatch(/\b\d{6}\b/);
    // The undelivered code must not linger as a usable/active record.
    const row = db.prepare("SELECT * FROM otp_codes WHERE email = ? AND purpose = 'signup'").get(email);
    expect(row).toBeUndefined();
  });

  it('allows an immediate retry after a failed send (no stuck cooldown)', async () => {
    const email = uniqueEmail();
    setSendMail(() => Promise.reject(new Error('temporary failure')));

    const first = await request(app).post('/api/auth/otp/generate').send({ email, purpose: 'signup' });
    expect(first.status).toBe(502);

    // Second attempt must not be rate-limited by the failed attempt.
    setSendMail(() => Promise.resolve({}));
    const second = await request(app).post('/api/auth/otp/generate').send({ email, purpose: 'signup' });
    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);
  });

  it('fails safely when SMTP is not configured in production', async () => {
    const email = uniqueEmail();
    const prevUser = process.env.GMAIL_USER;
    const prevPass = process.env.GMAIL_APP_PASSWORD;
    const prevEnv = process.env.NODE_ENV;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'production';

    try {
      const res = await request(app).post('/api/auth/otp/generate').send({ email, purpose: 'signup' });
      expect(res.status).toBe(502);
      expect(res.body).not.toHaveProperty('devCode');
    } finally {
      process.env.GMAIL_USER = prevUser;
      process.env.GMAIL_APP_PASSWORD = prevPass;
      process.env.NODE_ENV = prevEnv;
    }
  });
});

describe('OTP email - dev bypass safety', () => {
  it('never returns devCode in production even if ALLOW_OTP_DEV_CODE=1', async () => {
    const email = uniqueEmail();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_OTP_DEV_CODE = '1';

    try {
      const res = await request(app).post('/api/auth/otp/generate').send({ email, purpose: 'signup' });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('devCode');
    } finally {
      process.env.NODE_ENV = prevEnv;
      delete process.env.ALLOW_OTP_DEV_CODE;
    }
  });
});

describe('OTP verification - single use and expiry', () => {
  const seedOtp = (email, purpose, { code = '123456', expiresAt, verified = 0, attempts = 0 } = {}) => {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    db.prepare('INSERT INTO otp_codes (email, code, expires_at, purpose, verified, attempts) VALUES (?, ?, ?, ?, ?, ?)')
      .run(email, hash, expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(), purpose, verified, attempts);
    return code;
  };

  it('accepts a valid code once and rejects the reuse', async () => {
    const email = uniqueEmail();
    seedOtp(email, 'signup', { code: '111111' });

    const ok = await request(app).post('/api/auth/otp/verify').send({ email, code: '111111', purpose: 'signup' });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);

    const reuse = await request(app).post('/api/auth/otp/verify').send({ email, code: '111111', purpose: 'signup' });
    expect(reuse.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    const email = uniqueEmail();
    seedOtp(email, 'signup', { code: '222222', expiresAt: new Date(Date.now() - 1000).toISOString() });

    const res = await request(app).post('/api/auth/otp/verify').send({ email, code: '222222', purpose: 'signup' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const email = uniqueEmail();
    seedOtp(email, 'signup', { code: '333333' });

    const res = await request(app).post('/api/auth/otp/verify').send({ email, code: '999999', purpose: 'signup' });
    expect(res.status).toBe(400);
    const row = db.prepare("SELECT attempts FROM otp_codes WHERE email = ? AND purpose = 'signup'").get(email);
    expect(row.attempts).toBe(1);
  });
});

describe('OTP email - signin flow uses custom JWT (no leak)', () => {
  it('pendingToken is a JWT with purpose=signin and no code is returned', async () => {
    const email = uniqueEmail();
    // Create an account with a real password to sign in with.
    const bcrypt = require('bcryptjs');
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run('usr_otp_test', 'OTP Test', email, bcrypt.hashSync('password123', 10), 'user');

    const signin = await request(app).post('/api/auth/signin').send({ email, password: 'password123' });
    expect(signin.status).toBe(200);
    const decoded = jwt.decode(signin.body.pendingToken);
    expect(decoded.purpose).toBe('signin');

    const gen = await request(app)
      .post('/api/auth/otp/generate')
      .send({ email, purpose: 'signin', pendingToken: signin.body.pendingToken });
    expect(gen.status).toBe(200);
    expect(gen.body).not.toHaveProperty('devCode');

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });
});
