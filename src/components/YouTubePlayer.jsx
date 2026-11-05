import { useEffect, useRef, useState, useCallback } from 'react';
import { formatTime } from '../data/library';
import { useApp } from '../hooks/useApp';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

let ytPlayer = null;
let ytReady = false;

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    if (document.getElementById('yt-api')) {
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) { clearInterval(check); resolve(window.YT); }
      }, 100);
      return;
    }
    const tag = document.createElement('script');
    tag.id = 'yt-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      ytReady = true;
      resolve(window.YT);
    };
  });
}

export function useYouTubePlayer() {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadYouTubeAPI().then(() => setIsReady(true));
  }, []);

  const play = useCallback((videoId, { onEnd } = {}) => {
    if (!containerRef.current || !window.YT) return;

    if (ytPlayer) {
      try { ytPlayer.destroy(); } catch {} // eslint-disable-line no-empty
    }

    const divId = `yt-player-${Date.now()}`;
    const div = document.createElement('div');
    div.id = divId;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(div);

    ytPlayer = new window.YT.Player(divId, {
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: (e) => {
          e.target.playVideo();
        },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.ENDED && onEnd) {
            onEnd();
          }
        },
      },
    });
  }, []);

  const pause = useCallback(() => {
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  }, []);

  const resume = useCallback(() => {
    if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
  }, []);

  const seek = useCallback((seconds) => {
    if (ytPlayer && ytPlayer.seekTo) ytPlayer.seekTo(seconds, true);
  }, []);

  const getCurrentTime = useCallback(() => {
    if (ytPlayer && ytPlayer.getCurrentTime) return ytPlayer.getCurrentTime();
    return 0;
  }, []);

  const getDuration = useCallback(() => {
    if (ytPlayer && ytPlayer.getDuration) return ytPlayer.getDuration();
    return 0;
  }, []);

  const destroy = useCallback(() => {
    if (ytPlayer) {
      try { ytPlayer.destroy(); } catch {} // eslint-disable-line no-empty
      ytPlayer = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = '';
  }, []);

  return { containerRef, isReady, play, pause, resume, seek, getCurrentTime, getDuration, destroy };
}

export default function YouTubePlayerOverlay({ track, queue, onEnd, onClose, onNext, onPrev }) {
  const { containerRef, isReady, play, pause, resume, seek, getCurrentTime, getDuration, destroy } = useYouTubePlayer();
  const {
    registerYouTubeControl,
    reportYouTubePlayback,
  } = useApp();
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef(null);
  const timerRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    // play() no-ops until window.YT exists, so the first selection would
    // otherwise be dropped while the IFrame API is still loading.
    if (track?.videoId && isReady) {
      play(track.videoId, {
        onEnd: () => {
          if (onNext) onNext();
          else if (onEnd) onEnd();
        }
      });
      setPlaying(true);
      setCurrentTime(0);
    }
    // Only the player is torn down here. The progress interval is owned by
    // the timer effect below, so clearing it would freeze the readout when
    // this effect re-runs on the isReady flip.
    return () => { destroy(); };
  }, [track?.videoId, isReady]);

  // Hand this player's controls to the main music bar. The transport lives in
  // the MiniPlayer now, so the overlay is video-only and does not render a
  // second row of playback controls.
  useEffect(() => {
    registerYouTubeControl({
      toggle: () => {
        if (playing) pause();
        else resume();
        setPlaying(!playing);
      },
      seek: (seconds) => seek(seconds),
      getCurrentTime,
      getDuration,
      destroy,
    });
    return () => registerYouTubeControl(null);
  }, [registerYouTubeControl, playing, pause, resume, seek, getCurrentTime, getDuration, destroy]);

  useEffect(() => {
    if (!overlayRef.current || prefersReduced || !track) return;
    gsap.fromTo(overlayRef.current,
      { y: 40, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.2)', overwrite: 'auto' }
    );
  }, [track?.videoId]);

  useEffect(() => {
    if (!playing) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      const t = getCurrentTime();
      const d = getDuration();
      setCurrentTime(t);
      setDuration(d);
      reportYouTubePlayback({ isPlaying: true, currentTime: t, duration: d });
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [playing, getCurrentTime, getDuration, reportYouTubePlayback]);

  // Keep the reported state truthful while paused, so the MiniPlayer does not
  // show a stale "playing" indicator.
  useEffect(() => {
    if (playing) return;
    reportYouTubePlayback({ isPlaying: false, currentTime, duration });
  }, [playing, currentTime, duration, reportYouTubePlayback]);

  const handleSeek = (e) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    seek(pct * duration);
  };

  if (!track) return null;

  return (
    <div ref={overlayRef} className="fixed bottom-20 left-4 right-4 z-50 bg-surface-card rounded-2xl border border-border-subtle shadow-2xl p-3">
      <div
        ref={containerRef}
        className="w-full aspect-video max-h-[38vh] rounded-xl overflow-hidden bg-black mb-3"
        title={track.title}
      >
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-on-surface truncate">{track.title}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{track.artistName}</p>
        </div>
        <span className="text-[9px] bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full font-medium shrink-0">Video</span>
        <button
          onClick={() => { destroy(); onClose?.(); }}
          aria-label="Hide video"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface active:text-red-400 shrink-0 press-feedback"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Seeking stays here because it needs the visible video surface; play,
          next and previous live in the shared MiniPlayer. */}
      <div className="mt-2 px-1">
        <div
          ref={progressRef}
          onClick={handleSeek}
          onTouchEnd={(e) => {
            const touch = e.changedTouches[0];
            handleSeek({ clientX: touch.clientX });
          }}
          style={{ touchAction: 'none' }}
          className="w-full h-3 flex items-center cursor-pointer group relative"
        >
          <div className="w-full h-1.5 bg-on-surface/10 rounded-full relative overflow-visible">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-lg pointer-events-none opacity-100 group-active:scale-125 transition-transform" style={{ left: duration ? `calc(${(currentTime / duration) * 100}% - 8px)` : '-8px' }} />
          </div>
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-on-surface-variant">{formatTime(Math.floor(currentTime))}</span>
          <span className="text-[10px] text-on-surface-variant">{duration ? formatTime(Math.floor(duration)) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
}
