import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { GENRES, formatTime } from '../data/library';

const MOODS = ['chill', 'energy', 'romantic', 'uplifting', 'epic', 'intense', 'sad'];

export default function ArtistUpload() {
  const navigate = useNavigate();
  const { user, uploadTrack, isArtist } = useApp();
  const audioRef = useRef(null);
  const coverRef = useRef(null);
  const [title, setTitle] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [mood, setMood] = useState('chill');
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  if (!isArtist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter px-6">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">lock</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Artist Access Required</h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-6">
          You need an artist account to upload music. Contact the admin to get artist access.
        </p>
        <button onClick={() => navigate(-1)} className="btn-primary rounded-full px-8 py-3">
          Go Back
        </button>
      </div>
    );
  }

  const handleAudioSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioPreview(file.name);
    const tempAudio = new Audio(URL.createObjectURL(file));
    tempAudio.addEventListener('loadedmetadata', () => {
      setDuration(Math.floor(tempAudio.duration));
    });
  };

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!title.trim() || !audioFile) return;
    setUploading(true);
    setError('');
    const result = await uploadTrack(
      {
        title: title.trim(),
        albumName: albumName.trim() || 'Single',
        genre,
        mood,
        duration,
      },
      audioFile,
      coverFile
    );
    setUploading(false);
    if (result?.error) { setError(result.error); return; }
    setSuccess(true);
    setTimeout(() => navigate('/library'), 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter px-6">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center mb-6 animate-bounce">
          <span className="material-symbols-outlined text-green-500 text-[40px]">check_circle</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Track Submitted!</h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center">
          Your track "{title}" has been submitted for review. The admin will approve it shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="flex items-center gap-4 w-full px-6 py-4 bg-background/70 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Upload Track</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Share your music with the world</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
        {/* Cover Art */}
        <div className="flex justify-center fade-up">
          <button
            onClick={() => coverRef.current?.click()}
            className="w-40 h-40 rounded-2xl overflow-hidden border-2 border-dashed border-medium hover:border-primary transition-colors flex flex-col items-center justify-center gap-2 press-feedback"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <>
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">add_photo_alternate</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Add Cover Art</span>
              </>
            )}
          </button>
          <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
        </div>

        {/* Audio File */}
        <div className="fade-up fade-up-1">
          <label className="font-label-lg text-label-lg text-on-surface block mb-2">Audio File</label>
          <button
            onClick={() => audioRef.current?.click()}
            className="w-full h-14 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-center gap-2 text-on-surface-variant hover:border-primary transition-colors press-feedback"
          >
            <span className="material-symbols-outlined text-[20px]">audio_file</span>
            <span className="font-body-sm text-body-sm">{audioPreview || 'Select audio file (MP3, WAV, etc.)'}</span>
          </button>
          <input ref={audioRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />
          {duration > 0 && (
            <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">Duration: {formatTime(duration)}</p>
          )}
        </div>

        {/* Title */}
        <div className="fade-up fade-up-2">
          <label className="font-label-lg text-label-lg text-on-surface block mb-2">Track Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter track title"
            className="w-full h-12 px-4 rounded-xl bg-surface-card border border-border-subtle text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Album Name */}
        <div className="fade-up fade-up-3">
          <label className="font-label-lg text-label-lg text-on-surface block mb-2">Album / Single</label>
          <input
            type="text"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            placeholder="Leave blank for single"
            className="w-full h-12 px-4 rounded-xl bg-surface-card border border-border-subtle text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Genre */}
        <div className="fade-up fade-up-4">
          <label className="font-label-lg text-label-lg text-on-surface block mb-2">Genre</label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-surface-card border border-border-subtle text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary transition-colors appearance-none"
          >
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Mood */}
        <div className="fade-up fade-up-5">
          <label className="font-label-lg text-label-lg text-on-surface block mb-2">Mood</label>
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={`px-4 py-2 rounded-full font-body-sm text-body-sm transition-all press-feedback ${
                  mood === m
                    ? 'bg-primary text-background font-semibold'
                    : 'bg-surface-card text-on-surface-variant border border-border-subtle hover:border-primary/40'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Button */}
        <div className="mt-4 pb-8 fade-up fade-up-6">
          <button
            onClick={handleUpload}
            disabled={!title.trim() || !audioFile || uploading}
            className={`w-full h-14 rounded-full font-headline-md text-headline-md flex items-center justify-center gap-2 transition-all press-feedback ${
              title.trim() && audioFile && !uploading
                ? 'btn-primary'
                : 'bg-surface-card text-on-surface-variant cursor-not-allowed'
            }`}
          >
            {uploading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                Submitting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                Submit for Review
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
