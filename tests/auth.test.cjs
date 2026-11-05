const request = require('supertest');
const { createApp } = require('./setup.cjs');

let app;

beforeAll(() => {
  const result = createApp();
  app = result.app;
});

describe('Auth - Registration', () => {
  it('should reject signup without OTP verification', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/verification required/i);
  });

  it('should reject signup with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '', email: '', password: '' });
    expect(res.status).toBe(400);
  });

  it('should reject signup with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test', email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('Auth - Sign In', () => {
  it('should reject signin with missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({});
    expect(res.status).toBe(400);
  });

  it('should reject signin with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'nonexistent@test.com', password: 'password' });
    expect(res.status).toBe(401);
  });
});

describe('Auth - OTP', () => {
  it('should reject invalid email for OTP', async () => {
    const res = await request(app)
      .post('/api/auth/otp/generate')
      .send({ email: 'bad-email' });
    expect(res.status).toBe(400);
  });

  it('should reject OTP verification with wrong code', async () => {
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'test@example.com', code: '000000', purpose: 'signup' });
    expect(res.status).toBe(400);
  });

  it('should reject OTP verification with non-6-digit code', async () => {
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'test@example.com', code: '123', purpose: 'signup' });
    expect(res.status).toBe(400);
  });
});

describe('Health', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
