import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';

export default function CreatePlaylist() {
  const navigate = useNavigate();
  const { createPlaylist } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { setError('Playlist name is required'); return; }
    const playlist = createPlaylist(name, description);
    navigate(`/add-songs/${playlist.id}`, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background px-6 page-enter">
      <header className="flex justify-between items-center py-4 fade-up">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">Create Playlist</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col items-center pt-4 fade-up-1">
        <div className="w-40 h-40 rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 mb-6 hover:border-primary transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-on-surface-variant text-[32px]">photo_camera</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Upload Cover</span>
        </div>

        <div className="w-full max-w-md flex flex-col gap-4">
          <div>
            <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">Playlist Name</label>
            <input
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-4 py-3 text-on-surface font-body-lg text-body-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="Give your playlist a name"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
            />
            {error && <span className="text-error text-xs mt-1 block">{error}</span>}
          </div>
          <div>
            <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">Description</label>
            <textarea
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-4 py-3 text-on-surface font-body-lg text-body-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all h-24 resize-none"
              placeholder="What's the vibe?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-body-lg text-body-lg text-on-surface">Public Playlist</span>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? 'bg-primary' : 'bg-surface-variant'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all ${isPublic ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="pb-6 pt-4">
        <button onClick={handleCreate} className="bg-primary text-background rounded-full h-14 w-full flex items-center justify-center font-headline-md text-headline-md press-feedback transition-transform shadow-[0_0_20px_rgba(214,255,61,0.3)] glow-pulse">
          Create & Add Songs
        </button>
      </div>
    </div>
  );
}
