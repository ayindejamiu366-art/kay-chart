import { API_BASE } from '../config';

class MusicService {
  async request(path, params = {}) {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Music API ${res.status}`);
    return res.json();
  }

  async post(path, body = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Music API ${res.status}`);
    return res.json();
  }

  async searchTracks(query, limit = 20) {
    if (!query) return [];
    const data = await this.request('/music/search/tracks', { q: query, limit });
    return data.data || [];
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    const data = await this.request('/music/search/artists', { q: query, limit });
    return data.data || [];
  }

  async searchAlbums(query, limit = 20) {
    if (!query) return [];
    const data = await this.request('/music/search/albums', { q: query, limit });
    return data.data || [];
  }

  async getTrack(trackId) {
    return await this.request(`/music/track/${trackId}`);
  }

  async playTrack(trackId, meta = {}) {
    return await this.post(`/music/track/${trackId}/play`, meta);
  }

  async getTrending(limit = 20) {
    const data = await this.request('/music/trending', { limit });
    return data.data || [];
  }

  async getPopular(limit = 20) {
    const data = await this.request('/music/popular', { limit });
    return data.data || [];
  }

  async getGenres() {
    const data = await this.request('/music/genres');
    return data.data || [];
  }

  async getTracksByGenre(genreId, limit = 20) {
    const data = await this.request(`/music/genre/${genreId}`, { limit });
    return data.data || [];
  }

  async getTracksByCountry(countryCode, limit = 20) {
    const data = await this.request(`/music/country/${countryCode}`, { limit });
    return data.data || [];
  }

  async getArtist(artistId) {
    return await this.request(`/music/artist/${artistId}`);
  }

  async getArtistTopTracks(artistId, limit = 20) {
    const data = await this.request(`/music/artist/${artistId}/top-tracks`, { limit });
    return data.data || [];
  }

  async getArtistAlbums(artistId, limit = 20) {
    const data = await this.request(`/music/artist/${artistId}/albums`, { limit });
    return data.data || [];
  }

  async getAlbum(albumId) {
    return await this.request(`/music/album/${albumId}`);
  }

  async getAlbumTracks(albumId, limit = 50) {
    const data = await this.request(`/music/album/${albumId}/tracks`, { limit });
    return data.data || [];
  }

  async getHome(country) {
    return await this.request('/music/home', { country });
  }

  // Curated artist names, resolved live through the providers: every id, photo
  // and track in the response comes from a real provider, not from local data.
  async getPopularArtists(limit = 12) {
    const data = await this.request('/music/popular-artists', { limit });
    return data.data || [];
  }

  async getProviders() {
    const data = await this.request('/music/providers');
    return data.data || [];
  }

  // Charts
  async getChart(type = 'global', key = 'top50', limit = 50) {
    const data = await this.request('/charts', { type, key, limit });
    return data.data || [];
  }

  async getRising(limit = 50) {
    const data = await this.request('/charts/internal/rising', { limit });
    return data.data || [];
  }

  async getCountries() {
    const data = await this.request('/charts/countries');
    return data.data || [];
  }

  // Live, internet-sourced chart. Unlike getChart(), this ranks with real
  // measured signals (Deezer global rank, YouTube view counts, Google daily
  // search volume) and returns those values per row for display.
  async getRealChart({ scope = 'global', country = 'US', limit = 50, include } = {}) {
    const data = await this.request('/real-chart', { scope, country, limit, include });
    return {
      ...data,
      data: (data.data || []).map(t => (
        // A merged row can carry a YouTube videoId alongside a Deezer rank.
        // Play it on YouTube rather than the 30s preview, but keep the original
        // provider and never downgrade a real full audio stream.
        (t && t.videoId && t.playbackType !== 'full')
          ? { ...t, playbackType: 'youtube' }
          : t
      )),
    };
  }

  async getGoogleTrends(country = 'US') {
    return this.request('/real-chart/google-trends', { country });
  }

  // Events
  async trackEvent(eventType, trackId, provider, meta = {}) {
    return await this.post('/events/' + eventType, { trackId, provider, ...meta });
  }

  // Legacy compat
  async search(query, limit = 20) {
    return this.searchTracks(query, limit);
  }
}

export const music = new MusicService();
