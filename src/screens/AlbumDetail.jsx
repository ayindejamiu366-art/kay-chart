import { useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { getAlbum, getAlbumSongs, formatTime } from '../data/library';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';
import { externalLinkFor } from '../utils/externalLink';

export default function AlbumDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  // `getAlbum` reads from the local library module, which is synchronous, so
  // there is no request to wait for. This is left as-is deliberately: adding a
  // skeleton here would mean inventing a loading state that the screen does not
  // have, and the "Album not found" branch below is reached immediately, which
  // is the correct behaviour for a synchronous lookup.
  const album = getAlbum(id);
  const albumSongs = getAlbumSongs(id);
  const { audio, currentTrack, isPlaying, addRecentlyPlayed, toggleLike, likedSongs, toggleDownload, downloads } = useApp();

  const coverRef = useRef(null);
  const infoRef = useRef(null);
  const actionsRef = useRef(null);
  const tracksRef = useRef(null);

  useEffect(() => {
    if (prefersReduced || !album) return;

    const tl = gsap.timeline({ delay: 0.1 });
    tl.from(coverRef.current, { scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(1.4)' })
      .from(infoRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'power3.out' }, '-=0.2')
      .from(actionsRef.current, { y: 15, opacity: 0, duration: 0.35, ease: 'power3.out' }, '-=0.1');

    if (tracksRef.current) {
      const items = tracksRef.current.children;
      tl.from(items, {
        x: -20,
        opacity: 0,
        duration: 0.3,
        stagger: 0.04,
        ease: 'power3.out',
      }, '-=0.1');
    }

    return () => tl.kill();
  }, [album]);

  if (!album) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-on-surface-variant">Album not found</p></div>;

  const playAll = (shuffled) => {
    if (albumSongs.length === 0) return;
    const tracks = shuffled ? [...albumSongs].sort(() => Math.random() - 0.5) : albumSongs;
    const playable = tracks.find(t => t.playbackType === 'full' || t.playbackType === 'preview') || tracks[0];
    addRecentlyPlayed(playable.id);
    audio.play(playable, tracks);
  };

  const playSong = (song) => {
    addRecentlyPlayed(song.id);
    if (song.playbackType === 'external') {
      const ext = externalLinkFor(song);
      if (ext) window.open(ext.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (song.playbackType === 'unavailable') return;
    audio.play(song, albumSongs);
  };

  return (
    <div className="min-h-screen flex flex-col pb-8 bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-3">
          <button className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback"><span className="material-symbols-outlined">share</span></button>
          <button className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback"><span className="material-symbols-outlined">more_vert</span></button>
        </div>
      </header>

      <div className="flex flex-col items-center px-6 pt-2">
        <div ref={coverRef} className="w-56 h-56 rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.6)] mb-6 group" style={{ willChange: 'transform' }}>
          <img src={album.cover} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        </div>
        <div ref={infoRef}>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface text-center mb-1">{album.title}</h1>
          <p className="font-body-lg text-body-lg text-primary mb-2 cursor-pointer hover:underline" onClick={() => navigate(`/artist/${album.artistId}`)}>{album.artistName}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">{album.year} · {album.totalSongs} Songs · {album.totalDuration}</p>
        </div>

        <div ref={actionsRef} className="flex items-center gap-4 mt-4">
          <button onClick={() => albumSongs.length > 0 && toggleLike(albumSongs[0].id)} className="text-on-surface-variant hover:text-primary transition-colors press-feedback">
            <span className={`material-symbols-outlined text-[24px] ${likedSongs.includes(albumSongs[0]?.id) ? 'icon-fill text-primary' : ''}`}>favorite</span>
          </button>
          <button onClick={() => albumSongs.length > 0 && toggleDownload(albumSongs[0].id)} className="text-on-surface-variant hover:text-primary transition-colors press-feedback">
            <span className={`material-symbols-outlined text-[24px] ${downloads.includes(albumSongs[0]?.id) ? 'icon-fill text-primary' : ''}`}>download</span>
          </button>
          <button onClick={() => playAll(true)} className="text-on-surface-variant hover:text-primary transition-colors press-feedback">
            <span className="material-symbols-outlined text-[24px]">shuffle</span>
          </button>
          <button onClick={() => playAll(false)} className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(214,255,61,0.3)] press-feedback glow-pulse">
            <span className="material-symbols-outlined text-background icon-fill text-[32px]">play_arrow</span>
          </button>
        </div>
      </div>

      <section className="px-6 mt-6">
        <div ref={tracksRef} className="flex flex-col">
          {albumSongs.map((song, i) => {
            const isCurrent = currentTrack?.id === song.id;
            return (
              <button key={song.id} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-card transition-all press-feedback group w-full text-left">
                <div className="w-6 flex items-center justify-center">
                  {isCurrent && isPlaying ? (
                    <div className="flex items-end gap-[2px] h-4">
                      <div className="w-[3px] bg-primary rounded-full eq-bar" />
                      <div className="w-[3px] bg-primary rounded-full eq-bar" />
                      <div className="w-[3px] bg-primary rounded-full eq-bar" />
                    </div>
                  ) : (
                    <>
                      <span className={`font-body-sm text-body-sm ${isCurrent ? 'text-primary' : 'text-on-surface-variant'} group-hover:hidden`}>{i + 1}</span>
                      <span className="w-6 h-6 rounded-full bg-primary items-center justify-center hidden group-hover:flex"><span className="material-symbols-outlined text-background text-[16px]">play_arrow</span></span>
                    </>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className={`font-body-sm text-body-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>{song.title}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-on-surface-variant truncate">{song.artistName}</p>
                    {song.playbackType === 'preview' && (
                      <span className="text-[9px] font-bold text-amber-500 shrink-0">Preview</span>
                    )}
                    {song.playbackType === 'full' && (
                      <span className="text-[9px] font-bold text-green-500 shrink-0">Full</span>
                    )}
                    {song.playbackType === 'external' && (
                      <span className="text-[9px] font-bold text-blue-500 shrink-0">Open</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-on-surface-variant shrink-0">{formatTime(song.duration)}</span>
                <button className="text-on-surface-variant opacity-0 group-hover:opacity-100 touch-visible transition-opacity hover:text-primary press-feedback" onClick={(e) => { e.stopPropagation(); }}>
                  <span className="material-symbols-outlined text-[18px]">more_vert</span>
                </button>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
