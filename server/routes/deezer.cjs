const express = require('express');
const router = express.Router();

const DEEZER_BASE = 'https://api.deezer.com';

// Simple in-memory cache (30s TTL)
const cache = new Map();
function cached(key, ttlMs, fn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
}

async function deezerFetch(path, params = {}) {
  const url = new URL(path, DEEZER_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NocturneMusic/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  return res.json();
}

function normalizeTrack(t) {
  if (!t) return null;
  return {
    id: `deezer_${t.id}`,
    title: t.title || 'Untitled',
    artistName: t.artist?.name || 'Unknown',
    artistId: t.artist?.id ? `deezer_${t.artist.id}` : null,
    albumName: t.album?.title || '',
    albumId: t.album?.id ? `deezer_${t.album.id}` : null,
    cover: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || null,
    duration: t.duration || 0,
    previewUrl: t.preview || null,
    source: 'deezer',
    isDeezer: true,
    rank: t.rank || 0,
    explicit: t.explicit_lyrics || false,
  };
}

function normalizeArtist(a) {
  if (!a) return null;
  return {
    id: `deezer_${a.id}`,
    name: a.name || 'Unknown',
    photo: a.picture_big || a.picture_medium || a.picture || null,
    nbAlbums: a.nb_album || 0,
    nbFans: a.nb_fan || 0,
    source: 'deezer',
    isDeezer: true,
  };
}

function normalizeAlbum(a) {
  if (!a) return null;
  return {
    id: `deezer_${a.id}`,
    title: a.title || 'Untitled',
    artistName: a.artist?.name || '',
    artistId: a.artist?.id ? `deezer_${a.artist.id}` : null,
    cover: a.cover_big || a.cover_medium || a.cover || null,
    year: a.release_date?.substring(0, 4) || null,
    trackCount: a.nb_tracks || 0,
    source: 'deezer',
    isDeezer: true,
  };
}

// --- Routes ---

// Search tracks
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20, order = 'ranking' } = req.query;
    if (!q) return res.json({ tracks: [], total: 0 });
    const data = await cached(`dz:search:${q}:${limit}`, 30000, () =>
      deezerFetch('/search', { q, limit, order })
    );
    const tracks = (data.data || []).map(normalizeTrack).filter(Boolean);
    res.json({ tracks, total: data.total || tracks.length });
  } catch (e) {
    console.error('Deezer search error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Search artists
router.get('/search/artist', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) return res.json({ artists: [], total: 0 });
    const data = await cached(`dz:search-artist:${q}:${limit}`, 30000, () =>
      deezerFetch('/search/artist', { q, limit })
    );
    const artists = (data.data || []).map(normalizeArtist).filter(Boolean);
    res.json({ artists, total: data.total || artists.length });
  } catch (e) {
    console.error('Deezer search artist error:', e.message);
    res.json({ artists: [], total: 0 });
  }
});

// Search albums
router.get('/search/album', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json({ albums: [], total: 0 });
    const data = await cached(`dz:search-album:${q}:${limit}`, 30000, () =>
      deezerFetch('/search/album', { q, limit })
    );
    const albums = (data.data || []).map(normalizeAlbum).filter(Boolean);
    res.json({ albums, total: data.total || albums.length });
  } catch (e) {
    console.error('Deezer search album error:', e.message);
    res.json({ albums: [], total: 0 });
  }
});

// Get artist
router.get('/artist/:id', async (req, res) => {
  try {
    const rawId = (req.params.id || '').replace('deezer_', '');
    const data = await cached(`dz:artist:${rawId}`, 60000, () =>
      deezerFetch(`/artist/${rawId}`)
    );
    const artist = normalizeArtist(data);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json(artist);
  } catch (e) {
    console.error('Deezer artist error:', e.message);
    res.status(502).json({ error: 'Deezer unavailable' });
  }
});

// Get artist top tracks
router.get('/artist/:id/top', async (req, res) => {
  try {
    const rawId = (req.params.id || '').replace('deezer_', '');
    const data = await cached(`dz:artist-top:${rawId}`, 30000, () =>
      deezerFetch(`/artist/${rawId}/top`, { limit: 20 })
    );
    const tracks = (data.data || []).map(normalizeTrack).filter(Boolean);
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Deezer artist top error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Get artist albums
router.get('/artist/:id/albums', async (req, res) => {
  try {
    const rawId = (req.params.id || '').replace('deezer_', '');
    const data = await cached(`dz:artist-albums:${rawId}`, 60000, () =>
      deezerFetch(`/artist/${rawId}/albums`, { limit: 20 })
    );
    const albums = (data.data || []).map(normalizeAlbum).filter(Boolean);
    res.json({ albums, total: albums.length });
  } catch (e) {
    console.error('Deezer artist albums error:', e.message);
    res.json({ albums: [], total: 0 });
  }
});

// Get album tracks
router.get('/album/:id/tracks', async (req, res) => {
  try {
    const rawId = (req.params.id || '').replace('deezer_', '');
    const data = await cached(`dz:album-tracks:${rawId}`, 60000, () =>
      deezerFetch(`/album/${rawId}/tracks`)
    );
    const tracks = (data.data || []).map(normalizeTrack).filter(Boolean);
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Deezer album tracks error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Get chart / trending (Deezer charts)
router.get('/chart', async (req, res) => {
  try {
    const { country = 'NG', limit = 20 } = req.query;
    const data = await cached(`dz:chart:${country}:${limit}`, 60000, () =>
      deezerFetch('/chart', { country })
    );
    const tracks = (data.tracks?.data || []).map(normalizeTrack).filter(Boolean).slice(0, Number(limit));
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('Deezer chart error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Get genre list
router.get('/genres', async (_req, res) => {
  try {
    const data = await cached('dz:genres', 300000, () =>
      deezerFetch('/genre')
    );
    const genres = (data.data || []).map(g => ({ id: g.id, name: g.name }));
    res.json({ genres });
  } catch (e) {
    console.error('Deezer genres error:', e.message);
    res.json({ genres: [] });
  }
});

module.exports = router;
