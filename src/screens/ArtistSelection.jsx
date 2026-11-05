import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import ArtistAvatar from '../components/ArtistAvatar';
import { artists } from '../data/library';

const EXTRA_ARTISTS = [
  { id: 'a6', name: 'A.R. Rahman', photo: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop', listeners: 0, genres: ['Classical', 'Tamil Hits'] },
  { id: 'a7', name: 'Dua Lipa', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop', listeners: 0, genres: ['Pop', 'Dance'] },
  { id: 'a8', name: 'Travis Scott', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', listeners: 0, genres: ['Hip-Hop', 'Rap'] },
  { id: 'a9', name: 'Hans Zimmer', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop', listeners: 0, genres: ['Classical', 'Soundtrack'] },
  { id: 'a10', name: 'Billie Eilish', photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop', listeners: 0, genres: ['Pop', 'Indie'] },
  { id: 'a11', name: 'Thalapathy Vijay', photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop', listeners: 0, genres: ['Tamil Hits'] },
  { id: 'a12', name: 'Sia', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop', listeners: 0, genres: ['Pop'] },
];

const allArtists = [...artists, ...EXTRA_ARTISTS];
const PICK_COUNT = 5;

function formatListeners(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

export default function ArtistSelection() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [selected, setSelected] = useState([]);
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const toggle = (id) => {
    if (selected.includes(id)) {
      setSelected(prev => prev.filter(a => a !== id));
    } else if (selected.length < PICK_COUNT) {
      setSelected(prev => [...prev, id]);
    }
  };

  const handleDone = async () => {
    try {
      await api.updateProfile({ selectedArtists: selected });
      setUser(prev => ({ ...prev, selectedArtists: selected }));
    } catch (err) {
      console.error('Failed to save artists:', err);
    }
    navigate('/home', { replace: true });
  };

  const progress = (selected.length / PICK_COUNT) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="w-full bg-surface-card/50 h-1.5 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface text-center mb-2 fade-up">
          Pick your favorites
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center fade-up fade-up-1">
          Choose {PICK_COUNT} artists you love
        </p>

        {/* Counter pills */}
        <div className="flex justify-center gap-1.5 mt-4 fade-up fade-up-2">
          {Array.from({ length: PICK_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i < selected.length
                  ? 'bg-primary w-8 shadow-[0_0_8px_rgba(214,255,61,0.4)]'
                  : 'bg-surface-card w-2'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Artist Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-3 gap-4 pt-2">
          {allArtists.map((artist, i) => {
            const isSelected = selected.includes(artist.id);
            const isDisabled = !isSelected && selected.length >= PICK_COUNT;
            return (
              <button
                key={artist.id}
                onClick={() => toggle(artist.id)}
                disabled={isDisabled}
                className={`flex flex-col items-center gap-2 press-feedback transition-all duration-300 ${
                  isDisabled ? 'opacity-40' : ''
                }`}
                style={{
                  animationDelay: `${i * 60}ms`,
                  animation: entering ? 'fadeSlideUp 0.5s ease-out both' : 'none',
                }}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full overflow-hidden border-3 transition-all duration-300 ${
                    isSelected
                      ? 'border-primary shadow-[0_0_20px_rgba(214,255,61,0.4)] scale-105'
                      : 'border-border-subtle hover:border-primary/40'
                  }`}>
                    <ArtistAvatar name={artist.name} photo={artist.photo} className="w-full h-full" rounded="rounded-full" />
                  </div>

                  {/* Check badge */}
                  {isSelected && (
                    <div
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-[0_0_12px_rgba(214,255,61,0.5)]"
                      style={{ animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
                    >
                      <span className="material-symbols-outlined text-background text-[16px] icon-fill">check</span>
                    </div>
                  )}

                  {/* Ring pulse on select */}
                  {isSelected && (
                    <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping pointer-events-none" style={{ animationDuration: '1.5s' }} />
                  )}
                </div>

                {/* Info */}
                <div className="text-center">
                  <p className={`font-body-xs text-body-xs truncate max-w-[90px] transition-all duration-300 ${
                    isSelected ? 'text-on-surface font-semibold' : 'text-on-surface-variant'
                  }`}>
                    {artist.name}
                  </p>
                  <p className="font-body-xs text-[10px] text-on-surface-variant/60">
                    {formatListeners(artist.listeners)} listeners
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 pt-4 bg-background/80 backdrop-blur-xl border-t border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {selected.length} of {PICK_COUNT} picked
          </span>
          {selected.length === PICK_COUNT && (
            <span className="font-body-xs text-body-xs text-primary" style={{ animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
              Perfect match!
            </span>
          )}
        </div>
        <button
          onClick={handleDone}
          disabled={selected.length < PICK_COUNT}
          className={`w-full h-14 rounded-full font-headline-md text-headline-md flex items-center justify-center gap-2 transition-all duration-300 press-feedback ${
            selected.length === PICK_COUNT
              ? 'btn-primary shadow-[0_0_20px_rgba(214,255,61,0.3)]'
              : 'bg-surface-card text-on-surface-variant cursor-not-allowed'
          }`}
        >
          {selected.length === PICK_COUNT ? (
            <>Start Listening<span className="material-symbols-outlined text-[20px]">arrow_forward</span></>
          ) : (
            `Pick ${PICK_COUNT - selected.length} more`
          )}
        </button>
      </div>
    </div>
  );
}
