import { API_BASE } from '../config';

class SpotifyService {
  async request(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${API_BASE}/spotify${endpoint}${qs ? '?' + qs : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('Spotify request failed');
    return res.json();
  }

  async getConfig() {
    return this.request('/config');
  }

  async search(query, type = 'track,artist,album,playlist', limit = 20, market) {
    const params = { q: query, type, limit, ...(market ? { market } : {}) };
    return this.request('/search', params);
  }

  async searchTracks(query, limit = 20, market) {
    const result = await this.search(query, 'track', limit, market);
    return result.tracks || [];
  }

  async searchArtists(query, limit = 20, market) {
    const result = await this.search(query, 'artist', limit, market);
    return result.artists || [];
  }

  async searchAlbums(query, limit = 20, market) {
    const result = await this.search(query, 'album', limit, market);
    return result.albums || [];
  }

  async searchPlaylists(query, limit = 20, market) {
    const result = await this.search(query, 'playlist', limit, market);
    return result.playlists || [];
  }

  async getTrack(id) { return this.request(`/tracks/${id}`); }
  async getTracks(ids) { return this.request(`/tracks?ids=${ids.join(',')}`); }
  async getAlbum(id) { return this.request(`/albums/${id}`); }
  async getArtist(id) { return this.request(`/artists/${id}`); }
  async getArtistTopTracks(id) { return this.request(`/artists/${id}/top-tracks`); }
  async getArtistAlbums(id) { return this.request(`/artists/${id}/albums`); }
  async getPlaylist(id) { return this.request(`/playlists/${id}`); }

  async getRecommendations({ seedArtists, seedGenres, seedTracks, limit = 20 } = {}) {
    const params = { limit };
    if (seedArtists) params.seed_artists = seedArtists;
    if (seedGenres) params.seed_genres = seedGenres;
    if (seedTracks) params.seed_tracks = seedTracks;
    return this.request('/recommendations', params);
  }

  async getCategories() { return this.request('/browse/categories'); }

  getPreviewAudio(previewUrl) {
    if (!previewUrl) return null;
    return new Audio(previewUrl);
  }

  formatForApp(spotifyTracks) {
    return spotifyTracks.map(t => ({
      id: `spotify_${t.id}`,
      title: t.title,
      artistId: `spotify_artist_${t.artistId}`,
      artistName: t.artistName,
      albumId: t.albumId ? `spotify_album_${t.albumId}` : null,
      albumName: t.albumName,
      duration: t.duration,
      cover: t.cover,
      coverSmall: t.coverSmall,
      mood: null,
      genre: null,
      audioUrl: null,
      previewUrl: t.previewUrl,
      spotifyUrl: t.spotifyUrl,
      isSpotify: true,
      source: 'spotify',
    }));
  }
}

export const spotify = new SpotifyService();
export default spotify;
