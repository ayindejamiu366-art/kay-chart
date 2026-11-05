const express = require('express');
const router = express.Router();

let cachedToken = null;
let tokenExpiry = 0;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

// Treat empty or obvious placeholder credentials as "not configured" so the app
// cleanly falls back to the local library instead of hanging on a dead network.
const isPlaceholder = (v) => !v || /REPLACE|CHANGE_ME|your_|xxx|placeholder/i.test(v);
const isSpotifyConfigured = () => !isPlaceholder(SPOTIFY_CLIENT_ID) && !isPlaceholder(SPOTIFY_CLIENT_SECRET);

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (!isSpotifyConfigured()) return null;

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Spotify auth failed');
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function spotifyFetch(endpoint, params = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Spotify not configured');
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.spotify.com/v1${endpoint}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return res.json();
}

function formatTrack(item) {
  return {
    id: item.id,
    title: item.name,
    artistName: item.artists.map(a => a.name).join(', '),
    artistId: item.artists[0]?.id,
    artistNameMain: item.artists[0]?.name || 'Unknown',
    albumName: item.album?.name || '',
    albumId: item.album?.id,
    duration: Math.floor(item.duration_ms / 1000),
    cover: item.album?.images?.[0]?.url || '',
    coverSmall: item.album?.images?.[2]?.url || item.album?.images?.[1]?.url || '',
    previewUrl: item.preview_url || null,
    spotifyUrl: item.external_urls?.spotify || null,
    spotifyUri: item.uri,
    popularity: item.popularity || 0,
    explicit: item.explicit || false,
  };
}

function formatAlbum(item) {
  return {
    id: item.id,
    title: item.name,
    artistName: item.artists?.map(a => a.name).join(', ') || '',
    artistId: item.artists?.[0]?.id,
    year: item.release_date?.substring(0, 4) || null,
    cover: item.images?.[0]?.url || '',
    totalTracks: item.total_tracks || 0,
    spotifyUrl: item.external_urls?.spotify || null,
    spotifyUri: item.uri,
  };
}

function formatArtist(item) {
  return {
    id: item.id,
    name: item.name,
    photo: item.images?.[0]?.url || '',
    genres: item.genres || [],
    followers: item.followers?.total || 0,
    popularity: item.popularity || 0,
    spotifyUrl: item.external_urls?.spotify || null,
    spotifyUri: item.uri,
  };
}

function formatPlaylist(item) {
  return {
    id: item.id,
    title: item.name,
    description: item.description || '',
    cover: item.images?.[0]?.url || '',
    owner: item.owner?.display_name || '',
    trackCount: item.tracks?.total || 0,
    spotifyUrl: item.external_urls?.spotify || null,
    spotifyUri: item.uri,
  };
}

router.get('/config', (req, res) => {
  res.json({
    configured: isSpotifyConfigured(),
    clientId: isSpotifyConfigured() && SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.substring(0, 4)}...` : null,
  });
});

router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20, market = 'US' } = req.query;
    if (!q) return res.json({ tracks: [] });

    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
    const tracks = [];
    let offset = 0;

    while (tracks.length < safeLimit && offset < 1000) {
      const pageLimit = Math.min(10, safeLimit - tracks.length);

      const data = await spotifyFetch('/search', {
        q: String(q),
        type: 'track',
        limit: pageLimit,
        offset,
        market: String(market || 'US')
      });

      const items = data.tracks?.items || [];
      tracks.push(...items.map(formatTrack).filter(Boolean));

      if (items.length < pageLimit) break;
      offset += pageLimit;
    }

    res.json({
      tracks: tracks.slice(0, safeLimit)
    });
  } catch (err) {
    console.error('[Spotify] Search failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tracks/:id', async (req, res) => {
  try {
    const data = await spotifyFetch(`/tracks/${req.params.id}`);
    res.json(formatTrack(data));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tracks', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.json([]);
    const data = await spotifyFetch('/tracks', { ids: ids.substring(0, 50) });
    res.json((data.tracks || []).filter(Boolean).map(formatTrack));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/albums/:id', async (req, res) => {
  try {
    const data = await spotifyFetch(`/albums/${req.params.id}`);
    const album = formatAlbum(data);
    album.tracks = (data.tracks?.items || []).map(formatTrack);
    res.json(album);
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/artists/:id', async (req, res) => {
  try {
    const data = await spotifyFetch(`/artists/${req.params.id}`);
    res.json(formatArtist(data));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/artists/:id/top-tracks', async (req, res) => {
  try {
    const data = await spotifyFetch(`/artists/${req.params.id}/top-tracks`, { market: 'US' });
    res.json((data.tracks || []).map(formatTrack));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/artists/:id/albums', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const data = await spotifyFetch(`/artists/${req.params.id}/albums`, { limit, market: 'US' });
    res.json((data.items || []).map(formatAlbum));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/playlists/:id', async (req, res) => {
  try {
    const data = await spotifyFetch(`/playlists/${req.params.id}`);
    const playlist = formatPlaylist(data);
    playlist.tracks = (data.tracks?.items || [])
      .filter(i => i.track)
      .map(i => formatTrack(i.track));
    res.json(playlist);
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const { seed_artists, seed_genres, seed_tracks, limit = 20 } = req.query;
    const params = { limit };
    if (seed_artists) params.seed_artists = seed_artists;
    if (seed_genres) params.seed_genres = seed_genres;
    if (seed_tracks) params.seed_tracks = seed_tracks;
    const data = await spotifyFetch('/recommendations', params);
    res.json((data.tracks || []).map(formatTrack));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/browse/categories', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const data = await spotifyFetch('/browse/categories', { limit, country: 'US' });
    res.json((data.categories?.items || []).map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icons?.[0]?.url || '',
    })));
  } catch (err) {
    console.error('[Spotify]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
