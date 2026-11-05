/**
 * Audius Provider Adapter
 * Full streaming support — Audius provides free, DRM-free streaming.
 */

const CircuitBreaker = require('./circuit-breaker.cjs');
const AUDIUS_BASE = 'https://api.audius.co';
// Measured 6.7s-9.9s per call from a warm client, so the previous 10s ceiling
// occasionally aborted healthy requests and tripped the circuit breaker. Audius
// is the only provider here serving full-length playable audio, so it gets a
// little headroom — but not a large one, because aggregate endpoints fan this out
// to every request.
const TIMEOUT = 15000;

async function audiusFetch(pathStr, params = {}) {
  const url = new URL(`/v1${pathStr}`, AUDIUS_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NocturneMusic/2.0' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  return res.json();
}

// Alternative-version indicators for filtering covers/remixes/bootlegs
const ALT_VERSION_PATTERNS = [
  /\b(remix)\b/i, /\b(remastered)\b/i, /\b(live)\b/i, /\b(cover)\b/i, /\b(covers)\b/i,
  /\b(acoustic)\b/i, /\b(instrumental)\b/i, /\b(karaoke)\b/i, /\b(type\s*beat)\b/i,
  /\b(bootleg)\b/i, /\b(edit)\b/i, /\b(mix)\b/i, /\b(sped\s*up)\b/i, /\b(slowed)\b/i,
  /\b(rework)\b/i, /\b(mashup)\b/i, /\b(tribute)\b/i, /\b(nightcore)\b/i,
  /\b(official\s*audio)\b/i, /\b(official\s*music)\b/i, /\b(video)\b/i,
];

function isAlternativeVersion(title) {
  return ALT_VERSION_PATTERNS.some(p => p.test(title || ''));
}

function normalizeTrack(t) {
  if (!t) return null;
  const user = t.user || {};
  return {
    id: `audius_${t.id}`,
    providerTrackId: String(t.id),
    title: t.title || 'Untitled',
    artistName: user.name || 'Unknown',
    artistId: user.id ? `audius_${user.id}` : null,
    albumName: '',
    albumId: null,
    cover: t.artwork?.['480x480'] || t.artwork?.['150x150'] || t.artwork?.['1000x1000'] || null,
    duration: t.duration || 0,
    genre: t.genre || '',
    country: '',
    popularity: t.play_count || 0,
    playCount: t.play_count || 0,
    previewUrl: null,
    streamUrl: `${AUDIUS_BASE}/v1/tracks/${t.id}/stream?app_name=NocturneMusic`,
    externalUrl: null,
    isPlayable: t.is_streamable !== false,
    playbackType: t.is_streamable !== false ? 'full' : 'unavailable',
    previewOnly: false,
    provider: 'audius',
    rank: 0,
    explicit: false,
    releaseDate: t.release_date || '',
    isAlternative: isAlternativeVersion(t.title),
  };
}

function normalizeArtist(u) {
  if (!u) return null;
  return {
    id: `audius_${u.id}`,
    providerArtistId: String(u.id),
    name: u.name || u.handle || 'Unknown',
    photo: u.profile_picture?.['480x480'] || u.profile_picture?.['150x150'] || null,
    nbFans: u.follower_count || 0,
    nbAlbums: u.track_count || 0,
    genres: [],
    isVerified: u.is_verified || false,
    provider: 'audius',
  };
}

function normalizeAlbum(a) {
  if (!a) return null;
  return {
    id: `audius_pl_${a.id}`,
    title: a.name || 'Untitled',
    artistName: a.user?.name || '',
    artistId: a.user?.id ? `audius_${a.user.id}` : null,
    cover: a.artwork?.['480x480'] || null,
    year: null,
    trackCount: a.track_count || 0,
    provider: 'audius',
  };
}

class AudiusProvider {
  constructor(config = {}) {
    this._config = config;
    this._breaker = new CircuitBreaker('audius');
  }
  get name() { return 'audius'; }
  get capabilities() {
    return ['search', 'artist_lookup', 'track_lookup', 'trending', 'genres', 'artwork', 'preview_playback', 'full_playback'];
  }
  get supportsFullTracks() { return true; }
  get supportsPreview() { return true; }

  async healthCheck() {
    try {
      const start = Date.now();
      await audiusFetch('/tracks/trending', { limit: 1 });
      this._breaker.recordSuccess();
      return { healthy: true, responseMs: Date.now() - start };
    } catch (e) {
      this._breaker.recordFailure();
      return { healthy: false, error: e.message };
    }
  }

  async searchTracks(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await audiusFetch('/tracks/search', { query: query, limit, offset: 0 });
      this._breaker.recordSuccess();
      return (data.data || [])
        .filter(t => t.is_streamable !== false)
        .filter(t => !isAlternativeVersion(t.title))
        .map(normalizeTrack)
        .filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getTrack(trackId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(trackId).replace('audius_', '');
      const data = await audiusFetch(`/tracks/${rawId}`);
      this._breaker.recordSuccess();
      return normalizeTrack(data.data);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getTrendingTracks(limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await audiusFetch('/tracks/trending', { limit: Math.min(limit * 2, 100), time: 'week' });
      this._breaker.recordSuccess();
      return (data.data || [])
        .filter(t => t.is_streamable !== false)
        .filter(t => !isAlternativeVersion(t.title))
        .map(normalizeTrack)
        .filter(Boolean)
        .slice(0, limit);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getPopularTracks(limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async getTracksByGenre(genreId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await audiusFetch('/tracks/trending', { limit: Math.min(limit * 2, 100), genre: genreId, time: 'week' });
      this._breaker.recordSuccess();
      return (data.data || [])
        .filter(t => t.is_streamable !== false)
        .filter(t => !isAlternativeVersion(t.title))
        .map(normalizeTrack)
        .filter(Boolean)
        .slice(0, limit);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getTracksByCountry(countryCode, limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await audiusFetch('/users/search', { query, limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeArtist).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtist(artistId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(artistId).replace('audius_', '');
      const data = await audiusFetch(`/users/${rawId}`);
      this._breaker.recordSuccess();
      return normalizeArtist(data.data);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtistTopTracks(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('audius_', '');
      const data = await audiusFetch(`/users/${rawId}/tracks`, { limit });
      this._breaker.recordSuccess();
      return (data.data || [])
        .filter(t => t.is_streamable !== false)
        .filter(t => !isAlternativeVersion(t.title))
        .map(normalizeTrack)
        .filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtistAlbums(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('audius_', '');
      const data = await audiusFetch(`/users/${rawId}/playlists`, { limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeAlbum).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async searchAlbums(query, limit = 20) {
    return [];
  }

  async getAlbum(albumId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(albumId).replace('audius_pl_', '');
      const data = await audiusFetch(`/playlists/${rawId}`);
      this._breaker.recordSuccess();
      return normalizeAlbum(data.data);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getAlbumTracks(albumId, limit = 50) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(albumId).replace('audius_pl_', '');
      const data = await audiusFetch(`/playlists/${rawId}/tracks`, { limit });
      this._breaker.recordSuccess();
      return (data.data || []).filter(t => t.is_streamable !== false).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getGenres() {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await audiusFetch('/genres');
      this._breaker.recordSuccess();
      return (data.data || []).map(g => ({ id: g.id || g.name, name: g.name || g.id }));
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }
}

module.exports = { AudiusProvider, normalizeTrack, normalizeArtist };
