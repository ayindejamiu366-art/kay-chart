import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useI18n } from '../context/I18nContext';
import { formatTime, songs } from '../data/library';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced, fadeUp, scaleIn, staggerFadeUp } from '../utils/gsap';
import { externalLinkFor } from '../utils/externalLink';
import { Skeleton } from '../components/skeleton';

export default function NowPlaying() {
  const navigate = useNavigate();
  const { t } = useI18n();
const { audio, likedSongs, toggleLike, recentlyPlayed, playYouTube, playYouTubeNext, playYouTubePrev, player, ytLive, toggleYouTube, seekYouTube, openVideo, closeVideo } = useApp();
const isYouTube = player.engine === 'youtube';
// Read the unified session so a YouTube track has a working Now Playing screen
// instead of the "nothing playing" state while the video is actually running.
const sessionTrack = player.track;
const audioTrack = audio.currentTrack;
const currentTrack = sessionTrack || audioTrack;
const isPlaying = isYouTube ? ytLive.isPlaying : audio.isPlaying;
const currentTime = isYouTube ? ytLive.currentTime : audio.currentTime;
const duration = isYouTube ? ytLive.duration : audio.duration;
const { togglePlay, handleNext, handlePrev, seek, shuffle, repeat, toggleShuffle, cycleRepeat, volume, setVolumeLevel, isLoading } = audio;
  const [showVolume, setShowVolume] = useState(false);

  const coverSrc = isYouTube
    ? `https://i.ytimg.com/vi/${currentTrack?.videoId}/hqdefault.jpg`
    : currentTrack?.cover;

  const coverRef = useRef(null);
  // Artwork decode state only, and it starts true when there is no artwork to
  // wait for, so a track with no cover never shows a placeholder. Reset whenever
  // the track (and therefore the image) changes.
  const [coverLoaded, setCoverLoaded] = useState(!coverSrc);
  const vinylRingRef = useRef(null);
  const playBtnRef = useRef(null);
  const likeBtnRef = useRef(null);
  const progressFillRef = useRef(null);
  const progressDotRef = useRef(null);
  const controlsRef = useRef(null);
  const infoRef = useRef(null);
  const actionsRef = useRef(null);
  const aiCardRef = useRef(null);

  const currentMood = currentTrack?.mood || 'uplifting';
  const moodLabels = { uplifting: 'uplifting', energy: 'high-energy', chill: 'mellow', romantic: 'romantic', epic: 'anthemic', intense: 'intense' };
  const extLink = externalLinkFor(currentTrack);
  const relatedMoods = songs.filter(s => s.mood === currentMood && s.id !== currentTrack?.id).slice(0, 2);
  const moodTag = moodLabels[currentMood] || currentMood;

  useGSAP(() => {
    if (!currentTrack || prefersReduced) return;
    const tl = gsap.timeline();
    tl.from(infoRef.current, { y: 30, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0.2)
      .from(actionsRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'power3.out' }, 0.35)
      .from(controlsRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'power3.out' }, 0.45)
      .from(aiCardRef.current, { y: 30, opacity: 0, scale: 0.95, duration: 0.5, ease: 'power3.out' }, 0.55);
  }, { dependencies: [currentTrack?.id] });

  useGSAP(() => {
    if (!coverRef.current || prefersReduced) return;
    if (isPlaying) {
      gsap.to(coverRef.current, {
        rotation: '+=360',
        duration: 12,
        ease: 'none',
        repeat: -1,
        overwrite: false,
      });
    } else {
      gsap.getTweensOf(coverRef.current).forEach(tw => {
        if (tw.vars.repeat === -1) tw.kill();
      });
    }
  }, { dependencies: [isPlaying] });

  useGSAP(() => {
    if (!playBtnRef.current || prefersReduced) return;
    gsap.fromTo(playBtnRef.current,
      { scale: 0.85 },
      { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' }
    );
  }, { dependencies: [isPlaying] });

  // A new track means new artwork, so the placeholder returns until that image
  // decodes. Keyed on the source, not on a timer.
  useEffect(() => {
    if (!coverSrc) { setCoverLoaded(true); return; }
    setCoverLoaded(false);
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => { if (!cancelled) setCoverLoaded(true); };
    probe.src = coverSrc;
    if (probe.complete && probe.naturalWidth > 0) setCoverLoaded(true);
    return () => { cancelled = true; };
  }, [coverSrc]);

  useGSAP(() => {
    if (!likeBtnRef.current || prefersReduced) return;
    if (likedSongs.includes(currentTrack?.id)) {
      gsap.fromTo(likeBtnRef.current,
        { scale: 0.5 },
        { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' }
      );
    }
  }, { dependencies: [likedSongs, currentTrack?.id] });

  useGSAP(() => {
    if (!progressDotRef.current || prefersReduced) return;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    gsap.to(progressDotRef.current, {
      left: `calc(${progress}% - 6px)`,
      duration: 0.2,
      ease: 'none',
      overwrite: 'auto',
    });
  }, { dependencies: [currentTime, duration] });

const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
const isLiked = likedSongs.includes(currentTrack?.id);

const onTogglePlay = () => { if (isYouTube) toggleYouTube(); else togglePlay(); };
const onNext = () => { if (isYouTube) playYouTubeNext(); else handleNext(); };
const onPrev = () => { if (isYouTube) playYouTubePrev(); else handlePrev(); };
const onSeek = (seconds) => { if (isYouTube) seekYouTube(seconds); else seek(seconds); };

  // No page-level skeleton here, deliberately. `currentTrack` comes straight
  // from the player's session state, so it is either present or there is nothing
  // playing — there is no pending fetch to represent, and replacing a playing
  // track with a placeholder would interrupt playback. The artwork element below
  // handles the one genuinely async part (image decode) on its own.
  if (!currentTrack) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter">
        <span className="material-symbols-outlined text-on-surface-variant/30 text-[64px] mb-4">music_off</span>
        <p className="font-headline-md text-headline-md text-on-surface mb-2">{t('NOW_PLAYING_EMPTY_HEADING')}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant/40 mb-6">{t('NOW_PLAYING_EMPTY_DESC')}</p>
        <button onClick={() => navigate(-1)} className="btn-primary rounded-full px-8 py-3 font-body-sm text-body-sm press-feedback">{t('NOW_PLAYING_GO_BACK')}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-body-lg overflow-x-hidden bg-background relative page-enter">
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/8 rounded-full blur-[100px] pointer-events-none animate-breathe" />
      <div className="absolute top-1/2 right-0 w-48 h-48 bg-secondary/8 rounded-full blur-[80px] pointer-events-none animate-breathe" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-20 left-0 w-40 h-40 bg-primary/6 rounded-full blur-[80px] pointer-events-none animate-breathe" style={{ animationDelay: '4s' }} />

      <header className="flex justify-between items-center w-full px-6 py-4 relative z-10">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">expand_more</span>
        </button>
        <h1 className="font-label-caps text-label-caps text-on-surface tracking-wider uppercase">{t('NOW_PLAYING_FROM')}</h1>
        <button className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      <main className="flex-grow flex flex-col items-center px-6 pt-2 pb-10 relative z-10">
        <div className="w-full max-w-[400px] aspect-square rounded-full overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.6),0_0_40px_rgba(214,255,61,0.12)] mb-6 relative group">
          {/* Artwork is the one part of this screen that arrives asynchronously.
              The title and artist above/below are already known from the session,
              so they stay visible and only the image box is held. Playback and
              the transport controls are untouched. */}
          {coverLoaded ? (
            <img
              ref={coverRef}
              src={coverSrc}
              alt=""
              className="w-full h-full object-cover"
              style={{ willChange: 'transform' }}
              onLoad={() => setCoverLoaded(true)}
            />
          ) : (
            <Skeleton className="w-full h-full" radius="9999px" animation="pulse" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
          <div ref={vinylRingRef} className={`absolute inset-0 border-2 border-primary/20 rounded-full pointer-events-none ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '12s' }} />
        </div>

        <div className="w-full max-w-[400px] flex flex-col gap-6">
          <div ref={infoRef} className="flex justify-between items-end w-full">
            <div className="flex flex-col gap-1 min-w-0 flex-grow">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface truncate">{currentTrack.title}</h2>
              <div className="flex items-center gap-2">
                <p className="font-body-lg text-body-lg text-on-surface-variant truncate">{currentTrack.artistName}</p>
                {isYouTube && (
                  <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                    {player.videoOpen ? 'Video' : 'Audio'}
                  </span>
                )}
                {!isYouTube && currentTrack.playbackType === 'preview' && (
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">Preview</span>
                )}
                {currentTrack.playbackType === 'full' && (
                  <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">Full track</span>
                )}
                {currentTrack.playbackType === 'external' && extLink && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // A YouTube link is not an exit: hand it to the in-app
                      // overlay so the user keeps their place in the app.
                      if (extLink.isYouTube) {
                        playYouTube({ ...currentTrack, videoId: extLink.videoId || currentTrack.videoId }, [currentTrack]);
                        return;
                      }
                      window.open(extLink.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="text-[10px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-full shrink-0 hover:underline"
                  >
                    {extLink.label}
                  </button>
                )}
              </div>
            </div>
            <button ref={likeBtnRef} onClick={() => toggleLike(currentTrack.id)} className={`transition-all press-feedback mb-1 shrink-0 ml-3 ${isLiked ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-primary'}`}>
              <span className={`material-symbols-outlined ${isLiked ? 'icon-fill' : ''}`} style={{ fontSize: 28 }}>favorite</span>
            </button>
          </div>

          <div className="w-full flex flex-col gap-1">
            <div className="relative w-full h-6 flex items-center">
              <input
                type="range" min="0" max={duration} value={currentTime}
                onChange={e => onSeek(Number(e.target.value))}
                className="w-full z-10 cursor-pointer"
                aria-label="Playback progress"
              />
              <div className="absolute top-1/2 left-0 h-[3px] bg-primary rounded-full pointer-events-none -translate-y-1/2" style={{ width: `${progress}%`, transition: 'width 0.15s linear' }} />
              <div className="absolute top-1/2 h-[3px] bg-on-surface/10 rounded-full pointer-events-none -translate-y-1/2 w-full" />
              <div ref={progressDotRef} className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full pointer-events-none shadow-[0_0_6px_rgba(214,255,61,0.5)]" style={{ left: `calc(${progress}% - 6px)`, willChange: 'left' }} />
            </div>
            <div className="flex justify-between w-full font-label-caps text-[10px] text-on-surface-variant/30">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div ref={controlsRef} className="flex justify-between items-center w-full px-2 py-1">
            <button onClick={toggleShuffle} aria-label="Shuffle" className={`transition-colors press-feedback ${shuffle ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>shuffle</span>
            </button>
            <button onClick={onPrev} aria-label="Previous Track" className="text-on-surface hover:text-primary transition-colors press-feedback">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 36 }}>skip_previous</span>
            </button>
            <button ref={playBtnRef} onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-[0_0_20px_rgba(214,255,61,0.3)] hover:shadow-[0_0_30px_rgba(214,255,61,0.5)] transition-all press-feedback glow-pulse">
              <span className="material-symbols-outlined text-background icon-fill" style={{ fontSize: 40 }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onClick={onNext} aria-label="Next Track" className="text-on-surface hover:text-primary transition-colors press-feedback">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 36 }}>skip_next</span>
            </button>
            <button onClick={cycleRepeat} aria-label="Repeat" className={`transition-colors press-feedback ${repeat !== 'off' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
            </button>
          </div>
        </div>

        <div ref={actionsRef} className="flex items-center gap-6 mt-6">
          <button onClick={() => navigate('/lyrics')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors press-feedback">
            <span className="material-symbols-outlined text-[20px]">lyrics</span>
            <span className="font-label-caps text-label-caps">{t('NOW_PLAYING_LYRICS')}</span>
          </button>
          <button onClick={() => navigate('/queue')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors press-feedback">
            <span className="material-symbols-outlined text-[20px]">queue_music</span>
            <span className="font-label-caps text-label-caps">{t('NOW_PLAYING_QUEUE')}</span>
          </button>
          <button onClick={() => setShowVolume(!showVolume)} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors press-feedback">
            <span className="material-symbols-outlined text-[20px]">{volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}</span>
            <span className="font-label-caps text-label-caps">{t('NOW_PLAYING_VOLUME')}</span>
          </button>
        </div>

        {showVolume && (
          <div className="w-full max-w-[400px] mt-4 px-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">volume_down</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                className="flex-grow cursor-pointer"
                aria-label="Volume"
              />
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">volume_up</span>
            </div>
            <p className="text-center text-[10px] text-on-surface-variant mt-1">{Math.round(volume * 100)}%</p>
          </div>
        )}

        <div ref={aiCardRef} className="w-full max-w-[400px] mt-6 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden bg-surface-card border border-primary/20 border-glow">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/8 rounded-full blur-3xl pointer-events-none animate-breathe" />
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 rounded-full bg-primary font-label-caps text-[10px] text-background flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span> {t('NOW_PLAYING_AI_BADGE')}
            </div>
            <h3 className="font-headline-md text-body-lg text-on-surface">{t('NOW_PLAYING_AI_HEADING')}</h3>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t('NOW_PLAYING_AI_RECOMMENDATION', { moodTag })}
            {relatedMoods.length > 0 && (
              <> {t('NOW_PLAYING_AI_SUGGEST', { title1: relatedMoods[0]?.title, title2: relatedMoods[1]?.title })}</>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
