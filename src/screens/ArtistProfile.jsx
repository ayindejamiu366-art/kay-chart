import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { music } from '../services/music';
import { youtube } from '../services/youtube';
import { externalLinkFor } from '../utils/externalLink';
import CoverImage from '../components/CoverImage';
import ArtistAvatar from '../components/ArtistAvatar';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';
import { ArtistProfileSkeleton } from '../components/skeleton';

function formatTime(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ArtistProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { audio, addRecentlyPlayed, playYouTube } = useApp();

  const stateArtistName = location.state?.artistName || '';

  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [ytTracks, setYtTracks] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const heroRef = useRef(null);
  const infoRef = useRef(null);
  const actionsRef = useRef(null);
  const tracksContainerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    loadArtist();
  }, [id]);

  // YouTube artist tracks resolve separately so the profile renders as soon as
  // the catalog data is in, and the page still works if the scrape fails.
  const artistName = artist?.name;
  useEffect(() => {
    if (!artistName) { setYtTracks([]); return; }
    let cancelled = false;
    setYtLoading(true);
    youtube.searchArtist(artistName, 25)
      .then(list => { if (!cancelled) setYtTracks(list); })
      .catch(e => console.log('YouTube artist load failed:', e))
      .finally(() => { if (!cancelled) setYtLoading(false); });
    return () => { cancelled = true; };
  }, [artistName]);

  useEffect(() => {
    if (prefersReduced || !artist) return;

    const tl = gsap.timeline({ delay: 0.15 });
    tl.from(infoRef.current, { y: 30, opacity: 0, duration: 0.5, ease: 'power3.out' })
      .from(actionsRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'power3.out' }, '-=0.2');

    if (tracksContainerRef.current) {
      const items = tracksContainerRef.current.children;
      tl.from(items, {
        x: -20, opacity: 0, duration: 0.3, stagger: 0.03, ease: 'power3.out',
      }, '-=0.1');
    }

    return () => tl.kill();
  }, [artist, loading]);

  useEffect(() => {
    if (prefersReduced || !scrollRef.current) return;
    const el = scrollRef.current;
    const handleScroll = () => {
      if (heroRef.current) gsap.set(heroRef.current, { y: el.scrollTop * 0.4 });
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const loadArtist = async () => {
    setLoading(true);
    try {
      const [artistData, artistTracks, artistAlbums] = await Promise.all([
        music.getArtist(id).catch(() => null),
        music.getArtistTopTracks(id, 30).catch(() => []),
        music.getArtistAlbums(id, 10).catch(() => []),
      ]);

      if (artistData) {
        setArtist(artistData);
      } else if (stateArtistName) {
        setArtist({ id, name: stateArtistName, photo: '', nbFans: 0 });
      }

      setTracks(artistTracks);
      setAlbums(artistAlbums);
    } catch (e) {
      console.log('Artist load failed:', e);
      if (stateArtistName) {
        setArtist({ id, name: stateArtistName, photo: '', nbFans: 0 });
      }
    }
    setLoading(false);
  };

  const playTrack = (track, queue) => {
    // YouTube plays in the IFrame overlay, not the <audio> engine.
    if (track.playbackType === 'youtube') {
      playYouTube(track, queue);
      return;
    }
    addRecentlyPlayed(track.id);
    if (track.playbackType === 'full') {
      const src = track.streamUrl || track.audioUrl;
      if (src) {
        audio.play({ ...track, audioUrl: src }, queue || tracks);
        music.trackEvent('play', track.id, track.provider).catch(() => {});
      }
      return;
    }
    if (track.playbackType === 'preview') {
      if (track.previewUrl) {
        audio.play({ ...track, audioUrl: track.previewUrl }, queue || tracks);
        music.trackEvent('play', track.id, track.provider).catch(() => {});
      }
      return;
    }
        if (track.playbackType === 'external') {
          const ext = externalLinkFor(track);
          if (ext) {
            if (ext.isYouTube) playYouTube({ ...track, videoId: ext.videoId || track.videoId }, [track]);
            else window.open(ext.url, '_blank', 'noopener,noreferrer');
          }
          return;
    }
    // Unavailable: no playable source
  };

  // Artists with no catalog entry have an otherwise dead play button; fall
  // back to their YouTube tracks so the page is always playable.
  const playArtistTop = () => {
    if (tracks.length) playTrack(tracks[0], tracks);
    else if (ytTracks.length) playYouTube(ytTracks[0], ytTracks);
  };

  const formatListeners = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  // While the artist is genuinely loading, render the page's own shape rather
  // than a centred spinner, so the hero, actions and track list are already in
  // place when the data lands. `loading` is only cleared when the request
  // settles, so a failure still reaches the not-found path below.
  if (loading) {
    return <ArtistProfileSkeleton />;
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-on-surface-variant">Artist not found</p>
      </div>
    );
  }

  const photo = artist.photo || '';

  return (
    <div ref={scrollRef} className="min-h-screen flex flex-col pb-8 bg-background overflow-y-auto">
      <div ref={heroRef} className="relative h-[50vh] min-h-[300px]" style={{ willChange: 'transform' }}>
        <CoverImage src={photo} alt={artist.name} type="artist" className="w-full h-full" rounded="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-6 w-10 h-10 rounded-full bg-background/40 backdrop-blur-sm flex items-center justify-center z-10 press-feedback">
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <div ref={infoRef} className="absolute bottom-6 left-6 right-6 z-10">
          <h1 className="font-display-lg text-display-lg text-on-surface leading-tight">{artist.name}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {formatListeners(artist.nbFans || artist.listeners)} followers
          </p>
        </div>
      </div>

      <div ref={actionsRef} className="flex items-center gap-4 px-6 py-4">
        <button onClick={() => setFollowing(!following)} className={`px-6 py-2 rounded-full font-body-sm text-body-sm font-semibold transition-all press-feedback ${
          following ? 'bg-primary text-background' : 'border border-on-surface/20 text-on-surface bg-transparent hover:border-on-surface/40'
        }`}>
          {following ? 'Following' : 'Follow'}
        </button>
        <button onClick={playArtistTop} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg press-feedback">
          <span className="material-symbols-outlined text-background icon-fill text-[28px]">play_arrow</span>
        </button>
        <button onClick={playArtistTop} className="w-10 h-10 rounded-full border border-on-surface/20 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors press-feedback">
          <span className="material-symbols-outlined text-[20px]">shuffle</span>
        </button>
      </div>

      <section className="px-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">All Tracks</h2>
          <span className="text-[12px] text-on-surface-variant">{tracks.length} tracks</span>
        </div>
        <div ref={tracksContainerRef} className="flex flex-col">
          {tracks.map((track, i) => (
            <button key={track.id} onClick={() => playTrack(track, tracks)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-card transition-all press-feedback group w-full text-left">
              <span className="w-6 text-center font-body-sm text-body-sm text-on-surface-variant group-hover:hidden">{i + 1}</span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center hidden group-hover:flex ${
                track.playbackType === 'full' ? 'bg-green-500' : track.playbackType === 'preview' ? 'bg-amber-500' : 'bg-blue-500'
              }`}>
                <span className="material-symbols-outlined text-white text-[16px] icon-fill">
                  {track.playbackType === 'full' ? 'play_arrow' : track.playbackType === 'preview' ? 'headphones' : 'open_in_new'}
                </span>
              </span>
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative">
                <CoverImage src={track.cover} alt={track.title} type="song" className="w-full h-full" rounded="rounded-lg" />
                {track.provider && track.provider !== 'local' && (
                  <span className="absolute -bottom-0.5 -right-0.5 px-1 py-0 rounded text-[7px] font-bold uppercase bg-black/60 text-white/80 backdrop-blur-sm">
                    {track.provider}
                  </span>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{track.title}</p>
                {track.playbackType === 'preview' && (
                  <p className="text-[10px] text-amber-500 font-bold">Preview</p>
                )}
                {track.playbackType === 'full' && (
                  <p className="text-[10px] text-green-500 font-bold">Full track</p>
                )}
                {track.playbackType === 'external' && (
                  <p className="text-[10px] text-blue-500 font-bold">External</p>
                )}
              </div>
              <span className="text-xs text-on-surface-variant shrink-0">{formatTime(track.duration)}</span>
            </button>
          ))}
          {tracks.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-on-surface-variant text-sm">No tracks available</p>
            </div>
          )}
        </div>
      </section>

      {ytTracks.length > 0 && (
        <section className="px-6 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-[20px]">smart_display</span>
              On YouTube
            </h2>
            <span className="text-[12px] text-on-surface-variant">{ytTracks.length} videos</span>
          </div>
          <div className="flex flex-col">
            {ytTracks.map((track, i) => (
              <button key={track.id} onClick={() => playYouTube(track, ytTracks)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-card transition-all press-feedback group w-full text-left">
                <span className="w-6 text-center font-body-sm text-body-sm text-on-surface-variant group-hover:hidden">{i + 1}</span>
                <span className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center hidden group-hover:flex">
                  <span className="material-symbols-outlined text-white text-[16px] icon-fill">play_arrow</span>
                </span>
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative">
                  <CoverImage src={track.cover} alt={track.title} type="song" className="w-full h-full" rounded="rounded-lg" />
                  <div className="absolute inset-0 bg-black/10" />
                  <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[7px] font-bold uppercase bg-black/70 text-white/90">
                    yt
                  </span>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{track.title}</p>
                  <p className="text-[10px] text-on-surface-variant truncate">{track.artistName}</p>
                </div>
                <span className="text-xs text-on-surface-variant shrink-0">{formatTime(track.duration)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {ytLoading && (
        <section className="px-6 mt-8 flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-[12px] text-on-surface-variant">Loading YouTube videos...</span>
        </section>
      )}

      {albums.length > 0 && (
        <section className="px-6 mt-6">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">Discography</h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-2">
            {albums.slice(0, 8).map(album => (
              <div key={album.id} className="snap-start shrink-0 flex flex-col gap-2 w-[140px] group cursor-pointer press-feedback">
                <div className="w-[140px] h-[140px] rounded-2xl overflow-hidden bg-surface-card border border-border-subtle group-hover:border-primary/20 transition-colors relative">
                  <CoverImage src={album.cover} alt={album.title} type="album" className="w-full h-full group-hover:scale-105 transition-transform duration-500" rounded="rounded-none" />
                </div>
                <div className="flex flex-col">
                  <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{album.title}</span>
                  <span className="text-[10px] text-on-surface-variant">{album.year || ''}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
