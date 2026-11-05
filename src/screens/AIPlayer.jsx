import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { formatTime } from '../data/library';

export default function AIPlayer() {
  const navigate = useNavigate();
  const { audio } = useApp();
  const { currentTrack, isPlaying, currentTime, duration, togglePlay, handleNext, handlePrev, seek } = audio;
  const [enhanced, setEnhanced] = useState(false);

  if (!currentTrack) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter">
        <span className="material-symbols-outlined text-on-surface-variant text-[64px] mb-4">music_off</span>
        <p className="font-headline-md text-headline-md text-on-surface mb-2">No Track Playing</p>
        <button onClick={() => navigate(-1)} className="btn-primary rounded-full px-8 py-3 font-body-sm text-body-sm press-feedback">Go Back</button>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="relative z-10 flex justify-between items-center w-full px-6 py-4 fade-up">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">expand_more</span>
        </button>
        <h1 className="font-label-caps text-label-caps text-on-surface tracking-wider uppercase">AI Enhanced Player</h1>
        <button className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback"><span className="material-symbols-outlined">more_vert</span></button>
      </header>

      <div className="absolute inset-0 bg-gradient-to-b from-surface-dim via-background to-surface-dim">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50" />
      </div>

      <main className="relative z-10 flex-grow flex flex-col items-center px-6 pt-2">
        {/* Album art with glow ring */}
        <div className="w-full max-w-[280px] aspect-square rounded-full overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.6)] mb-6 border-4 border-primary/20 scale-in relative">
          <img
            src={currentTrack.cover}
            alt={currentTrack.title}
            className={`w-full h-full object-cover transition-all duration-700 ${enhanced ? 'scale-105 saturate-150' : isPlaying ? 'scale-100' : 'scale-95'}`}
          />
          {enhanced && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/40 pointer-events-none glow-pulse" />
          )}
        </div>

        <div className="w-full max-w-[400px] flex flex-col gap-6">
          <div className="flex justify-between items-end w-full fade-up fade-up-1">
            <div className="flex flex-col gap-1 min-w-0 flex-grow">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface truncate">{currentTrack.title}</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant truncate">{currentTrack.artistName}</p>
            </div>
          </div>

          {/* AI Enhancement Toggle */}
          <div className="bg-surface-card rounded-xl p-3 flex items-center justify-between border border-border-subtle border-glow fade-up fade-up-2">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-primary to-primary-container px-2 py-1 rounded-full">
                <span className="material-symbols-outlined text-background text-[12px] icon-fill">auto_awesome</span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface">AI Enhancement</span>
            </div>
            <button
              onClick={() => setEnhanced(!enhanced)}
              className={`w-12 h-6 rounded-full transition-all duration-300 relative ${enhanced ? 'bg-primary shadow-[0_0_12px_rgba(214,255,61,0.4)]' : 'bg-surface-variant'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all duration-300 ${enhanced ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Visualizer */}
          {enhanced && (
            <div className="bg-surface-card rounded-xl p-4 flex items-center justify-center gap-1 h-20 overflow-hidden border border-border-subtle scale-in">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-1 bg-gradient-to-t from-primary-container to-primary rounded-full eq-bar" style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 40 + 10}px` }} />
              ))}
            </div>
          )}

          {/* Progress */}
          <div className="w-full flex flex-col gap-1 fade-up fade-up-3">
            <input type="range" min="0" max={duration} value={currentTime} onChange={e => seek(Number(e.target.value))} className="w-full cursor-pointer" aria-label="Progress" />
            <div className="flex justify-between text-[10px] text-on-surface-variant opacity-70">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center px-2 fade-up fade-up-4">
            <button onClick={audio.toggleShuffle} className={`transition-colors press-feedback ${audio.shuffle ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>shuffle</span>
            </button>
            <button onClick={handlePrev} className="text-on-surface hover:text-primary transition-colors press-feedback">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 36 }}>skip_previous</span>
            </button>
            <button onClick={togglePlay} className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center shadow-[0_0_24px_rgba(214,255,61,0.35)] hover:shadow-[0_0_32px_rgba(214,255,61,0.5)] transition-all press-feedback glow-pulse">
              <span className="material-symbols-outlined text-background icon-fill" style={{ fontSize: 40 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button onClick={handleNext} className="text-on-surface hover:text-primary transition-colors press-feedback">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 36 }}>skip_next</span>
            </button>
            <button onClick={audio.cycleRepeat} className={`transition-colors press-feedback ${audio.repeat !== 'off' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{audio.repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
