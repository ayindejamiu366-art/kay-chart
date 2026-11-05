/**
 * Spotify Provider Adapter
 * Metadata-only — Spotify API provides search/metadata but NOT full streaming.
 * Previews are short clips when available; external tracks link to the Spotify app.
 */

const CircuitBreaker = require('./circuit-breaker.cjs');
const TIMEOUT = 8000;
const RETRY_DELAY_MS = 1000;

class SpotifyProvider {
  constructor(config = {}) {
    this._config = config;
    this._clientId = config.apiKey || process.env.SPOTIFY_CLIENT_ID || '';
    this._clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this._cachedToken = null;
    this._tokenExpiry = 0;
    this._breaker = new CircuitBreaker('spotify');
  }

  get name() { return 'spotify'; }
  get capabilities() {
    return ['search', 'artist_lookup', 'album_lookup', 'track_lookup', 'artwork', 'preview_playback', 'external_playback'];
  }
  get supportsFullTracks() { return false; }
  get supportsPreview() { return true; }

  _isConfigured() {
    const isPlaceholder = (v) => !v || /REPLACE|CHANGE_ME|your_|placeholder/i.test(v);
    return !isPlaceholder(this._clientId) && !isPlaceholder(this._clientSecret);
  }

  async _getAccessToken() {
    if (this._cachedToken && Date.now() < this._tokenExpiry) return this._cachedToken;
    if (!this._isConfigured()) return null;
    const credentials = Buffer.from(`${this._clientId}:${this._clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) {
      // 401/403 = credential problem — clear cached token so next call re-attempts auth
      if (res.status === 401 || res.status === 403) {
        this._cachedToken = null;
        this._tokenExpiry = 0;
      }
      throw new Error(`Spotify auth ${res.status}`);
    }
    const data = await res.json();
    this._cachedToken = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._cachedToken;
  }

  async _fetch(endpoint, params = {}) {
    const token = await this._getAccessToken();
    if (!token) throw new Error('Spotify not configured');
    const qs = new URLSearchParams(params).toString();
    const url = `https://api.spotify.com/v1${endpoint}${qs ? '?' + qs : ''}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) {
      if (res.status === 401) {
        // Token may have been invalidated — clear and re-fetch once
        this._cachedToken = null;
        this._tokenExpiry = 0;
        const retryToken = await this._getAccessToken();
        if (!retryToken) throw new Error('Spotify authentication failed');
        const retryRes = await fetch(url, {
          headers: { 'Authorization': `Bearer ${retryToken}` },
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (!retryRes.ok) throw new Error(`Spotify ${retryRes.status}`);
        return retryRes.json();
      }
      if (res.status === 403) {
        throw new Error('Spotify: provider restriction');
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
        await new Promise(r => setTimeout(r, Math.min(retryAfter, 30) * 1000));
        return this._fetch(endpoint, params);
      }
      throw new Error(`Spotify ${res.status}`);
    }
    return res.json();
  }

  async healthCheck() {
    if (!this._isConfigured()) return { healthy: false, error: 'Not configured' };
    try {
      const start = Date.now();
      await this._getAccessToken();
      this._breaker.recordSuccess();
      return { healthy: true, responseMs: Date.now() - start };
    } catch (e) {
      this._breaker.recordFailure();
      return { healthy: false, error: e.message };
    }
  }

  _normalizeTrack(item) {
    if (!item) return null;
    const previewUrl = item.preview_url || null;
    const hasPreview = !!previewUrl;
    return {
      id: `spotify_${item.id}`,
      providerTrackId: item.id,
      title: item.name || 'Untitled',
      artistName: item.artists?.map(a => a.name).join(', ') || 'Unknown',
      artistId: item.artists?.[0]?.id ? `spotify_${item.artists[0].id}` : null,
      albumName: item.album?.name || '',
      albumId: item.album?.id ? `spotify_${item.album.id}` : null,
      cover: item.album?.images?.[0]?.url || null,
      duration: Math.floor((item.duration_ms || 0) / 1000),
      genre: '',
      country: '',
      popularity: item.popularity || 0,
      playCount: 0,
      previewUrl,
      streamUrl: null,
      externalUrl: item.external_urls?.spotify || null,
      isPlayable: hasPreview || !!item.external_urls?.spotify,
      playbackType: hasPreview ? 'preview' : (item.external_urls?.spotify ? 'external' : 'unavailable'),
      hasPreview,
      provider: 'spotify',
      rank: 0,
      explicit: item.explicit || false,
    };
  }

  _normalizeArtist(item) {
    if (!item) return null;
    return {
      id: `spotify_${item.id}`,
      providerArtistId: item.id,
      name: item.name || 'Unknown',
      photo: item.images?.[0]?.url || null,
      nbFans: item.followers?.total || 0,
      nbAlbums: 0,
      genres: item.genres || [],
      isVerified: false,
      provider: 'spotify',
    };
  }

  _normalizeAlbum(item) {
    if (!item) return null;
    return {
      id: `spotify_${item.id}`,
      title: item.name || 'Untitled',
      artistName: item.artists?.map(a => a.name).join(', ') || '',
      artistId: item.artists?.[0]?.id ? `spotify_${item.artists[0].id}` : null,
      cover: item.images?.[0]?.url || null,
      year: item.release_date?.substring(0, 4) || null,
      trackCount: item.total_tracks || 0,
      provider: 'spotify',
    };
  }

  async searchTracks(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const results = [];
      let offset = 0;
      while (results.length < safeLimit && offset < 1000) {
        const pageLimit = Math.min(10, safeLimit - results.length);
        const data = await this._fetch('/search', {
          q: query,
          type: 'track',
          limit: pageLimit,
          offset,
          market: 'US'
        });
        const items = data.tracks?.items || [];
        results.push(...items.map(i => this._normalizeTrack(i)).filter(Boolean));
        if (items.length < pageLimit) break;
        offset += pageLimit;
      }
      this._breaker.recordSuccess();
      return results.slice(0, safeLimit);
    } catch (e) {
      this._breaker.recordFailure();
      console.error('[Spotify] searchTracks failed:', e.message);
      return [];
    }
  }

  async getTrack(trackId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(trackId).replace('spotify_', '');
      const data = await this._fetch(`/tracks/${rawId}`);
      this._breaker.recordSuccess();
      return this._normalizeTrack(data);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getTrendingTracks(limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
      const queries = ['top hits', 'new music', 'popular music', 'trending music'];
      const results = [];
      for (const query of queries) {
        if (results.length >= safeLimit) break;
        const pageLimit = Math.min(10, safeLimit - results.length);
        const data = await this._fetch('/search', {
          q: query,
          type: 'track',
          limit: pageLimit,
          market: 'US'
        });
        const items = data.tracks?.items || [];
        results.push(...items.map(i => this._normalizeTrack(i)).filter(Boolean));
      }
      const unique = [];
      const seen = new Set();
      for (const track of results) {
        if (!track?.providerTrackId || seen.has(track.providerTrackId)) continue;
        seen.add(track.providerTrackId);
        unique.push(track);
      }
      this._breaker.recordSuccess();
      return unique.slice(0, safeLimit);
    } catch (e) {
      this._breaker.recordFailure();
      console.error('[Spotify] getTrendingTracks failed:', e.message);
      return [];
    }
  }

  async getPopularTracks(limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async getTracksByGenre(genreId, limit = 20) {
    if (!genreId) return [];
    const cleanGenre = String(genreId).replace(/[^a-zA-Z0-9_-]/g, '');
    return this.searchTracks(`genre:${cleanGenre}`, limit);
  }

  async getTracksByCountry(countryCode, limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
      const results = [];
      let offset = 0;
      while (results.length < safeLimit && offset < 1000) {
        const pageLimit = Math.min(10, safeLimit - results.length);
        const data = await this._fetch('/search', {
          q: query,
          type: 'artist',
          limit: pageLimit,
          offset,
          market: 'US'
        });
        const items = data.artists?.items || [];
        results.push(...items.map(i => this._normalizeArtist(i)).filter(Boolean));
        if (items.length < pageLimit) break;
        offset += pageLimit;
      }
      this._breaker.recordSuccess();
      return results.slice(0, safeLimit);
    } catch (e) {
      this._breaker.recordFailure();
      console.error('[Spotify] searchArtists failed:', e.message);
      return [];
    }
  }

  async getArtist(artistId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(artistId).replace('spotify_', '');
      const data = await this._fetch(`/artists/${rawId}`);
      this._breaker.recordSuccess();
      return this._normalizeArtist(data);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getArtistTopTracks(artistId, limit = 20) {
    return [];
  }

  async getArtistAlbums(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('spotify_', '');
      const data = await this._fetch(`/artists/${rawId}/albums`, { limit, market: 'US' });
      this._breaker.recordSuccess();
      return (data.items || []).map(i => this._normalizeAlbum(i)).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async searchAlbums(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const data = await this._fetch('/search', { q: query, type: 'album', limit });
      this._breaker.recordSuccess();
      return (data.albums?.items || []).map(i => this._normalizeAlbum(i)).filter(Boolean);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getAlbum(albumId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(albumId).replace('spotify_', '');
      const data = await this._fetch(`/albums/${rawId}`);
      this._breaker.recordSuccess();
      return this._normalizeAlbum(data);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getAlbumTracks(albumId, limit = 50) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(albumId).replace('spotify_', '');
      const data = await this._fetch(`/albums/${rawId}`);
      this._breaker.recordSuccess();
      return (data.tracks?.items || []).map(i => this._normalizeTrack(i)).filter(Boolean).slice(0, limit);
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getGenres() {
    return [];
  }
}

module.exports = { SpotifyProvider };
