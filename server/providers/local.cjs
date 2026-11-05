/**
 * Local Music Provider Adapter
 * Serves tracks uploaded directly to Nocturne.
 */

const CircuitBreaker = require('./circuit-breaker.cjs');
const db = require('../db.cjs');
const fs = require('fs');
const path = require('path');

const UPLOADS_AUDIO_DIR = path.join(__dirname, '..', '..', 'uploads', 'audio');

class LocalProvider {
  constructor(config = {}) {
    this._config = config;
    this._breaker = new CircuitBreaker('local');
  }
  get name() { return 'local'; }
  get capabilities() {
    return ['search', 'artist_lookup', 'album_lookup', 'track_lookup', 'trending', 'artwork', 'full_playback'];
  }
  get supportsFullTracks() { return true; }
  get supportsPreview() { return true; }

  /**
   * Check if a local track has an actual playable audio file on disk.
   * This prevents demo/seed tracks without audio files from appearing
   * in search, trending, and Home results.
   */
  _hasAudioFile(song) {
    if (!song.audio_url || !song.audio_url.startsWith('/uploads/audio/')) return false;
    const filePath = path.join(UPLOADS_AUDIO_DIR, path.basename(song.audio_url));
    return fs.existsSync(filePath);
  }

  async healthCheck() {
    try {
      const count = db.prepare("SELECT COUNT(*) as c FROM songs WHERE status = 'approved'").get().c;
      const audioCount = db.prepare(`
        SELECT COUNT(*) as c FROM songs
        WHERE status = 'approved' AND audio_url IS NOT NULL AND audio_url != ''
        AND audio_url LIKE '/uploads/audio/%'
      `).get().c;
      this._breaker.recordSuccess();
      return { healthy: true, responseMs: 0, trackCount: count, audioFileCount: audioCount };
    } catch (e) {
      this._breaker.recordFailure();
      return { healthy: false, error: e.message };
    }
  }

  _normalizeSong(s) {
    if (!s) return null;
    const hasAudio = this._hasAudioFile(s);
    return {
      id: `local_${s.id}`,
      providerTrackId: String(s.id),
      title: s.title || 'Untitled',
      artistName: s.artist_name || 'Unknown',
      artistId: s.artist_id ? `local_${s.artist_id}` : null,
      albumName: s.album_name || '',
      albumId: s.album_id ? `local_${s.album_id}` : null,
      cover: s.cover || null,
      duration: s.duration || 0,
      genre: s.genre || '',
      country: '',
      popularity: 0,
      playCount: 0,
      previewUrl: null,
      streamUrl: hasAudio ? `/api/stream/${s.id}` : null,
      externalUrl: null,
      isPlayable: hasAudio,
      playbackType: hasAudio ? 'full' : 'unavailable',
      previewOnly: false,
      provider: 'local',
      rank: 0,
      explicit: false,
      hasAudioFile: hasAudio,
    };
  }

  _normalizeArtist(a) {
    if (!a) return null;
    return {
      id: `local_${a.id}`,
      providerArtistId: String(a.id),
      name: a.name || 'Unknown',
      photo: a.photo || null,
      nbFans: a.listeners || 0,
      nbAlbums: 0,
      genres: JSON.parse(a.genres || '[]'),
      isVerified: !!a.verified,
      provider: 'local',
    };
  }

  _normalizeAlbum(a) {
    if (!a) return null;
    return {
      id: `local_${a.id}`,
      title: a.title || 'Untitled',
      artistName: a.artist_name || '',
      artistId: a.artist_id ? `local_${a.artist_id}` : null,
      cover: a.cover || null,
      year: a.year || null,
      trackCount: 0,
      provider: 'local',
    };
  }

