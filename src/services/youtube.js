import { API_BASE } from '../config';

class YouTubeService {
  async request(endpoint, params = {}, timeoutMs = 15000) {
    const url = new URL(`${API_BASE}/youtube${endpoint}`, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`YouTube request failed: ${res.status}`);
    return res.json();
  }

  // Scraped videos carry no playbackType, so every consumer's routing (which
  // switches on it) would treat them as unavailable. Tag them here, once.
  normalize(tracks) {
    return (Array.isArray(tracks) ? tracks : []).map(t => (
      t && t.videoId ? { ...t, playbackType: 'youtube', provider: 'youtube' } : t
    ));
  }

  async search(query, limit = 20) {
    const data = await this.request('/search', { q: query, limit }, 20000);
    return this.normalize(data.tracks);
  }

  async searchArtist(artistName, limit = 50) {
    const data = await this.request('/artist', { name: artistName, limit }, 30000);
    return this.normalize(data.tracks);
  }

  async searchMore(query, continuation, limit = 20) {
    const data = await this.request('/search/more', { q: query, continuation, limit });
    return { tracks: this.normalize(data.tracks), nextContinuation: data.nextContinuation };
  }

  // Map a catalogue track onto the best-matching video, or null when nothing
  // scores high enough to be trusted. Callers fall back on null.
  async resolve(title, artist = '', duration = 0) {
    const data = await this.request('/resolve', { title, artist, duration }, 20000);
    return this.normalize([data.track])[0] || null;
  }

  getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;
  }

  // A real audio source for a song currently playing as video, or null when the
  // song has no audio alternative (the embed itself cannot be played muted).
  async audioAlternative(title, artist = '') {
    const data = await this.request('/audio-alternative', { title, artist }, 20000);
    const track = data.track;
    if (!track) return null;
    return {
      ...track,
      videoId: null,
      playbackType: track.playbackType,
      audioUrl: track.audioUrl || track.previewUrl || track.streamUrl || null,
    };
  }

  getThumbnail(videoId, quality = 'mqdefault') {
    return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
  }
}

export const youtube = new YouTubeService();
