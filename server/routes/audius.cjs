const express = require('express');
const router = express.Router();

const AUDIUS_BASE = 'https://api.audius.co';

// Simple in-memory cache (10s TTL)
const cache = new Map();
function cached(key, ttlMs, fn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
}

async function audiusFetch(path, params = {}) {
  const url = new URL(`/v1${path}`, AUDIUS_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NocturneMusic/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  return res.json();
}

function normalizeTrack(t) {
  if (!t) return null;
  const user = t.user || {};
  return {
    id: `audius_${t.id}`,
    title: t.title || 'Untitled',
    artistName: user.name || 'Unknown',
    artistId: user.id ? `audius_${user.id}` : null,
    artistHandle: user.handle || null,
    cover: t.artwork?.['480x480'] || t.artwork?.['150x150'] || t.artwork?.['1000x1000'] || null,
    duration: t.duration || 0,
    audioUrl: `${AUDIUS_BASE}/v1/tracks/${t.id}/stream`,
    source: 'audius',
    isAudius: true,
    playCount: t.play_count || 0,
    genre: t.genre || '',
    mood: t.mood || '',
    tags: t.tags || '',
    isStreamable: t.is_streamable !== false,
    releaseDate: t.release_date || '',
    createdAt: t.created_at || '',
  };
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    id: `audius_${u.id}`,
    name: u.name || u.handle || 'Unknown',
    handle: u.handle || '',
    photo: u.profile_picture?.['480x480'] || u.profile_picture?.['150x150'] || u.profile_picture?.['1000x1000'] || null,
    followers: u.follower_count || 0,
    following: u.following_count || 0,
    trackCount: u.track_count || 0,
    playlistCount: u.playlist_count || 0,
    bio: u.bio || '',
    location: u.location || '',
    isVerified: u.is_verified || false,
    source: 'audius',
    isAudius: true,
  };
}

// --- Routes ---

router.get('/config', (_req, res) => {
  res.json({ configured: true, source: 'audius' });
});

// Trending tracks
router.get('/tracks/trending', async (req, res) => {
  try {
    const { genre, limit = 50, offset = 0, time = 'week' } = req.query;
    const data = await cached(`trending:${time}:${limit}:${offset}`, 30000, () =>
      audiusFetch('/tracks/trending', { limit: Math.min(Number(limit) * 2, 100), offset, time })
    );
    let tracks = (data.data || []).filter(t => t.is_streamable !== false).map(normalizeTrack);
    if (genre) {
      const genreLower = genre.toLowerCase();
      tracks = tracks.filter(t => (t.genre || '').toLowerCase().includes(genreLower) || (t.tags || '').toLowerCase().includes(genreLower));
    }
    tracks = tracks.slice(0, Number(limit));
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Audius trending error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Best new releases
router.get('/tracks/best-new-releases', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const data = await cached(`best-new:${limit}`, 60000, () =>
      audiusFetch('/tracks/best_new_releases', { limit })
    );
    const tracks = (data.data || []).filter(t => t.is_streamable !== false).map(normalizeTrack);
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Audius best-new-releases error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Search tracks
router.get('/tracks/search', async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    if (!q) return res.json({ tracks: [], total: 0 });
    const data = await cached(`search:track:${q}:${limit}:${offset}`, 15000, () =>
      audiusFetch('/tracks/search', { query: q, limit, offset })
    );
    const tracks = (data.data || []).filter(t => t.is_streamable !== false).map(normalizeTrack);
    res.json({ tracks, total: data.data?.length || 0 });
  } catch (e) {
    console.error('Audius search tracks error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Search users (artists)
router.get('/users/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) return res.json({ users: [], total: 0 });
    const data = await cached(`search:user:${q}:${limit}`, 15000, () =>
      audiusFetch('/users/search', { query: q, limit })
    );
    const users = (data.data || []).map(normalizeUser);
    res.json({ users, total: data.data?.length || 0 });
  } catch (e) {
    console.error('Audius search users error:', e.message);
    res.json({ users: [], total: 0 });
  }
});

// Get single track
router.get('/tracks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await cached(`track:${id}`, 30000, () =>
      audiusFetch(`/tracks/${id}`)
    );
    const track = normalizeTrack(data.data);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(track);
  } catch (e) {
    console.error('Audius get track error:', e.message);
    res.status(502).json({ error: 'Audius unavailable' });
  }
});

// Stream track audio — get fresh stream URL and redirect
router.get('/tracks/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    // Use the Audius stream endpoint which returns a redirect itself
    const streamUrl = `${AUDIUS_BASE}/v1/tracks/${id}/stream`;
    // Fetch to get the final redirect URL
    const upstream = await fetch(streamUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'NocturneMusic/1.0' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    // Redirect client to the actual content node URL
    res.redirect(302, upstream.url);
  } catch (e) {
    console.error('Audius stream error:', e.message);
    if (!res.headersSent) res.status(502).json({ error: 'Stream unavailable' });
  }
});

// Get user (artist) profile
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await cached(`user:${id}`, 30000, () =>
      audiusFetch(`/users/${id}`)
    );
    const user = normalizeUser(data.data);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    console.error('Audius get user error:', e.message);
    res.status(502).json({ error: 'Audius unavailable' });
  }
});

// Get user's tracks
router.get('/users/:id/tracks', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const data = await cached(`user:${id}:tracks:${limit}:${offset}`, 30000, () =>
      audiusFetch(`/users/${id}/tracks`, { limit, offset })
    );
    const tracks = (data.data || []).filter(t => t.is_streamable !== false).map(normalizeTrack);
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Audius user tracks error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Get user's playlists
router.get('/users/:id/playlists', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    const data = await cached(`user:${id}:playlists:${limit}`, 30000, () =>
      audiusFetch(`/users/${id}/playlists`, { limit })
    );
    res.json({ playlists: data.data || [] });
  } catch (e) {
    console.error('Audius user playlists error:', e.message);
    res.json({ playlists: [] });
  }
});

// Get playlist
router.get('/playlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await cached(`playlist:${id}`, 30000, () =>
      audiusFetch(`/playlists/${id}`)
    );
    res.json(data.data || null);
  } catch (e) {
    console.error('Audius get playlist error:', e.message);
    res.status(502).json({ error: 'Audius unavailable' });
  }
});

// Get playlist tracks
router.get('/playlists/:id/tracks', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;
    const data = await cached(`playlist:${id}:tracks:${limit}`, 30000, () =>
      audiusFetch(`/playlists/${id}/tracks`, { limit })
    );
    const tracks = (data.data || []).filter(t => t.is_streamable !== false).map(normalizeTrack);
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Audius playlist tracks error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Explore / genres
router.get('/genres', async (_req, res) => {
  try {
    const data = await cached('genres', 300000, () =>
      audiusFetch('/genres')
    );
    res.json({ genres: data.data || [] });
  } catch (e) {
    console.error('Audius genres error:', e.message);
    res.json({ genres: [] });
  }
});

module.exports = router;
