const request = require('supertest');
const { createApp } = require('./setup.cjs');

let app;

beforeAll(() => {
  const result = createApp();
  app = result.app;
});

describe('Validation', () => {
  it('should reject signup with invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test', email: 'not-valid', password: '123456' });
    expect(res.status).toBe(400);
  });

  it('should reject signup with short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test', email: 'test@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('should reject OTP verify with non-6-digit code', async () => {
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'test@example.com', code: '12345', purpose: 'signup' });
    expect(res.status).toBe(400);
  });

  it('should reject OTP verify with non-numeric code', async () => {
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'test@example.com', code: 'abcdef', purpose: 'signup' });
    expect(res.status).toBe(400);
  });

  it('should reject signup with missing name', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '', email: 'test@example.com', password: '123456' });
    expect(res.status).toBe(400);
  });

  it('should reject signin with invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'bad-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('should reject OTP generate with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/otp/generate')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('should reject events/play without provider', async () => {
    const res = await request(app)
      .post('/api/events/play')
      .send({ trackId: 'track1' });
    expect(res.status).toBe(400);
  });

  it('should reject events/play without trackId', async () => {
    const res = await request(app)
      .post('/api/events/play')
      .send({ provider: 'deezer' });
    expect(res.status).toBe(400);
  });

  it('should reject events/skip without required fields', async () => {
    const res = await request(app)
      .post('/api/events/skip')
      .send({});
    expect(res.status).toBe(400);
  });
});
