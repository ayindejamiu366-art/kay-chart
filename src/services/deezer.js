import { API_BASE } from '../config';

class DeezerService {
  async request(endpoint, params = {}) {
    const url = new URL(`${API_BASE}/deezer${endpoint}`, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Deezer request failed: ${res.status}`);
    return res.json();
  }

  async search(query, limit = 20) {
    const data = await this.request('/search', { q: query, limit });
    return data.tracks || [];
  }

  async searchArtist(query, limit = 10) {
    const data = await this.request('/search/artist', { q: query, limit });
    return data.artists || [];
  }

  async getArtist(id) {
    return await this.request(`/artist/${id}`);
  }

  async getArtistTopTracks(artistId, limit = 20) {
    const data = await this.request(`/artist/${artistId}/top`, { limit });
    return data.tracks || [];
  }

  async getArtistAlbums(artistId) {
    const data = await this.request(`/artist/${artistId}/albums`);
    return data.albums || [];
  }

  async getAlbumTracks(albumId) {
    const data = await this.request(`/album/${albumId}/tracks`);
    return data.tracks || [];
  }

  async getChart(country = 'NG', limit = 20) {
    const data = await this.request('/chart', { country, limit });
    return data.tracks || [];
  }
}

export const deezer = new DeezerService();
