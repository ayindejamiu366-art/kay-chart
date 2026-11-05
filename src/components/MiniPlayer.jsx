import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { youtube } from '../services/youtube';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';
import { Skeleton } from './skeleton';

export default function MiniPlayer() {
  const navigate = useNavigate();
  const { audio, player, likedSongs, toggleLike, ytLive, toggleYouTube, seekYouTube, closeVideo, openVideo, useAudioInsteadOfVideo } = useApp();
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const artRef = useRef(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioNote, setAudioNote] = useState('');

  // One controller, whichever engine is active.
  const isYouTube = player.engine === 'youtube';
  const currentTrack = player.track;
  const isPlaying = isYouTube ? ytLive.isPlaying : audio.isPlaying;
  const currentTime = isYouTube ? ytLive.currentTime : audio.currentTime;
  const duration = isYouTube ? ytLive.duration : audio.duration;
  const videoOpen = isYouTube && player.videoOpen;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isLiked = likedSongs.includes(currentTrack?.id);

  // Entrance animation
  useGSAP(() => {
    if (!containerRef.current || !currentTrack) return;
    gsap.fromTo(containerRef.current,
      { opacity: 0, y: 40, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
    );
  }, { dependencies: [!!currentTrack] });

  // Album art play/pause animation
  useGSAP(() => {
    if (!artRef.current || prefersReduced) return;
    gsap.to(artRef.current, {
      scale: isPlaying ? 1 : 0.88,
      rotation: isPlaying ? '+=360' : 0,
      duration: isPlaying ? 8 : 0.4,
      repeat: isPlaying ? -1 : 0,
      ease: isPlaying ? 'none' : 'power2.out',
    });
  }, { dependencies: [isPlaying] });

  // Progress bar smooth animation
  useGSAP(() => {
    if (!progressBarRef.current) return;
    gsap.to(progressBarRef.current, {
      width: `${progress}%`,
      duration: 0.3,
      ease: 'none',
    });
  }, { dependencies: [progress] });

  useEffect(() => { if (!currentTrack) setAudioNote(''); }, [currentTrack?.id]);

  const onTogglePlay = (event) => {
    event.stopPropagation();
    if (isYouTube) toggleYouTube();
    else audio.togglePlay();
  };

  // Switching a video to audio needs a real audio source: the YouTube embed
  // cannot simply be muted, so we look the song up on a playable provider. When
  // there is none, say so instead of appearing to do nothing.
  const onSwitchToAudio = async (event) => {
    event.stopPropagation();
    if (!isYouTube || audioBusy) return;
    setAudioBusy(true);
    setAudioNote('');
    try {
      const alternative = await youtube.audioAlternative(currentTrack.title, currentTrack.artistName);
      if (!alternative) {
        setAudioNote('No audio version available for this song');
        return;
      }
      const switched = useAudioInsteadOfVideo(alternative);
      if (!switched) setAudioNote('No audio version available for this song');
    } catch {
      setAudioNote('Could not find an audio version');
    } finally {
      setAudioBusy(false);
    }
  };

  if (!currentTrack) return null;

  const art = isYouTube
    ? `https://i.ytimg.com/vi/${currentTrack.videoId}/mqdefault.jpg`
    : currentTrack.cover;

  // Show a placeholder only while artwork is genuinely on its way. A track with
  // no artwork at all is a final state, not a pending one, so it renders the
  // empty surface it always did rather than shimmering forever.
  const [artLoaded, setArtLoaded] = useState(false);
  const hasArt = !!art;
  const showArtPlaceholder = hasArt && !artLoaded;

  // Artwork already in the browser cache can finish decoding before React
  // attaches onLoad, which would otherwise leave the placeholder stuck, so the
  // element's own `complete` flag is checked once per track.
  useEffect(() => {
    setArtLoaded(false);
    if (!hasArt) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => { if (!cancelled) setArtLoaded(true); };
    probe.src = art;
    if (probe.complete && probe.naturalWidth > 0) setArtLoaded(true);
    return () => { cancelled = true; };
  }, [art, hasArt]);

  return (
    <div ref={containerRef} data-tour="player" className="fixed bottom-[88px] left-3 right-3 z-40 lg:bottom-4 lg:left-[244px]" style={{ opacity: 0 }}>
      <div
        className="glass-panel rounded-2xl flex items-center gap-3 p-2 cursor-pointer shadow-[0_-4px_30px_rgba(0,0,0,0.6)] border-glow press-feedback"
        onClick={() => navigate('/now-playing')}
      >
        <div className="absolute top-0 left-0 w-full h-[2px] bg-white/10 rounded-t-2xl overflow-hidden">
          <div
            ref={progressBarRef}
            className="h-full bg-gradient-to-r from-primary to-secondary"
            style={{ width: `${progress}%` }}
          />
        </div>
          {/* Artwork: reserve the exact square the real image occupies. When the
              provider has no artwork, or it has not loaded yet, show a
              placeholder rather than an empty box, so the bar never changes
              size. */}
          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 ml-1 bg-surface-card">
            {!showArtPlaceholder ? (
              <img ref={artRef} src={art} alt="" className="w-full h-full object-cover" onLoad={() => setArtLoaded(true)} />
            ) : (
              <Skeleton className="w-full h-full" radius="rounded-xl" animation="pulse" />
            )}
          </div>
          <div className="flex-grow min-w-0">
            <h4 className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{currentTrack.title}</h4>
            <div className="flex items-center gap-1.5">
              {/* The artist line is often the last thing known about a resolved
                  track, so it is skeletonised only while genuinely absent. */}
              {currentTrack.artistName ? (
                <p className="text-[10px] text-on-surface-variant truncate">{currentTrack.artistName}</p>
              ) : (
                <Skeleton width={78} height={10} className="max-w-[45%]" animation="pulse" />
              )}
            {isYouTube && (
              <span className="text-[8px] font-bold text-red-500 shrink-0">Video</span>
            )}
            {!isYouTube && currentTrack.playbackType === 'preview' && (
              <span className="text-[8px] font-bold text-amber-500 shrink-0">Preview</span>
            )}
            {!isYouTube && currentTrack.playbackType === 'full' && (
              <span className="text-[8px] font-bold text-green-500 shrink-0">Full</span>
            )}
          </div>
          {audioNote && (
            <p role="status" className="text-[9px] text-amber-400 truncate">{audioNote}</p>
          )}
        </div>
        <div className="flex items-center gap-1 pr-1 shrink-0">
          {isYouTube && (
            <>
              {videoOpen ? (
                <button
                  aria-label="Play audio only"
                  title="Play audio only"
                  disabled={audioBusy}
                  className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10 transition-all active:scale-90 duration-150 press-feedback disabled:opacity-40"
                  onClick={onSwitchToAudio}
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">graphic_eq</span>
                </button>
              ) : (
                <button
                  aria-label="Show video"
                  title="Show video"
                  className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10 transition-all active:scale-90 duration-150 press-feedback"
                  onClick={(e) => { e.stopPropagation(); openVideo(); }}
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">movie</span>
                </button>
              )}
            </>
          )}
          <button
            aria-label={isLiked ? "Unlike" : "Like"}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10 transition-all active:scale-90 duration-150 press-feedback"
            onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack.id); }}
          >
            <span className={`material-symbols-outlined text-[20px] transition-all duration-300 ${isLiked ? 'icon-fill text-primary scale-110' : 'text-on-surface-variant'}`}>favorite</span>
          </button>
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            className="w-11 h-11 flex items-center justify-center bg-primary rounded-full active:scale-90 transition-all duration-150 shadow-[0_0_12px_rgba(214,255,61,0.3)] press-feedback"
            onClick={onTogglePlay}
          >
            <span className={`material-symbols-outlined text-[22px] text-background icon-fill transition-transform duration-200 ${isPlaying ? 'scale-100' : 'scale-90'}`}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}