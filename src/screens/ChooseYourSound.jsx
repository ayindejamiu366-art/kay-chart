import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { GENRES } from '../data/library';
import api from '../services/api';

export default function ChooseYourSound() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [selected, setSelected] = useState(() => user?.genres || []);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (genre) => {
    setSelected(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]);
  };

  const filtered = GENRES.filter(g => g.toLowerCase().includes(search.toLowerCase()));

  const handleContinue = async () => {
    if (selected.length < 3 || saving) return;
    setSaving(true);
    try {
      await api.updateProfile({ genres: selected });
      setUser(prev => ({ ...prev, genres: selected }));
    } catch (err) {
      console.error('Failed to save genres:', err);
    }
    setSaving(false);
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-6 relative overflow-hidden bg-background page-enter">
      <div className="ambient-glow ambient-glow-animated" />
      <div className="absolute top-[-30%] right-[-20%] w-[500px] h-[500px] bg-gradient-to-br from-purple-600/20 via-pink-500/15 to-orange-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[400px] h-[400px] bg-gradient-to-tl from-yellow-400/10 via-pink-500/15 to-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
      <header className="mb-6 z-10 fade-up flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface -ml-1">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-2">Choose Your Sound</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Select 3 or more genres to power your AI DJ.</p>
        </div>
      </header>
      <div className="bg-surface-card border border-border-subtle rounded-full flex items-center px-6 h-12 w-full mb-6 z-10 border-glow">
        <span className="material-symbols-outlined text-on-surface-variant mr-3 text-[20px]">search</span>
        <input className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant p-0 outline-none" placeholder="Search genres..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2 flex-1 z-10 overflow-y-auto pb-24 fade-up-1">
        {filtered.map(genre => {
          const active = selected.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => toggle(genre)}
              className={`px-4 py-2 rounded-full font-body-sm text-body-sm whitespace-nowrap transition-all press-feedback ${
                active
                  ? 'bg-primary text-background font-semibold shadow-[0_0_20px_rgba(214,255,61,0.3)]'
                  : 'bg-surface-card text-on-surface-variant border border-border-subtle hover:bg-surface-card-hover'
              }`}
            >
              {active && <span className="material-symbols-outlined text-[14px] mr-1 icon-fill text-background">check</span>}
              {genre}
            </button>
          );
        })}
      </div>
      <div className="fixed bottom-0 left-0 w-full p-6 z-20 bg-background/90 backdrop-blur-xl rounded-t-2xl border-t border-border-subtle">
        <button
          onClick={handleContinue}
          disabled={selected.length < 3 || saving}
          className={`rounded-full h-14 w-full flex items-center justify-center font-headline-md text-headline-md text-background bg-primary font-bold transition-all glow-pulse ${
            selected.length < 3 || saving ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary-hover hover:-translate-y-0.5 shadow-[0_0_24px_rgba(214,255,61,0.25)]'
          }`}
        >
          {saving ? 'Saving…' : `Continue (${selected.length} selected)`}
        </button>
      </div>
    </div>
  );
}
