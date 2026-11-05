import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAudio } from './useAudio';
import { useI18n } from '../context/I18nContext';
import api from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { langVersion } = useI18n();
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nocturne_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [likedSongs, setLikedSongs] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [offlineMode, setOfflineMode] = useState(false);
  const [userPlan, setUserPlan] = useState(() => {
    try { return localStorage.getItem('nocturne_plan') || 'free'; } catch { return 'free'; }
  });
  const [allSongs, setAllSongs] = useState([]);
  const [uploadedTracks, setUploadedTracks] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const authed = useRef(false);

  const audio = useAudio();

  const isAdmin = user?.role === 'admin';
  const isArtist = user?.role === 'artist' || isAdmin;

  useEffect(() => {
    if (user) localStorage.setItem('nocturne_user', JSON.stringify(user));
    else localStorage.removeItem('nocturne_user');
  }, [user]);

  // Session restore. The app JWT is the single source of truth: there is no
  // third-party auth SDK in the boot path. If a token is stored, the server is
  // asked who it belongs to; a rejected token is discarded so a stale session
  // can never wedge the app on the loading screen.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (!api.token) {
        setLoading(false);
        setAuthChecked(true);
        return;
      }
      setLoading(true);
      try {
        const { user: freshUser } = await api.getMe();
        if (cancelled) return;
        setUser(freshUser);
        authed.current = true;
      } catch {
        if (cancelled) return;
        setUser(null);
        authed.current = false;
        api.setToken(null);
      }
      if (cancelled) return;
      setLoading(false);
      setAuthChecked(true);
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  // True only while the very first `refreshAll` is in flight, so screens that
  // read their content from this context (Library, Liked Songs, Downloads,
  // Notifications) can show a placeholder for that first load and nothing
  // afterwards. It tracks the real request: it is set when the promise starts
  // and cleared when it settles. It is deliberately NOT re-armed on later
  // refreshes, so visible content is never replaced by a skeleton in the
  // background.
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    try {
      const [songsRes, likedRes, playlistsRes, downloadsRes, recentRes, notifRes, uploadsRes, pendingRes] = await Promise.allSettled([
        api.getSongs(),
        api.getLikedIds(),
        api.getPlaylists(),
        api.getDownloads(),
        api.getRecent(),
        api.getNotifications(),
        isArtist ? api.getMyUploads() : Promise.resolve({ songs: [] }),
        isAdmin ? api.getPendingSongs() : Promise.resolve({ songs: [] }),
      ]);

      if (songsRes.status === 'fulfilled' && songsRes.value.songs) {
        setAllSongs(songsRes.value.songs);
      }
      if (likedRes.status === 'fulfilled') setLikedSongs(likedRes.value.liked || []);
      if (playlistsRes.status === 'fulfilled') setUserPlaylists(playlistsRes.value.playlists || []);
      if (downloadsRes.status === 'fulfilled') setDownloads(downloadsRes.value.songs || []);
      if (recentRes.status === 'fulfilled') setRecentlyPlayed(recentRes.value.songs || []);
      if (notifRes.status === 'fulfilled') setNotifications(notifRes.value.notifications || []);
      if (uploadsRes.status === 'fulfilled') setUploadedTracks(uploadsRes.value.songs || []);
      if (pendingRes.status === 'fulfilled') setPendingUploads(pendingRes.value.songs || []);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      // Cleared in `finally` so a failure also ends the loading state: a
      // skeleton must never persist because a request errored.
      setCollectionsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !loading) refreshAll();
  }, [user, langVersion]);

  // Re-reads the authoritative user record. Needed after profile setup finishes
  // so every consumer of `user` sees the new username/avatar/setup flags without
  // a full reload.
  const refreshUser = useCallback(async () => {
    try {
      const { user: freshUser } = await api.getMe();
      setUser(freshUser);
      return freshUser;
    } catch {
      return null;
    }
  }, []);

  // Email/password sign-in goes through the OTP flow in the SignIn/SignUp
  // screens (api.generateOTP -> /verify-otp -> api.signinRequest), so no
  // package-specific SDK is involved here either.
  const signUp = useCallback(async (name, email, password, role = 'user') => {
    try {
      const result = await api.signupRequest(name, email, password, role);
      setUser(result.user);
      authed.current = true;
      return { success: true, user: result.user };
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      const result = await api.signinRequest(email, password);
      if (result.pendingToken) return { pendingToken: result.pendingToken, success: true };
      setUser(result.user);
      authed.current = true;
      return { success: true, user: result.user };
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  // Google sign-in runs through Firebase Auth (Google provider) and is then
  // exchanged with our backend for a long-lived app JWT. Supabase is not part
  // of this flow: free Supabase projects pause after inactivity, which broke
  // the previous OAuth redirect with DNS_PROBE_FINISHED_NXDOMAIN.
  const googleSignIn = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await api.googleSignIn(idToken);
      if (!data.token) return { error: data.error || 'Google sign-in failed' };
      api.setToken(data.token);
      setUser(data.user);
      authed.current = true;
      return { success: true, isNew: data.isNew, user: data.user };
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return { error: 'Sign-in was cancelled' };
      }
      return { error: err?.message || 'Google sign-in failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Clears any Firebase session a Google sign-in may have created. Failure
      // is non-fatal: the authoritative app JWT is removed below regardless.
      try { await firebaseSignOut(auth); } catch { /* no Firebase session */ }
      api.signOut();
      try { localStorage.removeItem('nocturne_user'); } catch {} // eslint-disable-line no-empty
      setUser(null);
      setLikedSongs([]);
      setUserPlaylists([]);
      setDownloads([]);
      setRecentlyPlayed([]);
      setNotifications([]);
      setAllSongs([]);
      authed.current = false;
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, []);

  const updateRole = useCallback(async (userId, newRole) => {
    try {
      await api.updateRole(userId, newRole);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  const getAllUsersList = useCallback(async () => {
    try {
      const { users } = await api.getAllUsers();
      return users;
    } catch { return []; }
  }, []);

  const toggleLike = useCallback(async (songId) => {
    try {
      const { liked } = await api.toggleLike(songId);
      setLikedSongs(prev => {
        if (liked) return [...prev, songId];
        return prev.filter(id => id !== songId);
      });
      return liked;
    } catch (err) {
      console.error('Toggle like failed:', err);
    }
  }, []);

  const toggleDownload = useCallback(async (songId) => {
    try {
      const { downloaded } = await api.toggleDownload(songId);
      setDownloads(prev => {
        if (downloaded) {
          const song = allSongs.find(s => s.id === songId);
          if (song && !String(song.id).startsWith('spotify_')) {
            const a = document.createElement('a');
            a.href = api.getDownloadUrl(songId);
            a.download = '';
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
          return song ? [...prev, song] : prev;
        }
        return prev.filter(s => s.id !== songId);
      });
      return downloaded;
    } catch (err) {
      console.error('Toggle download failed:', err);
    }
  }, [allSongs]);

  const addRecentlyPlayed = useCallback(async (songId) => {
    try {
      api.addHistory(songId).catch(() => {});
      api.analytics.recordPlay(songId).catch(() => {});
      setRecentlyPlayed(prev => {
        const filtered = prev.filter(s => s.id !== songId);
        const song = allSongs.find(s => s.id === songId);
        if (song) return [song, ...filtered].slice(0, 20);
        return prev;
      });
    } catch (err) {
      console.error('Add history failed:', err);
    }
  }, [allSongs]);

  // YouTube plays through the official IFrame embed overlay rather than the
  // <audio> engine, so it carries its own track/queue state. App.jsx renders
  // ---- Unified playback ------------------------------------------------------
  //
  // Two engines exist: `audio` (Web Audio / <audio>) and the YouTube IFrame
  // embed. They were previously two unrelated states, so a YouTube track opened
  // its own overlay and never appeared in the MiniPlayer, the queue, or the
  // shared transport controls — the user had two competing players.
  //
  // `session` is now the single answer to "what is playing". It points at the
  // active engine and exposes one set of controls, so the app has one music
  // controller regardless of which engine is doing the work.
  const [session, setSession] = useState({ track: null, queue: [], index: -1, engine: null, videoOpen: true });

  const playYouTube = useCallback((track, queue, { videoOpen = true } = {}) => {
    if (!track || !track.videoId) return;
    const list = (Array.isArray(queue) && queue.length ? queue : [track]).filter(t => t && t.videoId);
    if (!list.length) return;
    const found = list.findIndex(t => t.id === track.id);
    setSession({ track, queue: list, index: found >= 0 ? found : 0, engine: 'youtube', videoOpen });
    if (track.id) addRecentlyPlayed(track.id);
  }, [addRecentlyPlayed]);

  const stopYouTube = useCallback(() => {
    setSession(prev => (prev.engine === 'youtube' ? { track: null, queue: [], index: -1, engine: null, videoOpen: false } : prev));
  }, []);

  // Background resolution of the remaining visible rows appends here, so a
  // queue that started as a single track grows without interrupting playback.
  const appendYouTubeQueue = useCallback((tracks) => {
    const list = (Array.isArray(tracks) ? tracks : []).filter(t => t && t.videoId);
    if (!list.length) return;
    setSession(prev => {
      if (!prev.track || prev.engine !== 'youtube') return prev;
      const have = new Set(prev.queue.map(t => t.id));
      const add = list.filter(t => !have.has(t.id));
      if (!add.length) return prev;
      return { ...prev, queue: [...prev.queue, ...add] };
    });
  }, []);

  const playYouTubeNext = useCallback(() => {
    setSession(prev => {
      if (prev.engine !== 'youtube' || !prev.queue.length) return prev;
      const next = prev.index + 1;
      if (next >= prev.queue.length) return { track: null, queue: [], index: -1, engine: null, videoOpen: false };
      return { ...prev, track: prev.queue[next], index: next };
    });
  }, []);

  const playYouTubePrev = useCallback(() => {
    setSession(prev => {
      if (prev.engine !== 'youtube' || !prev.queue.length) return prev;
      const prevIndex = prev.index - 1;
      if (prevIndex < 0) return prev;
      return { ...prev, track: prev.queue[prevIndex], index: prevIndex };
    });
  }, []);

  // Reflected into the session so the MiniPlayer and queue describe audio
  // playback too, without either component having to know about the engines.
  useEffect(() => {
    if (!audio.currentTrack) return;
    setSession(prev => {
      // Keep video active only when the audio engine is still on the same song
      // (the video→audio switch path). Starting a *different* track must hand
      // control back to the audio engine, otherwise the MiniPlayer would keep
      // showing the video while something else plays.
      if (prev.engine === 'youtube' && prev.track && prev.track.id === audio.currentTrack.id) return prev;
      const list = Array.isArray(audio.queue) && audio.queue.length ? audio.queue : [audio.currentTrack];
      const index = list.findIndex(t => t && t.id === audio.currentTrack.id);
      return { track: audio.currentTrack, queue: list, index: index >= 0 ? index : 0, engine: 'audio', videoOpen: false };
    });
  }, [audio.currentTrack, audio.queue]);

  const openVideo = useCallback(() => {
    setSession(prev => (prev.engine === 'youtube' ? { ...prev, videoOpen: true } : prev));
  }, []);

  /**
   * Stop showing the video and fall back to audio.
   *
   * The YouTube IFrame API cannot be played as audio-only — extracting its
   * audio is not something the embed permits — so this swaps the engine for a
   * real audio source for the same song when one is supplied by the caller.
   * Returns false when there is no audio alternative, so the caller can explain
   * that rather than silently doing nothing.
   */
  const useAudioInsteadOfVideo = useCallback((audioTrack) => {
    if (!audioTrack || !audioTrack.audioUrl) {
      setSession(prev => ({ ...prev, videoOpen: false }));
      return false;
    }
    const videoTrack = session.track;
    audio.play(audioTrack, [audioTrack]);
    if (videoTrack?.id) addRecentlyPlayed(videoTrack.id);
    setSession({ track: audioTrack, queue: [audioTrack], index: 0, engine: 'audio', videoOpen: false });
    return true;
  }, [audio.play, addRecentlyPlayed, session.track]);

  const closeVideo = useCallback(() => {
    setSession(prev => (prev.engine === 'youtube' ? { ...prev, videoOpen: false } : prev));
  }, []);

  // ---- YouTube engine control channel -------------------------------------
  //
  // The YT.Player instance lives inside YouTubePlayerOverlay, but the transport
  // controls belong in the MiniPlayer. The overlay registers its imperative
  // controls here and reports playback progress back, so the main music bar can
  // drive video playback exactly as it drives audio playback.
  const ytControlRef = useRef(null);
  const [ytLive, setYtLive] = useState({ isPlaying: false, currentTime: 0, duration: 0 });

  const registerYouTubeControl = useCallback((control) => {
    ytControlRef.current = control;
  }, []);

  const reportYouTubePlayback = useCallback((state) => {
    setYtLive(prev => {
      if (
        prev.isPlaying === state.isPlaying
        && prev.duration === state.duration
        && Math.abs(prev.currentTime - state.currentTime) < 0.75
      ) return prev;
      return state;
    });
  }, []);

  const toggleYouTube = useCallback(() => {
    ytControlRef.current?.toggle?.();
  }, []);

  const seekYouTube = useCallback((seconds) => {
    ytControlRef.current?.seek?.(seconds);
  }, []);

  const endYouTube = useCallback(() => {
    playYouTubeNext();
  }, [playYouTubeNext]);

  const createPlaylist = useCallback(async (name, description) => {
    try {
      const { playlist } = await api.createPlaylist({ title: name, description });
      setUserPlaylists(prev => [...prev, playlist]);
      return playlist;
    } catch (err) {
      console.error('Create playlist failed:', err);
    }
  }, []);

  const addSongsToPlaylist = useCallback(async (playlistId, songIds) => {
    try {
      await api.addSongsToPlaylist(playlistId, songIds);
      setUserPlaylists(prev => prev.map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, songIds: [...new Set([...(pl.songIds || []), ...songIds])] };
        }
        return pl;
      }));
    } catch (err) {
      console.error('Add songs failed:', err);
    }
  }, []);

  const uploadTrack = useCallback(async (trackData, audioFile, coverFile) => {
    try {
      const data = await api.uploadSong({
        track: { title: trackData.title, albumName: trackData.albumName, duration: trackData.duration, mood: trackData.mood, genre: trackData.genre },
        audioFile,
        coverFile,
      });
      return data;
    } catch (err) {
      return { error: err.message };
    }
  }, [user]);

  const approveUpload = useCallback(async (trackId) => {
    try {
      await api.approveSong(trackId);
      await refreshAll();
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }, [refreshAll]);

  const rejectUpload = useCallback(async (trackId) => {
    try {
      await api.rejectSong(trackId);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('nocturne_plan', userPlan); } catch {} // eslint-disable-line no-empty
  }, [userPlan]);

  const deleteUpload = useCallback(async (trackId) => {
    try {
      await api.deleteSong(trackId);
      await refreshAll();
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }, [refreshAll]);

  const markNotificationRead = useCallback(async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await api.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  }, []);

  const getTopGenres = useCallback(() => {
    const genreCounts = {};
    recentlyPlayed.forEach(s => {
      if (s.genre) genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1;
    });
    return Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre]) => genre);
  }, [recentlyPlayed]);

  const getTopArtists = useCallback(() => {
    const artistCounts = {};
    recentlyPlayed.forEach(s => {
      if (s.artist_id) artistCounts[s.artist_id] = (artistCounts[s.artist_id] || 0) + 1;
    });
    return Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [recentlyPlayed]);

  useEffect(() => {
    if (!audio.currentTrack) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          audio.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) audio.handleNext();
          else audio.seek(Math.min(audio.duration, audio.currentTime + 10));
          break;
        case 'ArrowLeft':
          if (e.shiftKey) audio.handlePrev();
          else audio.seek(Math.max(0, audio.currentTime - 10));
          break;
        case 'ArrowUp':
          e.preventDefault();
          audio.setVolumeLevel(Math.min(1, audio.volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          audio.setVolumeLevel(Math.max(0, audio.volume - 0.1));
          break;
        case 'KeyM':
          audio.setVolumeLevel(audio.volume > 0 ? 0 : 1);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [audio.currentTrack]);

  const value = {
    user, setUser, isAdmin, isArtist, loading, authChecked, refreshUser,
    // First-load signal for the context-backed collections (library, liked,
    // downloads, notifications). See the comment above refreshAll.
    collectionsLoading,
    signUp, signIn, googleSignIn, signOut,
    updateRole, getAllUsersList,
    likedSongs, toggleLike,
    userPlaylists, createPlaylist, addSongsToPlaylist,
    downloads, toggleDownload,
    recentlyPlayed, addRecentlyPlayed,
    notifications, markNotificationRead, markAllNotificationsRead,
    offlineMode, setOfflineMode,
    userPlan, setUserPlan,
    uploadedTracks, uploadTrack, approveUpload, rejectUpload, deleteUpload,
    pendingUploads,
    allSongs,
    audio,
    // Unified playback session: the one answer to "what is playing".
    player: session,
    videoTrack: session.engine === 'youtube' && session.videoOpen ? session.track : null,
    youtubeTrack: session.engine === 'youtube' ? session.track : null,
    youtubeQueue: session.engine === 'youtube' ? session.queue : [],
    youtubeIndex: session.engine === 'youtube' ? session.index : -1,
    // Live progress for the video engine, so the MiniPlayer can render it.
    ytLive,
    registerYouTubeControl,
    reportYouTubePlayback,
    toggleYouTube,
    seekYouTube,
    endYouTube,
    playYouTube,
    playYouTubeNext,
    playYouTubePrev,
    appendYouTubeQueue,
    stopYouTube,
    openVideo,
    closeVideo,
    useAudioInsteadOfVideo,
    getTopGenres,
    getTopArtists,
    refreshAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
