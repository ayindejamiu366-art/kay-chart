import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { songs, getPlaylist } from '../data/library';

export default function AddSongsToPlaylist() {
  const navigate = useNavigate();
  const { playlistId } = useParams();
  const { addSongsToPlaylist, userPlaylists } = useApp();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const playlist = getPlaylist(playlistId) || userPlaylists.find(p => p.id === playlistId);
  const allSongs = songs;
  const filtered = search.trim()
    ? allSongs.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.artistName.toLowerCase().includes(search.toLowerCase()))
    : allSongs;

  const toggle = (songId) => {
    setSelected(prev => prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]);
  };

  const handleDone = () => {
    if (selected.length === 0) return;
    addSongsToPlaylist(playlistId, selected);
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="flex justify-between items-center px-6 py-4 border-b border-medium fade-up">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">Add to Playlist</h1>
        <div className="w-8" />
      </header>

      <div className="px-6 py-3 fade-up-1">
        <div className="bg-surface-card rounded-full flex items-center px-4 h-10 w-full border border-border-subtle border-glow">
          <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[18px]">search</span>
          <input className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 p-0" placeholder="Search songs to add" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 fade-up-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <span className="material-symbols-outlined text-on-surface-variant text-[48px] mb-3">search_off</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">No songs found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map(song => {
              const isSelected = selected.includes(song.id);
              return (
                <button key={song.id} onClick={() => toggle(song.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-variant transition-colors group w-full text-left">
                  <img src={song.cover} alt={song.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="flex-grow min-w-0">
                    <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{song.title}</p>
                    <p className="text-xs text-on-surface-variant truncate">{song.artistName}</p>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-primary text-background' : 'border border-outline-variant text-transparent'
                  }`}>
                    {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full p-4 z-20 bg-surface-dim/95 backdrop-blur-xl rounded-t-2xl border-t border-border-subtle">
          <button onClick={handleDone} className="bg-primary text-background rounded-full h-14 w-full flex items-center justify-center font-headline-md text-headline-md press-feedback transition-transform shadow-[0_0_20px_rgba(214,255,61,0.3)] glow-pulse">
            Done ({selected.length} added)
          </button>
        </div>
      )}
    </div>
  );
}
