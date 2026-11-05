import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../config';

function getAudioQuality() {
  try { return localStorage.getItem('nocturne_audio_quality') || 'high'; } catch { return 'high'; }
}

// Perceptual (equal-loudness) volume mapping: slider is linear 0..1,
// human loudness perception is roughly logarithmic. Squaring keeps quiet
// levels usable and avoids the "everything happens between 0.8-1.0" feel
// of a linear fader, and reduces accidental clipping near max.
function perceptualGain(v) {
  const clamped = Math.min(1, Math.max(0, v));
  return clamped * clamped;
}

function resolveAudioSrc(track, quality) {
  if (!track) return null;

  const id = track.id || '';
  const q = quality || getAudioQuality();

  // Audius: route through the same-origin proxy when enhancements are on.
  // The proxy is bit-transparent but same-origin, so the Web Audio graph
  // (EQ/compressor/gain) can process it. A direct cross-origin CDN URL
  // without CORS headers would go silent once connected to an
  // AudioContext, so only use it for 'normal' (bypass) mode.
  if (/^audius_/.test(id)) {
    if (q !== 'normal') return `${API_BASE}/stream/${encodeURIComponent(id)}`;
    if (track.streamUrl) return track.streamUrl;
    return `${API_BASE}/stream/${encodeURIComponent(id)}`;
  }

  // Deezer/Spotify: use preview URL directly (CDN, no proxy needed)
  if (/^(deezer|spotify)_/.test(id)) {
    if (track.audioUrl) return track.audioUrl;
    if (track.previewUrl) return track.previewUrl;
    return null;
  }

  // Local tracks
  if (track.audioUrl) return track.audioUrl;
  if (track.streamUrl && track.streamUrl.startsWith('/')) return `${API_BASE}${track.streamUrl}`;
  if (track.streamUrl) return track.streamUrl;
  if (track.previewUrl) return track.previewUrl;
  return `${API_BASE}/stream/${encodeURIComponent(id)}`;
}

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });
  const valueRef = useRef(storedValue);
  valueRef.current = storedValue;

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(valueRef.current) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === key && e.newValue) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  return [storedValue, setValue];
}
export function useAudio() {
  const audioRef = useRef(null);
  // Web Audio enhancement chain (created lazily on first user gesture):
  // source -> EQ (3-band, flat by default) -> compressor (loudness
  // consistency across providers, anti-clip) -> gain (perceptual volume)
  // -> destination. Flat EQ = no coloration; the audible wins are the
  // gentle compressor (tames loud/quiet master differences between
  // Audius uploads and Deezer previews) and the limiter-like ceiling.
  const ctxRef = useRef(null);
  const graphRef = useRef(null); // { source, eqLow, eqMid, eqHigh, comp, gain }
  const [enhanced, setEnhanced] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = perceptualGain(volume);
      // 'auto' buffers more aggressively than 'metadata', reducing
      // rebuffer stalls (perceived as quality drops) on slow networks.
      audioRef.current.preload = 'auto';
      // Keep natural pitch on any rate changes; prevents chipmunk artifacts.
      try { audioRef.current.preservesPitch = true; } catch { /* unsupported browser */ }
      // Allows same-origin + CORS-enabled sources to feed the Web Audio graph.
      try { audioRef.current.crossOrigin = 'anonymous'; } catch { /* unsupported browser */ }
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => handleNextRef.current();
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const onLoadStart = () => setIsLoading(true);
    const onError = () => {
      setError('Failed to load audio');
      setIsLoading(false);
    };
    const onCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  // Transparent bypass: keep the graph connected (a MediaElementSource
  // permanently reroutes its element, so disconnecting would silence all
  // later playback) but flatten every stage: 0dB EQ, 1:1 compressor, unity
  // gain staging. Output stays bit-transparent 32-bit float passthrough.
  const setGraphBypass = useCallback((bypass) => {
    const g = graphRef.current;
    if (!g) return;
    try {
      g.eqLow.gain.value = 0;
      g.eqMid.gain.value = 0;
      g.eqHigh.gain.value = 0;
      g.comp.threshold.value = bypass ? 0 : -18;
      g.comp.ratio.value = bypass ? 1 : 3;
    } catch { /* keep existing stage values on failure */ }
  }, []);

  // Build (or re-activate) the enhancement graph. Must be called within a
  // user gesture at least once (AudioContext autoplay policy). Returns true
  // when the graph is active. Safe to call repeatedly; reuses nodes.
  const ensureEnhancementChain = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const audio = audioRef.current;
      if (!AC || !audio) return false;
      if (getAudioQuality() === 'normal') {
        // Bypass mode: transparent graph (if one exists) + perceptual volume
        // on the element. Graph still passes audio through unchanged.
        setGraphBypass(true);
        if (!graphRef.current) audio.volume = perceptualGain(volumeRef.current);
        else {
          audio.volume = 1;
          try { graphRef.current.gain.gain.value = perceptualGain(volumeRef.current); } catch { /* graph torn down mid-update */ }
        }
        setEnhanced(false);
        return false;
      }
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => { /* resume on next gesture */ });
      if (!graphRef.current) {
        const source = ctx.createMediaElementSource(audio);
        const eqLow = ctx.createBiquadFilter();
        eqLow.type = 'lowshelf'; eqLow.frequency.value = 120; eqLow.gain.value = 0;
        const eqMid = ctx.createBiquadFilter();
        eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 0.8; eqMid.gain.value = 0;
        const eqHigh = ctx.createBiquadFilter();
        eqHigh.type = 'highshelf'; eqHigh.frequency.value = 8000; eqHigh.gain.value = 0;
        const comp = ctx.createDynamicsCompressor();
        // Gentle mastering-style glue: evens out loud/quiet masters across
        // providers without audible pumping.
        comp.threshold.value = -18;
        comp.knee.value = 20;
        comp.ratio.value = 3;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        const gain = ctx.createGain();
        gain.gain.value = perceptualGain(volumeRef.current);
        source.connect(eqLow);
        eqLow.connect(eqMid);
        eqMid.connect(eqHigh);
        eqHigh.connect(comp);
        comp.connect(gain);
        gain.connect(ctx.destination);
        graphRef.current = { source, eqLow, eqMid, eqHigh, comp, gain };
      } else {
        // Graph exists: re-activate enhancement stages (undo any bypass).
        setGraphBypass(false);
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      }
      // Element at full scale; the GainNode owns the volume curve now.
      audio.volume = 1;
      if (graphRef.current) graphRef.current.gain.gain.value = perceptualGain(volumeRef.current);
      setEnhanced(true);
      return true;
    } catch {
      return false;
    }
  }, [setGraphBypass]);

  const play = useCallback(async (track, newQueue) => {
    if (!track) return;
    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    } else if (queue.length === 0) {
      setQueue([track]);
      setQueueIndex(0);
    }
    setCurrentTrack(track);
    setCurrentTime(0);
    setError(null);
    setIsLoading(true);

    if (audioRef.current) {
      // Quality-aware source: 'high'/'lossless' routes Audius through the
      // same-origin proxy so the Web Audio graph can process it CORS-safely.
      const src = resolveAudioSrc(track, getAudioQuality());

      // External tracks (no playable audio URL): do NOT set audio src to null.
      // Opening the external link is handled by the caller (playSong/playTrack).
      // The player stays in its current state rather than creating a broken element.
      if (!src) {
        setIsLoading(false);
        setError('No playable audio available');
        setCurrentTrack(track);
        return;
      }

      // Build the enhancement graph inside the click gesture (autoplay
      // policy). If it fails/unavailable, plain element playback continues.
      ensureEnhancementChain();

      // IMPORTANT: start playback SYNCHRONOUSLY within the user's click gesture.
      // Awaiting any async work (e.g. a Spotify lookup) before `play()` consumes
      // the user gesture and Chrome rejects the play() with NotAllowedError
      // (autoplay blocked). So we always kick off the default source immediately.
      audioRef.current.src = src;
      audioRef.current.load();
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error('Audio play() failed:', err);
        setIsPlaying(false);
        setIsLoading(false);
        setError('Audio unavailable');
        return;
      }
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artistName,
        album: track.albumName || '',
        artwork: track.cover ? [{ src: track.cover, sizes: '300x300', type: 'image/jpeg' }] : [],
      });
    }
  }, [queue, ensureEnhancementChain]);

  const togglePlay = useCallback(() => {
    if (!currentTrack && queue.length > 0) {
      play(queue[0]);
      return;
    }
    if (!currentTrack) return;
    // External/unavailable tracks: togglePlay does nothing — they are not
    // played through the audio element.
    if (currentTrack.playbackType === 'external' || currentTrack.playbackType === 'unavailable') return;
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (ctxRef.current && ctxRef.current.state === 'suspended') {
          ctxRef.current.resume().catch(() => { /* resume on next gesture */ });
        }
        audioRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(prev => !prev);
  }, [currentTrack, queue, isPlaying, play]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    if (repeat === 'one') {
      if (audioRef.current && currentTrack && currentTrack.playbackType !== 'external' && currentTrack.playbackType !== 'unavailable') {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setCurrentTime(0);
      return;
    }
    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          return;
        }
      }
    }
    setQueueIndex(nextIndex);
    const nextTrack = queue[nextIndex];
    setCurrentTrack(nextTrack);
    setCurrentTime(0);
    setError(null);
    if (audioRef.current && nextTrack) {
      const src = resolveAudioSrc(nextTrack, getAudioQuality());
      if (!src) {
        // External/unavailable track — do not create broken audio element
        setIsPlaying(false);
        return;
      }
      audioRef.current.src = src;
      audioRef.current.load();
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
    setIsPlaying(true);

    if ('mediaSession' in navigator && nextTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nextTrack.title,
        artist: nextTrack.artistName,
        album: nextTrack.albumName || '',
        artwork: nextTrack.cover ? [{ src: nextTrack.cover, sizes: '300x300', type: 'image/jpeg' }] : [],
      });
    }
  }, [queue, queueIndex, shuffle, repeat]);

  const handlePrev = useCallback(() => {
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (queue.length === 0) return;
    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;
    setQueueIndex(prevIndex);
    const prevTrack = queue[prevIndex];
    setCurrentTrack(prevTrack);
    setCurrentTime(0);
    setError(null);
    if (audioRef.current && prevTrack) {
      const src = resolveAudioSrc(prevTrack, getAudioQuality());
      if (!src) {
        setIsPlaying(false);
        return;
      }
      audioRef.current.src = src;
      audioRef.current.load();
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
    setIsPlaying(true);
  }, [queue, queueIndex, currentTime]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const toggleShuffle = useCallback(() => setShuffle(prev => !prev), []);

  const cycleRepeat = useCallback(() => {
    setRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const setVolumeLevel = useCallback((v) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolume(clamped);
    const g = perceptualGain(clamped);
    // When the enhancement graph owns the output, drive its GainNode
    // (keeps the perceptual curve exact); otherwise set the element volume.
    if (graphRef.current) {
      try { graphRef.current.gain.gain.value = g; } catch { /* graph torn down mid-update */ }
      if (audioRef.current) audioRef.current.volume = 1;
    } else if (audioRef.current) {
      audioRef.current.volume = g;
    }
  }, []);

  // 3-band EQ adjustment in dB (-12..+12). Flat (0/0/0) by default.
  const setEqualizer = useCallback((low, mid, high) => {
    const g = graphRef.current;
    if (!g) return false;
    try {
      if (low != null) g.eqLow.gain.value = Math.min(12, Math.max(-12, low));
      if (mid != null) g.eqMid.gain.value = Math.min(12, Math.max(-12, mid));
      if (high != null) g.eqHigh.gain.value = Math.min(12, Math.max(-12, high));
      return true;
    } catch { return false; }
  }, []);

  const removeFromQueue = useCallback((index) => {
    setQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(index, 1);
      return newQueue;
    });
    setQueueIndex(prev => index < prev ? prev - 1 : prev);
  }, []);

  const addToQueue = useCallback((track) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const playNext = useCallback((track) => {
    setQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(queueIndex + 1, 0, track);
      return newQueue;
    });
  }, [queueIndex]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      if (audioRef.current) audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
    navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset || 10));
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + (details.seekOffset || 10));
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
    };
  }, [handlePrev, handleNext, duration]);

  // Keep a ref to the latest handleNext so the `ended` listener registered in the
  // mount-only effect above (which must stay [] to avoid recreating the Audio
  // element) never calls a stale closure over the initial (empty) queue/state.
  const handleNextRef = useRef(handleNext);
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  return {
    currentTrack, isPlaying, queue, queueIndex, shuffle, repeat, volume,
    currentTime, duration, isLoading, error, enhanced,
    play, togglePlay, handleNext, handlePrev, seek,
    toggleShuffle, cycleRepeat, setVolumeLevel, setEqualizer,
    removeFromQueue, addToQueue, playNext, setQueue, setCurrentTrack,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handler = (e) => setIsOnline(e.type === 'online');
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);
  return isOnline;
}
