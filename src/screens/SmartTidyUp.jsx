import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { songs, formatTime } from '../data/library';

export default function SmartTidyUp() {
  const navigate = useNavigate();
  const { likedSongs, toggleLike } = useApp();
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('AI Smart');
  const filters = ['Last Played', 'Most Skipped', 'AI Smart'];

  const liked = likedSongs.map(id => songs.find(s => s.id === id)).filter(Boolean);

  const suggested = liked.length > 3 ? liked.slice(-3) : liked.slice(0, Math.min(2, liked.length));

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === suggested.length) setSelected([]);
    else setSelected(suggested.map(s => s.id));
  };

  const deleteSelected = () => {
    selected.forEach(id => toggleLike(id));
    setSelected([]);
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden page-enter">
      <div className="ambient-glow ambient-glow-animated" />
      <header className="flex justify-between items-center px-6 py-4 border-b border-medium relative z-10 fade-up">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h1 className="text-on-surface text-lg font-semibold">Smart Tidy Up</h1>
        <span className="text-on-surface-variant text-sm">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </header>

      <div className="px-6 pt-4 pb-2 relative z-10 fade-up-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-on-surface text-lg font-semibold">Liked Songs</h2>
            <p className="text-on-surface-variant text-sm">{liked.length} Songs</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              f === 'AI Smart'
                ? filter === f ? 'bg-gradient-to-r from-[#D6FF3D] to-[#9FE81F] text-background' : 'bg-surface-card text-on-surface-variant border border-medium'
                : filter === f ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-surface-card text-on-surface-variant border border-medium'
            }`}>
              {f === 'AI Smart' && <span className="material-symbols-outlined text-[12px] mr-1">auto_awesome</span>}
              {f}
            </button>
          ))}
        </div>

        <div className="bg-gradient-to-r from-[#D6FF3D]/15 to-[#9FE81F]/10 border border-primary/20 rounded-2xl p-3 flex items-start gap-3 mb-4">
          <span className="material-symbols-outlined text-primary text-[20px] icon-fill mt-0.5">auto_awesome</span>
          <p className="text-sm text-on-surface">AI found {suggested.length} songs you rarely play and potential duplicates — review below.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 relative z-10 fade-up-2">
        {suggested.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <span className="material-symbols-outlined text-on-surface-variant text-[48px] mb-3">check_circle</span>
            <p className="text-sm text-on-surface-variant">Your library is already tidy!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {suggested.map(song => {
              const isSelected = selected.includes(song.id);
              return (
                <button key={song.id} onClick={() => toggle(song.id)} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-card-hover transition-colors w-full text-left">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'border-primary bg-primary shadow-[0_0_12px_rgba(214,255,61,0.4)]' : 'border-medium'
                  }`}>
                    {isSelected && <span className="material-symbols-outlined text-background text-[14px]">check</span>}
                  </div>
                  <img src={song.cover} alt={song.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{song.title}</p>
                    <p className="text-xs text-on-surface-variant truncate">{song.artistName} · {formatTime(song.duration)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {suggested.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full p-4 z-20 bg-surface-dim/90 backdrop-blur-xl rounded-t-[20px] border-t border-medium flex flex-col gap-2">
          <button onClick={selectAll} className="text-primary text-sm font-medium text-center hover:opacity-80 transition-opacity">
            {selected.length === suggested.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={deleteSelected}
            disabled={selected.length === 0}
            className={`rounded-full h-14 w-full flex items-center justify-center font-semibold text-background transition-all ${
              selected.length === 0 ? 'bg-primary/30 opacity-40 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover press-feedback shadow-[0_0_20px_rgba(214,255,61,0.3)] glow-pulse'
            }`}
          >
            Delete Selected ({selected.length})
          </button>
        </div>
      )}
    </div>
  );
}
