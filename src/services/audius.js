import { API_BASE } from '../config';

class AudiusService {
  async request(endpoint, params = {}) {
    const url = new URL(`${API_BASE}/audius${endpoint}`, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Audius request failed: ${res.status}`);
    return res.json();
  }

  async getConfig() {
    try {
      return await this.request('/config');
    } catch {
      return { configured: false };
    }
  }

  async getTrending(genre, limit = 30) {
    const data = await this.request('/tracks/trending', { genre, limit });
    return data.tracks || [];
  }

  async getBestNewReleases(limit = 20) {
    const data = await this.request('/tracks/best-new-releases', { limit });
    return data.tracks || [];
  }

  async searchTracks(query, limit = 20, offset = 0) {
    const data = await this.request('/tracks/search', { q: query, limit, offset });
    return data.tracks || [];
  }

  async searchUsers(query, limit = 10) {
    const data = await this.request('/users/search', { q: query, limit });
    return data.users || [];
  }

  async getTrack(id) {
    const rawId = id.replace('audius_', '');
    return await this.request(`/tracks/${rawId}`);
  }

  getStreamUrl(trackId) {
    const rawId = (trackId || '').replace('audius_', '');
    return `${API_BASE}/audius/tracks/${rawId}/stream`;
  }

  async getUser(id) {
    const rawId = (id || '').replace('audius_', '');
    return await this.request(`/users/${rawId}`);
  }

  async getUserTracks(userId, limit = 50) {
    const rawId = (userId || '').replace('audius_', '');
    const data = await this.request(`/users/${rawId}/tracks`, { limit });
    return data.tracks || [];
  }

  async getUserPlaylists(userId, limit = 20) {
    const rawId = (userId || '').replace('audius_', '');
    const data = await this.request(`/users/${rawId}/playlists`, { limit });
    return data.playlists || [];
  }

  async getPlaylist(id) {
    return await this.request(`/playlists/${id}`);
  }

  async getPlaylistTracks(id, limit = 100) {
    const data = await this.request(`/playlists/${id}/tracks`, { limit });
    return data.tracks || [];
  }

  async getGenres() {
    const data = await this.request('/genres');
    return data.genres || [];
  }
}

export const audius = new AudiusService();