  async searchTracks(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const rows = db.prepare(`
        SELECT s.* FROM songs s
        WHERE s.status = 'approved'
        AND (s.title LIKE ? OR s.artist_name LIKE ? OR s.album_name LIKE ?)
        AND s.audio_url IS NOT NULL AND s.audio_url != '' AND s.audio_url LIKE '/uploads/audio/%'
        LIMIT ?
      `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit);
      this._breaker.recordSuccess();
      return rows.map(s => this._normalizeSong(s));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getTrack(trackId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(trackId).replace('local_', '');
      const s = db.prepare("SELECT * FROM songs WHERE id = ? AND status = 'approved'").get(rawId);
      this._breaker.recordSuccess();
      return this._normalizeSong(s);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getTrendingTracks(limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rows = db.prepare(`
        SELECT s.*, COALESCE(pc.count, 0) as play_count
        FROM songs s LEFT JOIN play_counts pc ON s.id = pc.song_id
        WHERE s.status = 'approved'
        AND s.audio_url IS NOT NULL AND s.audio_url != '' AND s.audio_url LIKE '/uploads/audio/%'
        ORDER BY pc.count DESC NULLS LAST LIMIT ?
      `).all(limit);
      this._breaker.recordSuccess();
      return rows.map(s => this._normalizeSong(s));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getPopularTracks(limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async getTracksByGenre(genreId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rows = db.prepare(`
        SELECT * FROM songs WHERE status = 'approved' AND genre LIKE ?
        AND audio_url IS NOT NULL AND audio_url != '' AND audio_url LIKE '/uploads/audio/%'
        LIMIT ?
      `).all(`%${genreId}%`, limit);
      this._breaker.recordSuccess();
      return rows.map(s => this._normalizeSong(s));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getTracksByCountry(countryCode, limit = 20) {
    return this.getTrendingTracks(limit);
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const rows = db.prepare("SELECT * FROM artists WHERE name LIKE ? LIMIT ?").all(`%${query}%`, limit);
      this._breaker.recordSuccess();
      return rows.map(a => this._normalizeArtist(a));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getArtist(artistId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(artistId).replace('local_', '');
      const a = db.prepare("SELECT * FROM artists WHERE id = ?").get(rawId);
      this._breaker.recordSuccess();
      return this._normalizeArtist(a);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getArtistTopTracks(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('local_', '');
      const rows = db.prepare(`
        SELECT s.*, COALESCE(pc.count, 0) as play_count
        FROM songs s LEFT JOIN play_counts pc ON s.id = pc.song_id
        WHERE s.artist_id = ? AND s.status = 'approved'
        AND s.audio_url IS NOT NULL AND s.audio_url != '' AND s.audio_url LIKE '/uploads/audio/%'
        ORDER BY pc.count DESC NULLS LAST LIMIT ?
      `).all(rawId, limit);
      this._breaker.recordSuccess();
      return rows.map(s => this._normalizeSong(s));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getArtistAlbums(artistId, limit = 20) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(artistId).replace('local_', '');
      const rows = db.prepare(`
        SELECT DISTINCT album_id, album_name, artist_name, cover
        FROM songs WHERE artist_id = ? AND status = 'approved' AND album_id IS NOT NULL
        LIMIT ?
      `).all(rawId, limit);
      this._breaker.recordSuccess();
      return rows.map(a => this._normalizeAlbum({ id: a.album_id, title: a.album_name, artist_name: a.artist_name, cover: a.cover }));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async searchAlbums(query, limit = 20) {
    if (!query) return [];
    if (!this._breaker.canExecute()) return [];
    try {
      const rows = db.prepare(`
        SELECT DISTINCT album_id, album_name, artist_name, cover
        FROM songs WHERE status = 'approved' AND album_name LIKE ? LIMIT ?
      `).all(`%${query}%`, limit);
      this._breaker.recordSuccess();
      return rows.map(a => this._normalizeAlbum({ id: a.album_id, title: a.album_name, artist_name: a.artist_name, cover: a.cover }));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getAlbum(albumId) {
    if (!this._breaker.canExecute()) return null;
    try {
      const rawId = String(albumId).replace('local_', '');
      const row = db.prepare("SELECT * FROM albums WHERE id = ?").get(rawId);
      this._breaker.recordSuccess();
      return this._normalizeAlbum(row);
    } catch (e) { this._breaker.recordFailure(); return null; }
  }

  async getAlbumTracks(albumId, limit = 50) {
    if (!this._breaker.canExecute()) return [];
    try {
      const rawId = String(albumId).replace('local_', '');
      const rows = db.prepare(`
        SELECT s.* FROM songs s
        JOIN album_songs ast ON s.id = ast.song_id
        WHERE ast.album_id = ? AND s.status = 'approved'
        AND s.audio_url IS NOT NULL AND s.audio_url != '' AND s.audio_url LIKE '/uploads/audio/%'
        ORDER BY ast.position LIMIT ?
      `).all(rawId, limit);
      this._breaker.recordSuccess();
      return rows.map(s => this._normalizeSong(s));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }

  async getGenres() {
    if (!this._breaker.canExecute()) return [];
    try {
      const rows = db.prepare("SELECT DISTINCT genre FROM songs WHERE status = 'approved' AND genre IS NOT NULL AND genre != ''").all();
      this._breaker.recordSuccess();
      return rows.map(r => ({ id: r.genre, name: r.genre }));
    } catch (e) { this._breaker.recordFailure(); return []; }
  }
}

module.exports = { LocalProvider };
