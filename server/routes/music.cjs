/**
 * Unified Music Routes
 * All endpoints use the UnifiedMusicService for cross-provider queries.
 */

const express = require('express');
const musicService = require('../providers/music-service.cjs');
const ttlCache = require('../utils/ttlcache.cjs');
const { recordEvent } = require('../providers/trending.cjs');
const db = require('../db.cjs');

const router = express.Router();

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth.cjs');
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      if (decoded.id && decoded.email) {
        const user = db.prepare('SELECT id, email, role FROM users WHERE id = ? AND email = ?').get(decoded.id, decoded.email);
        if (user) req.user = user;
      }
    } catch (_) {}
  }
  next();
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function validateQuery(q) { return (q || '').trim().slice(0, 200); }

// ---- SEARCH ----

router.get('/search/tracks', asyncHandler(async (req, res) => {
  const q = validateQuery(req.query.q);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const results = await musicService.searchTracks(q, limit);
  res.json({ data: results, total: results.length });
}));

router.get('/search/artists', asyncHandler(async (req, res) => {
  const q = validateQuery(req.query.q);
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  const results = await musicService.searchArtists(q, limit);
  res.json({ data: results, total: results.length });
}));

router.get('/search/albums', asyncHandler(async (req, res) => {
  const q = validateQuery(req.query.q);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const results = await musicService.searchAlbums(q, limit);
  res.json({ data: results, total: results.length });
}));

// ---- TRENDING / POPULAR ----

router.get('/trending', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const { value: tracks, stale } = await ttlCache.cached(
    `trending:${limit}`,
    () => musicService.getTrendingTracks(limit),
    { isUsable: (rows) => Array.isArray(rows) && rows.length > 0 }
  );
  res.json({ data: tracks || [], total: (tracks || []).length, stale });
}));

router.get('/popular', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const tracks = await musicService.getPopularTracks(limit);
  res.json({ data: tracks, total: tracks.length });
}));

// Artists worth surfacing without the listener having to know the name.
//
// Only the *names* are curated here. Every id, photo, listener count and track
// returned is resolved live through the configured providers, so nothing about
// these artists is invented or hardcoded — the same code path the search screen
// already uses. Cached because it fans out to several providers per artist.
const FEATURED_ARTIST_NAMES = [
  'Olamide', 'Asake', 'Central Cee', 'Wizkid', 'Burna Boy', 'Davido', 'Rema',
  'Omah Lay', 'CKay', 'Mercy Chinwo', 'Tems', 'L.A.X', 'Skepta', 'Stormzy',
  'Dave', 'Ayra Starr', 'Fireboy',
];

let popularArtistsCache = { data: null, ts: 0 };
const POPULAR_ARTISTS_TTL = 10 * 60 * 1000;

// Compare artist names ignoring case, spacing and punctuation so "Wiz Kid",
// "Wizkid" and "Wiz.Kid" are treated as the same artist.
const artistNameKey = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Scores how well a provider result looks like the artist we actually asked
 * for. Anything that scores <= 0 is rejected outright — providers frequently
 * return a different artist who merely appears on a track, or a same-named
 * artist with no catalogue ("Wiz Kid" the DJ, for example).
 */
function scoreArtistCandidate(candidateName, wantedName) {
  const got = artistNameKey(candidateName);
  const want = artistNameKey(wantedName);
  if (!got || !want) return -1;
  if (got === want) return 100;
  // Allow a single trailing/leading article or bracket suffix: "Renzo L.A.X".
  const stripped = got.replace(/^(the|a)/, '').replace(/(official|music|vevo|topic)$/, '');
  if (stripped === want) return 80;
  // Artist pages are sometimes "Wiz Kid" for "Wizkid"; a short edit distance is
  // safer than any substring test, which is what pulled in "Axel Boy".
  if (Math.abs(got.length - want.length) <= 2 && got.length >= 5) {
    let diff = 0;
    for (let i = 0; i < Math.max(got.length, want.length); i++) {
      if (got[i] !== want[i]) diff++;
    }
    if (diff <= 1) return 60;
  }
  return -1;
}

async function resolveArtist(name) {
  let found;
  try {
    found = await musicService.searchArtists(name, 8);
  } catch {
    return null;
  }
  if (!Array.isArray(found) || !found.length) return null;

  const scored = found
    .filter(a => a && a.id)
    .map(a => ({ a, score: scoreArtistCandidate(a.name, name) }))
    .filter(x => x.score > 0)
    // Deezer exposes preview URLs and richer artist pages; Audius artist pages
    // are often empty. Break ties on provider so we land on the usable one.
    .sort((x, y) => (y.score - x.score) || (providerRank(x.a) - providerRank(y.a)));

  if (!scored.length) return null;
  return scored[0].a;
}

function providerRank(artist) {
  const name = String(artist.id || '').split('_')[0];
  return ({ spotify: 1, deezer: 2, audius: 3, local: 4 })[name] ?? 9;
}

