import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { songs, formatTime } from '../data/library';
import { useI18n } from '../context/I18nContext';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';
import { SkeletonTrackList } from '../components/skeleton';

export default function LikedSongs() {
  const navigate = useNavigate();
  const { t } = useI18n();
  // Real first-load signal for the liked-songs request behind `likedSongs`.
  // It clears when the request settles (success *or* failure), so the existing
  // empty state still appears for a genuinely empty library.
  const { likedSongs, toggleLike, audio, addRecentlyPlayed, collectionsLoading } = useApp();

  const liked = likedSongs.map(id => songs.find(s => s.id === id)).filter(Boolean);
  const listRef = useRef(null);

  useEffect(() => {
    if (prefersReduced || !listRef.current || liked.length === 0) return;
    const items = listRef.current.querySelectorAll('[data-liked]');
    gsap.fromTo(items,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.3, stagger: 0.03, ease: 'power3.out', overwrite: 'auto', delay: 0.2 }
    );
  }, [liked.length]);

  const playAll = () => {
    if (liked.length === 0) return;
    addRecentlyPlayed(liked[0].id);
    audio.play(liked[0], liked);
  };

  const playSong = (song) => {
    addRecentlyPlayed(song.id);
    audio.play(song, liked);
  };

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <header className="w-full sticky top-0 z-40 bg-background/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 fade-up">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity press-feedback">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t('LIKED_HEADING')}</h1>
        <button className="text-on-surface-variant press-feedback"><span className="material-symbols-outlined">more_vert</span></button>
      </header>

      <div className="px-6 pt-2 pb-4 fade-up-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display-lg text-display-lg" style={{ background: 'linear-gradient(135deg, #D6FF3D, #9FE81F)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('LIKED_COUNT', { count: liked.length })}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/tidy-up')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-card border border-border-subtle text-on-surface-variant font-body-sm text-body-sm press-feedback">
              <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span> {t('LIKED_TIDY_UP')}
            </button>
            <button onClick={() => navigate('/create-playlist')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-card border border-border-subtle text-on-surface-variant font-body-sm text-body-sm press-feedback">
              <span className="material-symbols-outlined text-[16px] text-primary">add</span> {t('LIKED_ADD_SONGS')}
            </button>
            <button onClick={playAll} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(214,255,61,0.3)] press-feedback glow-pulse">
              <span className="material-symbols-outlined text-background icon-fill text-[28px]">play_arrow</span>
            </button>
          </div>
        </div>
      </div>

        <div className="flex-1 px-6 pb-28 fade-up-2">
          {/* Skeleton first, so the empty state below is only reached once the
              request has actually finished. An empty library and a loading one
              must not look the same. */}
          {collectionsLoading ? (
            <SkeletonTrackList rows={7} />
          ) : liked.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <span className="material-symbols-outlined text-on-surface-variant text-[64px] mb-4">favorite_border</span>
            <p className="font-headline-md text-headline-md text-on-surface mb-2">{t('LIKED_EMPTY_HEADING')}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center">{t('LIKED_EMPTY_DESC')}</p>
          </div>
        ) : (
          <div ref={listRef} className="flex flex-col">
            {liked.map((song, i) => (
              <div
                key={song.id}
                data-liked
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-variant transition-colors group"
              >
                <img src={song.cover} alt={song.title} className="w-12 h-12 rounded-lg object-cover shrink-0 cursor-pointer press-feedback" onClick={() => playSong(song)} />
                <div className="flex-grow min-w-0 cursor-pointer" onClick={() => playSong(song)}>
                  <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{song.title}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-on-surface-variant truncate">{song.artistName}</p>
                    {song.playbackType === 'preview' && (
                      <span className="text-[9px] font-bold text-amber-500 shrink-0">Preview</span>
                    )}
                    {song.playbackType === 'full' && (
                      <span className="text-[9px] font-bold text-green-500 shrink-0">Full</span>
                    )}
                    {song.playbackType === 'external' && (
                      <span className="text-[9px] font-bold text-blue-500 shrink-0">Open</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-on-surface-variant shrink-0">{formatTime(song.duration)}</span>
                <button onClick={() => toggleLike(song.id)} className="text-primary hover:text-primary/80 transition-colors shrink-0 press-feedback">
                  <span className="material-symbols-outlined icon-fill text-[20px]" style={{ animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>favorite</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
