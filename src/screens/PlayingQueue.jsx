import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useI18n } from '../context/I18nContext';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

export default function PlayingQueue() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { audio, player, playYouTube } = useApp();
  const isYouTube = player.engine === 'youtube';
  // Read the unified session so a YouTube track and its queue appear here
  // instead of only inside the video overlay.
  const currentTrack = player.track;
  const queue = player.queue.length ? player.queue : audio.queue;
  const queueIndex = player.engine ? player.index : audio.queueIndex;
  const isPlaying = isYouTube ? player.track?.videoId != null && audio.isPlaying : audio.isPlaying;
  const { removeFromQueue, play } = audio;

  const upNext = queue.slice(queueIndex + 1);
  const queueRef = useRef(null);

  useEffect(() => {
    if (prefersReduced || !queueRef.current || upNext.length === 0) return;
    const items = queueRef.current.querySelectorAll('[data-queue-item]');
    gsap.fromTo(items,
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, stagger: 0.04, ease: 'power3.out', overwrite: 'auto', delay: 0.15 }
    );
  }, [upNext.length]);

  const jumpTo = (index) => {
    const track = queue[index];
    if (!track) return;
    if (track.videoId) playYouTube(track, queue);
    else {
      audio.setCurrentTrack(track);
      audio.setQueue(queue);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="flex justify-between items-center w-full px-6 py-4">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">expand_more</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t('QUEUE_HEADING')}</h1>
        <button className="text-primary font-body-sm text-body-sm font-semibold hover:text-primary-hover transition-colors">
          {t('QUEUE_CLEAR')}
        </button>
      </header>

      <div className="flex-1 px-6 overflow-y-auto pb-8">
        {/* Now Playing */}
        {currentTrack && (
          <section className="mb-6 fade-up">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant/40 tracking-wider mb-3">{t('QUEUE_NOW_PLAYING')}</h3>
            <div className="rounded-xl p-3 flex items-center gap-3 relative overflow-hidden bg-surface-card border border-primary/10 border-glow">
              <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
              <img src={currentTrack.cover} alt={currentTrack.title} className="w-14 h-14 rounded-lg object-cover shrink-0 relative z-10" />
              <div className="flex-grow min-w-0 relative z-10">
                <p className="font-body-sm text-body-sm font-semibold text-primary truncate">{currentTrack.title}</p>
                <p className="text-xs text-on-surface-variant truncate">{currentTrack.artistName}</p>
              </div>
              {isPlaying && (
                <div className="flex items-end gap-[2px] h-4 relative z-10">
                  <div className="w-[3px] bg-primary rounded-full eq-bar" />
                  <div className="w-[3px] bg-primary rounded-full eq-bar" />
                  <div className="w-[3px] bg-primary rounded-full eq-bar" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Up Next */}
        <section>
          <h3 className="font-label-caps text-label-caps text-on-surface-variant/40 tracking-wider mb-3 fade-up fade-up-1">{t('QUEUE_UP_NEXT', { count: upNext.length })}</h3>
          {upNext.length === 0 ? (
            <div className="flex flex-col items-center py-12 fade-up">
              <span className="material-symbols-outlined text-on-surface-variant/20 text-[48px] mb-3">queue_music</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t('QUEUE_NO_UPCOMING')}</p>
            </div>
          ) : (
            <div ref={queueRef} className="flex flex-col gap-1">
              {upNext.map((track, i) => (
                <div
                  key={`${track.id}-${i}`}
                  data-queue-item
                  className="flex items-center gap-3 p-2 rounded-xl bg-surface-card hover:bg-surface-card-hover transition-all press-feedback group"
                >
                  <span className="material-symbols-outlined text-on-surface-variant/20 text-[18px] cursor-grab">drag_indicator</span>
                  <img src={track.cover} alt={track.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="flex-grow min-w-0">
                    <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{track.title}</p>
                    <p className="text-xs text-on-surface-variant truncate">{track.artistName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
