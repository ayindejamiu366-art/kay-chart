/**
 * Deezer Provider Adapter
 * Preview-only — Deezer provides 30-second previews, not full tracks.
 */

const CircuitBreaker = require('./circuit-breaker.cjs');
const DEEZER_BASE = 'https://api.deezer.com';
// Deezer answers quickly for single lookups but needs longer for the list
// endpoints, which were being cut off at 8s and reported as failures even though
// the API was reachable. Kept modest: raising this too far makes aggregate
// endpoints (Home, Charts) pay the full budget on every request.
const TIMEOUT = 12000;

async function deezerFetch(pathStr, params = {}) {
  const url = new URL(pathStr, DEEZER_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NocturneMusic/2.0' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  return res.json();
}

function normalizeTrack(t) {
  if (!t) return null;
  return {
    id: `deezer_${t.id}`,
    providerTrackId: String(t.id),
    title: t.title || 'Untitled',
    artistName: t.artist?.name || 'Unknown',
    artistId: t.artist?.id ? `deezer_${t.artist.id}` : null,
    albumName: t.album?.title || '',
    albumId: t.album?.id ? `deezer_${t.album.id}` : null,
    cover: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || null,
    duration: t.duration || 0,
    genre: '',
    country: '',
    popularity: t.rank || 0,
    playCount: 0,
    previewUrl: t.preview || null,
    streamUrl: null,
    externalUrl: t.link || null,
    isPlayable: !!t.preview,
    playbackType: t.preview ? 'preview' : 'unavailable',
    previewOnly: true,
    provider: 'deezer',
    rank: t.rank || 0,
    explicit: t.explicit_lyrics || false,
  };
}

function normalizeArtist(a) {
  if (!a) return null;
  return {
    id: `deezer_${a.id}`,
    providerArtistId: String(a.id),
    name: a.name || 'Unknown',
    photo: a.picture_big || a.picture_medium || a.picture || null,
    nbAlbums: a.nb_album || 0,
    nbFans: a.nb_fan || 0,
    genres: [],
    isVerified: false,
    provider: 'deezer',
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
    provider: 'deezer',
  };
}

class DeezerProvider {
  constructor(config = {}) {
    this._config = config;
    this._breaker = new CircuitBreaker('deezer');
  }
  get name() { return 'deezer'; }
  get capabilities() {
    return ['search', 'artist_lookup', 'album_lookup', 'track_lookup', 'trending', 'charts', 'genres', 'countries', 'artwork', 'preview_playback'];
  }
  get supportsFullTracks() { return false; }
  get supportsPreview() { return true; }

  async healthCheck() {
    try {
      const start = Date.now();
      await deezerFetch('/chart/0/tracks', { limit: 1 });
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
      const data = await deezerFetch('/search', { q: query, limit, order: 'ranking' });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getTrack(trackId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(trackId).replace('deezer_', '');
      const data = await deezerFetch(`/track/${rawId}`);
      this._breaker.recordSuccess();
      return normalizeTrack(data);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getTrendingTracks(limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await deezerFetch('/chart/0/tracks', { limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getPopularTracks(limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async getTracksByGenre(genreId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await deezerFetch('/search', { q: `genre:${genreId}`, limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getTracksByCountry(countryCode, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await deezerFetch('/chart/0/tracks', { country: countryCode, limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await deezerFetch('/search/artist', { q: query, limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeArtist).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtist(artistId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(artistId).replace('deezer_', '');
      const data = await deezerFetch(`/artist/${rawId}`);
      this._breaker.recordSuccess();
      return normalizeArtist(data);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtistTopTracks(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('deezer_', '');
      const data = await deezerFetch(`/artist/${rawId}/top`, { limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtistAlbums(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('deezer_', '');
      const data = await deezerFetch(`/artist/${rawId}/albums`, { limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeAlbum).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async searchAlbums(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await deezerFetch('/search/album', { q: query, limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeAlbum).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getAlbum(albumId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(albumId).replace('deezer_', '');
      const data = await deezerFetch(`/album/${rawId}`);
      this._breaker.recordSuccess();
      return normalizeAlbum(data);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getAlbumTracks(albumId, limit = 50) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(albumId).replace('deezer_', '');
      const data = await deezerFetch(`/album/${rawId}/tracks`, { limit });
      this._breaker.recordSuccess();
      return (data.data || []).map(normalizeTrack).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getGenres() {
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await deezerFetch('/genre');
      this._breaker.recordSuccess();
      return (data.data || []).map(g => ({ id: g.id, name: g.name }));
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }
}

module.exports = { DeezerProvider, normalizeTrack, normalizeArtist, normalizeAlbum };
