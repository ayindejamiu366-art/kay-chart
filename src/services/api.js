import { API_BASE } from '../config';

function getCurrentLang() {
  try { return localStorage.getItem('nocturne_language') || 'en'; } catch { return 'en'; }
}

function addLang(url) {
  const lang = getCurrentLang();
  if (!lang || lang === 'en') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}lang=${lang}`;
}

class ApiClient {
  constructor() {
    this.token = (() => {
      try { return localStorage.getItem('nocturne_token') || null; } catch { return null; }
    })();
  }

  setToken(token) {
    this.token = token;
     try {
      if (token) localStorage.setItem('nocturne_token', token);
      else localStorage.removeItem('nocturne_token');
    } catch { /* localStorage unavailable */ }
  }

  async getToken() {
    return this.token;
  }

  async request(method, path, body = null) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = {};
    if (!isForm) headers['Content-Type'] = 'application/json';
    
    const token = await this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body && method !== 'GET') config.body = isForm ? body : JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, config);
    let data;
    try { data = await res.json(); } catch { data = { error: `Server returned ${res.status}` }; }
    if (!res.ok) {
      // Preserve the machine-readable `code` and the HTTP status so callers can
      // distinguish, for example, a duplicate email from a wrong password
      // without having to match on the human-readable message.
      const error = new Error(data.error || 'Request failed');
      error.status = res.status;
      error.code = data.code || null;
      throw error;
    }
    return data;
  }

  get(path) { return this.request('GET', addLang(path)); }
  post(path, body) { return this.request('POST', path, body); }
  del(path) { return this.request('DELETE', path); }

  async getMe() { return this.get('/auth/me'); }
  async updateProfile(data) { return this.post('/auth/update-profile', data); }
  async updateRole(userId, role) { return this.post('/auth/update-role', { userId, role }); }
  async changePassword(currentPassword, newPassword) { return this.post('/auth/change-password', { currentPassword, newPassword }); }
  async updateAvatar(avatar) { return this.post('/auth/update-avatar', { avatar }); }
  async getUserStats() { return this.get('/auth/users/stats'); }
  async getAllUsers() { return this.get('/auth/users'); }

  async getSongs(params = {}) {
    const lang = getCurrentLang();
    if (lang && lang !== 'en') params.lang = lang;
    const qs = new URLSearchParams(params).toString();
    return this.get('/songs' + (qs ? '?' + qs : ''));
  }
  async getPendingSongs() { return this.get('/songs/pending'); }
  async getMyUploads() { return this.get('/songs/artist'); }
  async getSong(id) { return this.get(`/songs/${id}`); }
  async uploadSong({ track, audioFile, coverFile }) {
    const form = new FormData();
    Object.entries(track).forEach(([key, value]) => { if (value !== undefined && value !== null) form.append(key, String(value)); });
    form.append('audio', audioFile);
    if (coverFile) form.append('cover', coverFile);
    return this.request('POST', '/songs', form);
  }
  async approveSong(id) { return this.post(`/songs/${id}/approve`); }
  async rejectSong(id) { return this.post(`/songs/${id}/reject`); }
  async deleteSong(id) { return this.del(`/songs/${id}`); }

  async getPlaylists() { return this.get('/playlists'); }
  async getPlaylist(id) { return this.get(`/playlists/${id}`); }
  async createPlaylist(data) { return this.post('/playlists', data); }
  async addSongsToPlaylist(id, songIds) { return this.post(`/playlists/${id}/songs`, { songIds }); }
  async deletePlaylist(id) { return this.del(`/playlists/${id}`); }

  async getLikedSongs() { return this.get('/library/liked'); }
  async toggleLike(songId) { return this.post(`/library/liked/${songId}`); }
  async getLikedIds() { return this.get('/library/liked/check'); }
  async getDownloads() { return this.get('/library/downloads'); }
  async toggleDownload(songId) { return this.post(`/library/downloads/${songId}`); }
  getDownloadUrl(songId) { return `${API_BASE}/stream/${encodeURIComponent(songId)}/download`; }
  async getHistory() { return this.get('/library/history'); }
  async addHistory(songId) { return this.post(`/library/history/${songId}`); }
  async getRecent() { return this.get('/library/recent'); }
  async getRecommendations() { return this.get('/library/recommendations'); }
  async getNotifications() { return this.get('/library/notifications'); }
  async markNotificationRead(id) { return this.post(`/library/notifications/${id}/read`); }
  async markAllRead() { return this.post('/library/notifications/read-all'); }
  async getStats() { return this.get('/library/stats'); }

  // OTP
  async generateOTP(email, purpose = 'signup', pendingToken = null) {
    const body = { email, purpose };
    if (pendingToken) body.pendingToken = pendingToken;
    return this.post('/auth/otp/generate', body);
  }
  async verifyOTP(email, code, purpose = 'signup', pendingToken = null) {
    const body = { email, code, purpose };
    if (pendingToken) body.pendingToken = pendingToken;
    return this.post('/auth/otp/verify', body);
  }
  async signinRequest(email, password) {
    return this.post('/auth/signin', { email, password });
  }
  async signupRequest(name, email, password, role = 'user') {
    return this.post('/auth/signup', { name, email, password, role });
  }
  // Password reset: request a `reset` OTP, verify it for a short-lived token,
  // then set the new password. `resetToken` is not a session token and cannot
  // be used on authenticated endpoints.
  async requestPasswordReset(email) {
    return this.post('/auth/otp/generate', { email, purpose: 'reset' });
  }
  async verifyPasswordResetCode(email, code) {
    return this.post('/auth/otp/verify', { email, code, purpose: 'reset' });
  }
  async confirmPasswordReset(resetToken, newPassword) {
    return this.post('/auth/password-reset/confirm', { resetToken, newPassword });
  }
  // `credential` is a Firebase ID token from the Google popup sign-in flow.
  async googleSignIn(credential) {
    return this.post('/auth/google', { credential });
  }

  // First-time onboarding completion, stored on the user's preferences row.
  async setOnboardingCompleted(completed = true) {
    return this.post('/auth/onboarding', { completed });
  }

  // --- Celebrations ---
  // `date` is the browser's local calendar day: celebration windows should open
  // in the listener's own evening, not the server's.
  async getActiveCelebrations({ date, countryCode, subdivisionCode, windowDays } = {}) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (countryCode) params.set('countryCode', countryCode);
    if (subdivisionCode) params.set('subdivisionCode', subdivisionCode);
    if (windowDays) params.set('windowDays', String(windowDays));
    const qs = params.toString();
    return this.get(`/celebrations/active${qs ? `?${qs}` : ''}`);
  }

  // --- Profile setup (separate from the welcome tour) ---
  async getProfileSetup() { return this.get('/profile/setup'); }
  async saveProfileSetup(patch) { return this.post('/profile/setup', patch); }
  async completeProfileSetup() { return this.post('/profile/setup/complete', {}); }
  async getSetupGenres() { return this.get('/profile/options/genres'); }
  async getSetupArtists() { return this.get('/profile/options/artists'); }
  // Always resolves with { available, reason? } so the field can render inline
  // feedback instead of an exception. The endpoint answers 200 for both cases.
  async checkUsername(username) {
    try {
      const result = await this.get(`/profile/username-available?username=${encodeURIComponent(username)}`);
      return { available: !!result.available, reason: result.reason || null, error: result.error || null };
    } catch (error) {
      return { available: false, reason: 'error', error: error.message };
    }
  }
  async uploadProfileAvatar(file) {
    const form = new FormData();
    form.append('avatar', file);
    return this.post('/profile/avatar', form);
  }
  async removeProfileAvatar() { return this.post('/profile/avatar/remove', {}); }

  async getAlbums() { return this.get('/albums'); }
  async getAlbum(id) { return this.get(`/albums/${id}`); }

  async getArtists() { return this.get('/artists'); }
  async getArtist(id) { return this.get(`/artists/${id}`); }

  // Social
  social = {
    follow: (userId) => this.post(`/social/follow/${userId}`),
    checkFollow: (userIds) => this.post('/social/follow/check', { userIds }),
    getFollowers: (userId) => this.get(`/social/followers/${userId}`),
    getFollowing: (userId) => this.get(`/social/following/${userId}`),
    getCounts: (userId) => this.get(`/social/counts/${userId}`),
    getFeed: (limit = 30, offset = 0) => this.get(`/social/feed?limit=${limit}&offset=${offset}`),
    getUserFeed: (userId, limit = 30) => this.get(`/social/feed/${userId}?limit=${limit}`),
    searchUsers: (q) => this.get(`/social/users/search?q=${encodeURIComponent(q)}`),
    getSuggestions: () => this.get('/social/suggestions'),
  };

  // Analytics
  analytics = {
    recordPlay: (songId) => this.post(`/analytics/play/${songId}`),
    getPlays: (songIds) => {
      if (!songIds || !songIds.length) return Promise.resolve({});
      return this.get(`/analytics/plays?songIds=${songIds.join(',')}`);
    },
    getTopSongs: (limit = 20) => this.get(`/analytics/top-songs?limit=${limit}`),
    getTopArtists: (limit = 10) => this.get(`/analytics/top-artists?limit=${limit}`),
    getPlatform: () => this.get('/analytics/platform'),
    getUserStats: () => this.get('/analytics/user'),
    getArtistStats: () => this.get('/analytics/artist'),
    getGenres: () => this.get('/analytics/genres'),
  };

  signOut() {
    this.token = null;
    try {
      localStorage.removeItem('nocturne_token');
      localStorage.removeItem('nocturne_user');
    } catch { /* localStorage unavailable */ }
  }
}

export const api = new ApiClient();
export default api;
