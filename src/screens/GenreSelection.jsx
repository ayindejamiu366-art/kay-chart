import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

const GENRES = [
  { id: 'pop', label: 'Pop', icon: 'star', color: 'from-pink-500 to-rose-500' },
  { id: 'hiphop', label: 'Hip-Hop', icon: 'graphic_eq', color: 'from-orange-500 to-amber-500' },
  { id: 'edm', label: 'EDM', icon: 'bolt', color: 'from-cyan-500 to-blue-500' },
  { id: 'tamil', label: 'Tamil Hits', icon: 'queue_music', color: 'from-red-500 to-pink-500' },
  { id: 'indie', label: 'Indie', icon: 'egg', color: 'from-lime-500 to-emerald-500' },
  { id: 'rock', label: 'Rock', icon: 'electric_bolt', color: 'from-zinc-400 to-zinc-600' },
  { id: 'rnb', label: 'R&B', icon: 'favorite', color: 'from-purple-500 to-violet-500' },
  { id: 'classical', label: 'Classical', icon: 'piano', color: 'from-amber-600 to-yellow-500' },
  { id: 'bollywood', label: 'Bollywood', icon: 'movie', color: 'from-fuchsia-500 to-purple-500' },
  { id: 'jazz', label: 'Jazz', icon: 'music_note', color: 'from-teal-500 to-cyan-500' },
  { id: 'chill', label: 'Chill Vibe', icon: 'ac_unit', color: 'from-sky-400 to-indigo-400' },
  { id: 'workout', label: 'Workout', icon: 'fitness_center', color: 'from-red-600 to-orange-500' },
  { id: 'focus', label: 'Focus', icon: 'psychology', color: 'from-emerald-500 to-teal-500' },
  { id: 'rainy', label: 'Rainy Days', icon: 'rainy', color: 'from-slate-400 to-blue-400' },
  { id: 'romantic', label: 'Romantic', icon: 'favorite_border', color: 'from-rose-400 to-pink-500' },
  { id: 'retro', label: 'Retro', icon: 'skip_previous', color: 'from-yellow-500 to-orange-500' },
];

export default function GenreSelection() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [selected, setSelected] = useState([]);
  const gridRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    if (prefersReduced) return;
    const tl = gsap.timeline({ delay: 0.1 });
    tl.from(headerRef.current?.children || [], { y: 20, opacity: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out' });
    if (gridRef.current) {
      tl.from(gridRef.current.children, { y: 20, opacity: 0, scale: 0.95, duration: 0.35, stagger: 0.03, ease: 'power3.out' }, '-=0.2');
    }
    return () => tl.kill();
  }, []);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    const labels = GENRES.filter(g => selected.includes(g.id)).map(g => g.label);
    try {
      await api.updateProfile({ genres: labels });
      setUser(prev => ({ ...prev, genres: labels }));
    } catch (err) {
      console.error('Failed to save genres:', err);
    }
    navigate('/select-artists', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      {/* Header */}
      <div ref={headerRef} className="px-6 pt-12 pb-4">
        <div className="w-full bg-surface-card/50 h-1.5 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500" style={{ width: '50%' }} />
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface text-center mb-2 fade-up">
          What do you listen to?
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center fade-up fade-up-1">
          Pick at least 3 genres to personalize your feed
        </p>
      </div>

      {/* Genre Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div ref={gridRef} className="grid grid-cols-2 gap-3 pt-2">
          {GENRES.map((genre, i) => {
            const isSelected = selected.includes(genre.id);
            return (
              <button
                key={genre.id}
                onClick={() => toggle(genre.id)}
                className={`relative h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 ease-out press-feedback overflow-hidden ${
                  isSelected
                    ? 'border-primary bg-primary/10 scale-[1.03] shadow-[0_0_20px_rgba(214,255,61,0.2)]'
                    : 'border-border-subtle bg-surface-card hover:border-primary/30 hover:scale-[1.01]'
                }`}
                style={{
                  animationDelay: `${i * 40}ms`,
                  animation: 'fadeSlideUp 0.5s ease-out both',
                }}
              >
                {/* Gradient background on select */}
                {isSelected && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${genre.color} opacity-10 pointer-events-none`} />
                )}

                {/* Checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center" style={{ animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                    <span className="material-symbols-outlined text-background text-[14px] icon-fill">check</span>
                  </div>
                )}

                <span className={`material-symbols-outlined text-[28px] transition-all duration-300 ${isSelected ? 'text-primary scale-110' : 'text-on-surface-variant'}`}>
                  {genre.icon}
                </span>
                <span className={`font-body-sm text-body-sm transition-all duration-300 ${isSelected ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                  {genre.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 pt-4 bg-background/80 backdrop-blur-xl border-t border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {selected.length} selected
          </span>
          {selected.length >= 3 && (
            <span className="font-body-xs text-body-xs text-primary" style={{ animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
              Looking good!
            </span>
          )}
        </div>
        <button
          onClick={handleContinue}
          disabled={selected.length < 3}
          className={`w-full h-14 rounded-full font-headline-md text-headline-md flex items-center justify-center gap-2 transition-all duration-300 press-feedback ${
            selected.length >= 3
              ? 'btn-primary shadow-[0_0_20px_rgba(214,255,61,0.3)]'
              : 'bg-surface-card text-on-surface-variant cursor-not-allowed'
          }`}
        >
          Continue
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
