const request = require('supertest');
const { createApp } = require('./setup.cjs');
const { installOfflineMusic, OFFLINE_TRACKS } = require('./offline-music.cjs');

let app;
let restoreMusic;

beforeAll(() => {
  // Provider-backed routes are served deterministic fixtures so these tests
  // assert on our code rather than on Spotify/Deezer/Audius being reachable.
  // Without this the suite failed intermittently on 429s and upstream timeouts.
  restoreMusic = installOfflineMusic();
  const result = createApp();
  app = result.app;
});

afterAll(() => {
  if (restoreMusic) restoreMusic();
});

describe('Music - Home', () => {
  it('should return home page data', async () => {
    const res = await request(app).get('/api/music/home');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('trending');
    expect(Array.isArray(res.body.trending)).toBe(true);
  });
});

describe('Music - Search', () => {
  it('should search tracks', async () => {
    const res = await request(app).get('/api/music/search/tracks?q=test&limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Charts', () => {
  it('should return chart data', async () => {
    const res = await request(app).get('/api/charts?type=global&key=top50').timeout(30000);
    expect(res.status).toBe(200);
  }, 30000);

  it('should report how each row resolved', async () => {
    // Partial responses are expected when a provider is slow, so the endpoint
    // must say what happened per row rather than silently returning fewer rows.
    const res = await request(app).get('/api/charts/internal/rising?limit=50').timeout(30000);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    for (const key of ['resolved', 'fromCache', 'timedOut', 'failed', 'skipped']) {
      expect(typeof res.body.meta[key]).toBe('number');
    }
  }, 30000);

  it('should return countries list', async () => {
    const res = await request(app).get('/api/charts/countries');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Stream', () => {
  it('should return 404 for non-existent local track', async () => {
    const res = await request(app).get('/api/stream/nonexistent_id');
    expect(res.status).toBe(404);
  });

  it('should return 400 for missing id', async () => {
    const res = await request(app).get('/api/stream/');
    expect([400, 404]).toContain(res.status);
  });
});

describe('Music - Trending', () => {
  it('should return trending tracks', async () => {
    const res = await request(app).get('/api/music/trending');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Music - Genres', () => {
  it('should return genres list', async () => {
    const res = await request(app).get('/api/music/genres');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Music - Offline fixtures', () => {
  it('serves tracks from the fixture set without contacting a provider', async () => {
    const res = await request(app).get('/api/music/trending');
    expect(res.status).toBe(200);
    const titles = res.body.data.map(t => t.title);
    expect(titles).toContain(OFFLINE_TRACKS[0].title);
  });

  it('filters search results from the fixture set', async () => {
    const res = await request(app).get('/api/music/search/tracks?q=signal');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every(t => /signal/i.test(t.title))).toBe(true);
  });
});

describe('Events', () => {
  it('should reject play event without required fields', async () => {
    const res = await request(app)
      .post('/api/events/play')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('should accept valid play event', async () => {
    const res = await request(app)
      .post('/api/events/play')
      .send({ trackId: 'test-track', provider: 'deezer' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Analytics', () => {
  it('should return play counts', async () => {
    const res = await request(app).get('/api/analytics/plays?songIds=s1,s2');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });
});
