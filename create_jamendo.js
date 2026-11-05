const fs = require('fs');
const path = 'C:/Users/jam kay/nocturne-app/server/providers/jamendo.cjs';
const content = `/**
 * Jamendo Provider Adapter
 * Independent/open music catalog with Creative Commons licensing info.
 */

const CircuitBreaker = require('./circuit-breaker.cjs');
const JAMENDO_BASE = 'https://api.jamendo.com/v3.0';
const TIMEOUT = 10000;

const LICENSE_MAP = {
  'cc-by-nc-nd': { allowCommercial: false, allowDerivatives: false, requiresAttribution: true, label: 'CC BY-NC-ND' },
  'cc-by-nc-sa': { allowCommercial: false, allowDerivatives: true, requiresAttribution: true, label: 'CC BY-NC-SA' },
  'cc-by-nc': { allowCommercial: false, allowDerivatives: true, requiresAttribution: true, label: 'CC BY-NC' },
  'cc-by-sa': { allowCommercial: true, allowDerivatives: true, requiresAttribution: true, label: 'CC BY-SA' },
  'cc-by': { allowCommercial: true, allowDerivatives: true, requiresAttribution: true, label: 'CC BY' },
  'cc0': { allowCommercial: true, allowDerivatives: true, requiresAttribution: false, label: 'CC0' },
};

async function jamendoFetch(pathStr, params = {}) {
  const url = new URL(pathStr, JAMENDO_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NocturneMusic/2.0' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(\\`Jamendo \\${res.status}\\`);
  return res.json();
}

function normalizeTrack(t) {
  if (!t) return null;
  const license = LICENSE_MAP[t.license_cc] || { allowCommercial: false, allowDerivatives: false, requiresAttribution: true, label: t.license_cc || 'Unknown' };
  return {
    id: \\`jamendo_\\${t.id}\\`,
    providerTrackId: String(t.id),
    title: t.name || 'Untitled',
    artistName: t.artist_name || t.artist?.name || 'Unknown',
    artistId: t.artist?.id ? \\`jamendo_\\${t.artist.id}\\` : null,
    albumName: t.album_name || '',
    albumId: t.album_id ? \\`jamendo_\\${t.album_id}\\` : null,
    cover: t.album_cover || t.artist?.picture_url || null,
    duration: t.duration || 0,
    genre: t.tags?.map(tg => tg.name).join(', ') || '',
    country: t.count || '',
    popularity: t.listeners || 0,
    playCount: t.listeners || 0,
    previewUrl: t.audio || null,
    streamUrl: t.audio || null,
    externalUrl: null,
    isPlayable: !!t.audio,
    playbackType: t.audio ? 'full' : 'unavailable',
    previewOnly: !t.audio,
    provider: 'jamendo',
    rank: 0,
    explicit: false,
    releaseDate: t.release_date || '',
    licenseType: license.label,
    licenseUrl: \\`https://creativecommons.org/licenses/\\${t.license_cc}/4.0/\\`,
    licenseAllowCommercial: license.allowCommercial,
    licenseAllowDerivatives: license.allowDerivatives,
    licenseRequiresAttribution: license.requiresAttribution,
    licenseShareAlike: t.license_cc?.includes('sa') || false,
  };
}

function normalizeArtist(a) {
  if (!a) return null;
  return {
    id: \\`jamendo_\\${a.id}\\`,
    providerArtistId: String(a.id),
    name: a.name || a.artist_name || 'Unknown',
    photo: a.picture_url || null,
    nbFans: a.nb_fan || 0,
    nbAlbums: a.nb_album || 0,
    genres: [],
    isVerified: false,
    provider: 'jamendo',
  };
}

function normalizeAlbum(a) {
  if (!a) return null;
  return {
    id: \\`jamendo_\\${a.id}\\`,
    title: a.name || 'Untitled',
    artistName: a.artist_name || '',
    artistId: a.artist?.id ? \\`jamendo_\\${a.artist.id}\\` : null,
    cover: a.album_cover || null,
    year: null,
    trackCount: 0,
    provider: 'jamendo',
  };
}

class JamendoProvider {
  constructor(config = {}) {
    this._config = config;
    this._clientId = config.apiKey || process.env.JAMENDO_CLIENT_ID || '';
    this._breaker = new CircuitBreaker('jamendo');
  }
  get name() { return 'jamendo'; }
  get capabilities() {
    return ['search', 'artist_lookup', 'track_lookup', 'trending', 'genres', 'artwork', 'full_playback'];
  }
  get supportsFullTracks() { return true; }
  get supportsPreview() { return true; }

  _isConfigured() {
    const isPlaceholder = (v) => !v || /REPLACE|CHANGE_ME|your_|placeholder/i.test(v);
    return !isPlaceholder(this._clientId);
  }
  _getDefaultParams() {
    return { client_id: this._clientId, format: 'json' };
  }