async function buildPopularArtists(limit) {
  const resolved = await Promise.all(FEATURED_ARTIST_NAMES.map(resolveArtist));

  const seen = new Set();
  const artists = resolved.filter(a => {
    if (!a || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Attach a playable sample, then discard any artist that turned out to have
  // no playable tracks — a browse card that cannot play anything is worse than
  // no card at all.
  const withTracks = await Promise.all(artists.map(async (artist) => {
    try {
      const tracks = await musicService.getArtistTopTracks(artist.id, 6);
      return {
        id: artist.id,
        name: artist.name,
        photo: artist.photo || null,
        listeners: artist.listeners || 0,
        totalTracks: Array.isArray(tracks) ? tracks.length : 0,
        tracks: Array.isArray(tracks) ? tracks.slice(0, 3) : [],
      };
    } catch {
      return { id: artist.id, name: artist.name, photo: artist.photo || null, listeners: artist.listeners || 0, totalTracks: 0, tracks: [] };
    }
  }));

  return withTracks.filter(a => a.totalTracks > 0).slice(0, limit);
}

router.get('/popular-artists', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 12, 24);
  if (popularArtistsCache.data && Date.now() - popularArtistsCache.ts < POPULAR_ARTISTS_TTL) {
    return res.json({ data: popularArtistsCache.data.slice(0, limit), total: popularArtistsCache.data.length });
  }
  // Serve the previous list immediately while a refresh runs, so a slow
  // provider can never leave this surface empty.
  if (popularArtistsCache.data) {
    res.json({ data: popularArtistsCache.data.slice(0, limit), total: popularArtistsCache.data.length });
  }
  const data = await buildPopularArtists(limit);
  if (!data.length && popularArtistsCache.data) {
    return res.json({ data: popularArtistsCache.data.slice(0, limit), total: popularArtistsCache.data.length });
  }
  popularArtistsCache = { data, ts: Date.now() };
  if (!res.headersSent) res.json({ data: data.slice(0, limit), total: data.length });
}));

// Build the first list at boot so the first real user request hits warm cache
// instead of waiting on ~20 providers. Failure is ignored; the route rebuilds
// on demand.
setTimeout(() => {
  buildPopularArtists(12)
    .then(data => { if (data.length) popularArtistsCache = { data, ts: Date.now() }; })
    .catch(() => {});
}, 5000).unref?.();

router.get('/genres', asyncHandler(async (req, res) => {
  const genres = await musicService.getGenres();
  res.json({ data: genres, total: genres.length });
}));

router.get('/genre/:genreId', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const tracks = await musicService.getTracksByGenre(req.params.genreId, limit);
  res.json({ data: tracks, total: tracks.length });
}));

router.get('/country/:countryCode', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cc = String(req.params.countryCode || '').toUpperCase().slice(0, 2);
  // Per-country, per-limit key: the listener's country is the expensive part.
  const { value: tracks, stale } = await ttlCache.cached(
    `country:${cc}:${limit}`,
    () => musicService.getTracksByCountry(cc, limit),
    { isUsable: (rows) => Array.isArray(rows) && rows.length > 0 }
  );
  res.json({ data: tracks || [], total: (tracks || []).length, stale });
}));

// ---- HOME ----

router.get('/home', asyncHandler(async (req, res) => {
  const country = String(req.query.country || 'NG').toUpperCase().slice(0, 2);
  const { value: home, stale } = await ttlCache.cached(
    `home:${country}`,
    () => musicService.getHome(country),
    { isUsable: (payload) => !!payload && Array.isArray(payload.trending) && payload.trending.length > 0 }
  );
  res.json({ ...(home || {}), stale });
}));

// ---- TRACKS ----

router.get('/track/:trackId', asyncHandler(async (req, res) => {
  const track = await musicService.getTrack(req.params.trackId);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  // Resolve playback source while preserving canonical metadata
  const resolved = musicService.resolvePlaybackSource(track);
  res.json(resolved);
}));

router.post('/track/:trackId/play', optionalAuth, asyncHandler(async (req, res) => {
  const track = await musicService.getTrack(req.params.trackId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  // Resolve the best playable source while preserving canonical metadata
  const resolved = musicService.resolvePlaybackSource(track);

  const { deviceId } = req.body || {};
  const userId = req.user?.id || null;
  recordEvent(resolved.id, resolved.provider, 'play', userId, deviceId);
  res.json({
    streamUrl: resolved.streamUrl,
    previewUrl: resolved.previewUrl,
    playbackType: resolved.playbackType,
    isAlternative: resolved.isAlternative,
    licenseType: resolved.licenseType,
    licenseUrl: resolved.licenseUrl,
  });
}));

router.post('/track/:trackId/complete', optionalAuth, asyncHandler(async (req, res) => {
  const { deviceId } = req.body || {};
  const userId = req.user?.id || null;
  recordEvent(req.params.trackId, req.query.provider || 'unknown', 'play_complete', userId, deviceId);
  res.json({ ok: true });
}));

router.post('/track/:trackId/skip', optionalAuth, asyncHandler(async (req, res) => {
  const { deviceId } = req.body || {};
  const userId = req.user?.id || null;
  recordEvent(req.params.trackId, req.query.provider || 'unknown', 'skip', userId, deviceId);
  res.json({ ok: true });
}));

// ---- ARTISTS ----

router.get('/artist/:artistId', asyncHandler(async (req, res) => {
  const artist = await musicService.getArtist(req.params.artistId);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  res.json(artist);
}));

router.get('/artist/:artistId/top-tracks', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const tracks = await musicService.getArtistTopTracks(req.params.artistId, limit);
  res.json({ data: tracks, total: tracks.length });
}));

router.get('/artist/:artistId/albums', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 30);
  const albums = await musicService.getArtistAlbums(req.params.artistId, limit);
  res.json({ data: albums, total: albums.length });
}));

// ---- ALBUMS ----

router.get('/album/:albumId', asyncHandler(async (req, res) => {
  const album = await musicService.getAlbum(req.params.albumId);
  if (!album) return res.status(404).json({ error: 'Album not found' });
  res.json(album);
}));

router.get('/album/:albumId/tracks', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const tracks = await musicService.getAlbumTracks(req.params.albumId, limit);
  res.json({ data: tracks, total: tracks.length });
}));

// ---- PROVIDERS ----

router.get('/providers', asyncHandler(async (req, res) => {
  const status = await musicService.getProviderStatus();
  res.json({ data: status });
}));

module.exports = router;
