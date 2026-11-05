import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GENRES } from '../data/library';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

const GENRE_IMAGES = [
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1484755560615-a4c64e778571?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&q=80",
];

export default function ExploreGenres() {
  // No skeleton here, deliberately. `GENRES` is a static module import
  // (src/data/library.js), so there is no request, no pending state and nothing
  // to wait for: the grid is correct on first paint. Introducing a loading flag
  // would mean inventing a state this screen does not have.
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = GENRES.filter(g => g.toLowerCase().includes(search.toLowerCase()));
  const gridRef = useRef(null);

  useEffect(() => {
    if (prefersReduced || !gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('[data-genre]');
    gsap.fromTo(cards,
      { y: 20, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, stagger: 0.04, ease: 'power3.out', overwrite: 'auto', delay: 0.15 }
    );
  }, [filtered.length]);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      <div className="ambient-glow ambient-glow-animated" />
      <header className="w-full sticky top-0 z-40 bg-background/60 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-card/80 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all press-feedback">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">Explore Genres & Moods</h1>
        <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-surface-card/80 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all press-feedback">
          <span className="material-symbols-outlined text-[20px]">account_circle</span>
        </button>
      </header>
      <div className="px-6 py-2 fade-up">
        <div className="bg-surface-card border border-border-subtle rounded-full flex items-center px-4 h-10 w-full border-glow">
          <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[18px]">search</span>
          <input className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant p-0 outline-none" placeholder="Search genres..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 px-6 py-4">
        <div ref={gridRef} className="grid grid-cols-2 gap-3">
          {filtered.map((genre, i) => (
            <button
              key={genre}
              data-genre
              onClick={() => navigate(`/search/${genre}`)}
              className={`aspect-square rounded-2xl overflow-hidden relative group press-feedback border border-border-subtle group-hover:border-primary/20 fade-up`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
            >
              <img src={GENRE_IMAGES[i % GENRE_IMAGES.length]} alt={genre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute bottom-3 left-3 font-headline-md text-headline-md text-white font-bold">{genre}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