  async healthCheck() {
    if (!this._isConfigured()) return { healthy: false, error: 'Not configured' };
    try {
      const start = Date.now();
      await jamendoFetch('/tracks', { limit: 1, ...this._getDefaultParams() });
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
    if (!this._isConfigured()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const data = await jamendoFetch('/tracks', { ...this._getDefaultParams(), limit: safeLimit, name: query, order: 'popularity' });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(t => normalizeTrack(t)).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); console.error('[Jamendo] searchTracks failed:', e.message); return []; }
  }

  async getTrack(trackId) {
    if (!this._breaker.canExecute()) return null;
    if (!this._isConfigured()) return null;
    try {
      const rawId = String(trackId).replace('jamendo_', '');
      const data = await jamendoFetch(\\`/tracks/\\${rawId}\\`, { ...this._getDefaultParams() });
      this._breaker.recordSuccess();
      return normalizeTrack(data);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getTrendingTracks(limit = 20) {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const data = await jamendoFetch('/tracks', { ...this._getDefaultParams(), limit: safeLimit * 2, order: 'popularity' });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(t => normalizeTrack(t)).filter(Boolean).slice(0, safeLimit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getPopularTracks(limit = 20) { return this.getTrendingTracks(limit); }

  async getTracksByGenre(genreId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const data = await jamendoFetch('/tracks', { ...this._getDefaultParams(), limit: safeLimit * 2, tags: genreId, order: 'popularity' });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(t => normalizeTrack(t)).filter(Boolean).slice(0, safeLimit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getTracksByCountry(countryCode, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const data = await jamendoFetch('/tracks', { ...this._getDefaultParams(), limit: safeLimit, country: countryCode, order: 'popularity' });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(t => normalizeTrack(t)).filter(Boolean).slice(0, safeLimit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
      const data = await jamendoFetch('/artists', { ...this._getDefaultParams(), limit: safeLimit, name: query });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(a => normalizeArtist(a)).filter(Boolean).slice(0, safeLimit);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }

  async getArtist(artistId) {
    if (!this._breaker.canExecute()) return null;
    if (!this._isConfigured()) return null;
    try {
      const rawId = String(artistId).replace('jamendo_', '');
      const data = await jamendoFetch(\\`/artists/\\${rawId}\\`, { ...this._getDefaultParams() });
      this._breaker.recordSuccess();
      return normalizeArtist(data);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getArtistTopTracks(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const rawId = String(artistId).replace('jamendo_', '');
      const data = await jamendoFetch(\\`/artists/\\${rawId}/tracks\\`, { ...this._getDefaultParams(), limit });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(t => normalizeTrack(t)).filter(Boolean).slice(0, limit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getArtistAlbums(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const rawId = String(artistId).replace('jamendo_', '');
      const data = await jamendoFetch(\\`/artists/\\${rawId}/albums\\`, { ...this._getDefaultParams(), limit });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(a => normalizeAlbum(a)).filter(Boolean).slice(0, limit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async searchAlbums(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const data = await jamendoFetch('/albums', { ...this._getDefaultParams(), limit: safeLimit, name: query });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(a => normalizeAlbum(a)).filter(Boolean).slice(0, safeLimit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getAlbum(albumId) {
    if (!this._breaker.canExecute()) return null;
    if (!this._isConfigured()) return null;
    try {
      const rawId = String(albumId).replace('jamendo_', '');
      const data = await jamendoFetch(\\`/albums/\\${rawId}\\`, { ...this._getDefaultParams() });
      this._breaker.recordSuccess();
      return normalizeAlbum(data);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getAlbumTracks(albumId, limit = 50) {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const rawId = String(albumId).replace('jamendo_', '');
      const data = await jamendoFetch(\\`/albums/\\${rawId}/tracks\\`, { ...this._getDefaultParams(), limit });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(t => normalizeTrack(t)).filter(Boolean).slice(0, limit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getGenres() {
    if (!this._breaker.canExecute()) return [];
    if (!this._isConfigured()) return [];
    try {
      const data = await jamendoFetch('/genres', { ...this._getDefaultParams() });
      this._breaker.recordSuccess();
      const results = data.results || data;
      if (!Array.isArray(results)) return [];
      return results.map(g => ({ id: g.id || g.name, name: g.name || g.id })).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); throw e; }
  }
}

module.exports = { JamendoProvider, normalizeTrack, normalizeArtist, normalizeAlbum };
`;
fs.writeFileSync(path, content);
console.log('Jamendo provider written to', path);
`
;
fs.writeFileSync('C:/Users/jam kay/nocturne-app/server/providers/jamendo.cjs', content);
console.log('Done');
