import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useI18n } from '../context/I18nContext';
import { music } from '../services/music';
import { youtube } from '../services/youtube';
import { externalLinkFor } from '../utils/externalLink';
import CoverImage from '../components/CoverImage';
import ArtistAvatar from '../components/ArtistAvatar';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';
import { SearchSkeleton } from '../components/skeleton';

function mergeUnique(...arrays) {
  const seen = new Set();
  const result = [];
  for (const arr of arrays) {
    for (const item of arr) {
      if (!seen.has(item.id)) { seen.add(item.id); result.push(item); }
    }
  }
  return result;
}

export default function SearchResults() {
  const navigate = useNavigate();
  const { query: urlQuery } = useParams();
  const { t } = useI18n();
  const [query, setQuery] = useState(() => {
    try { return decodeURIComponent(urlQuery || ''); } catch { return urlQuery || ''; }
  });
  const [activeFilter, setActiveFilter] = useState(t('SEARCH_FILTER_ALL'));
  const { audio, addRecentlyPlayed, playYouTube } = useApp();

  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setTracks([]); setArtists([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // YouTube resolves independently so a slow/failed scrape never blocks
        // the catalog results.
        const ytPromise = youtube.search(query, 20).catch((e) => {
          console.log('YouTube search failed:', e);
          return [];
        });
        const [searchTracks, searchArtists, ytTracks] = await Promise.all([
          music.searchTracks(query, 30).catch(() => []),
          music.searchArtists(query, 10).catch(() => []),
          ytPromise,
        ]);
        setTracks(mergeUnique(searchTracks, ytTracks));
        setArtists(searchArtists);
      } catch (e) { console.log('Search failed:', e); }
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const filters = [t('SEARCH_FILTER_ALL'), t('SEARCH_FILTER_SONGS'), t('SEARCH_FILTER_ARTISTS'), t('SEARCH_FILTER_ALBUMS')];

  const allSongs = tracks;
  const allArtists = artists;
  const topArtist = allArtists[0];
  const hasResults = allSongs.length + allArtists.length > 0;

  const playSong = (song) => {
    // YouTube plays in the IFrame overlay, not the <audio> engine.
    if (song.playbackType === 'youtube') {
      playYouTube(song, allSongs);
      return;
    }
    addRecentlyPlayed(song.id);
    if (song.playbackType === 'full') {
      const src = song.streamUrl || song.audioUrl;
      if (src) {
        audio.play({ ...song, audioUrl: src }, allSongs);
        music.trackEvent('play', song.id, song.provider).catch(() => {});
      }
      return;
    }
    if (song.playbackType === 'preview') {
      if (song.previewUrl) {
        audio.play({ ...song, audioUrl: song.previewUrl }, allSongs);
        music.trackEvent('play', song.id, song.provider).catch(() => {});
      }
      return;
    }
        if (song.playbackType === 'external') {
          const ext = externalLinkFor(song);
          if (ext) {
            if (ext.isYouTube) playYouTube({ ...song, videoId: ext.videoId || song.videoId }, [song]);
            else window.open(ext.url, '_blank', 'noopener,noreferrer');
          }
          return;
    }
    // Unavailable: no playable source
  };

  const formatDuration = (s) => {
    if (!s) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resultsRef = useRef(null);
  const prevQueryRef = useRef('');

  useGSAP(() => {
    if (prefersReduced || !resultsRef.current || query === prevQueryRef.current) return;
    prevQueryRef.current = query;

    const items = resultsRef.current.querySelectorAll('[data-animate]');
    if (!items.length) return;

    gsap.fromTo(items,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'power3.out', overwrite: 'auto', delay: 0.1 }
    );
  }, { dependencies: [query, loading] });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl px-6 pt-4 pb-3">
        <div className="bg-surface-card border border-border-subtle rounded-full flex items-center px-4 h-12 w-full">
          <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
          <input
            className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant p-0 outline-none"
            placeholder={t('SEARCH_PLACEHOLDER')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            enterKeyHint="search"
            autoFocus
          />
          {query && <button onClick={() => setQuery('')} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback"><span className="material-symbols-outlined text-[20px]">close</span></button>}
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-1.5 rounded-full font-body-sm text-body-sm whitespace-nowrap transition-all press-feedback ${
              activeFilter === f ? 'bg-primary text-background font-semibold' : 'bg-surface-card text-on-surface-variant border border-border-subtle hover:bg-surface-card-hover'
            }`}>{f}</button>
          ))}
        </div>
      </div>

      {/* While a search is genuinely in flight, show result-shaped placeholders
          in the results area instead of a spinner. Driven by the real request
          state, so an error or an empty response falls through to the existing
          empty state below. */}
      <div className="px-6 py-4 flex-1">
        {loading && query.trim() ? (
          <SearchSkeleton />
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center h-64 text-center fade-up">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[48px] mb-4">search</span>
            <p className="font-body-lg text-body-lg text-on-surface-variant">{t('SEARCH_EMPTY_STATE')}</p>
          </div>
        ) : !hasResults && !loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-center fade-up">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[48px] mb-4">search_off</span>
            <p className="font-headline-md text-headline-md text-on-surface mb-2">{t('SEARCH_NO_RESULTS')}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t('SEARCH_TRY_DIFFERENT')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {topArtist && (activeFilter === t('SEARCH_FILTER_ALL') || activeFilter === t('SEARCH_FILTER_ARTISTS')) && (
              <section className="fade-up">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-3">{t('SEARCH_TOP_RESULT')}</h3>
                <button onClick={() => navigate(`/artist/${topArtist.id}`, { state: { artistName: topArtist.name } })} className="w-full bg-surface-card rounded-2xl border border-border-subtle p-4 flex items-center gap-4 hover:border-primary/20 transition-all press-feedback">
                  <ArtistAvatar name={topArtist.name} photo={topArtist.photo} className="w-20 h-20" rounded="rounded-full" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-headline-md text-headline-md text-on-surface truncate">{topArtist.name}</span>
                    <span className="font-label-caps text-label-caps text-primary mt-1">{t('SEARCH_ARTIST_BADGE')}</span>
                  </div>
                </button>
              </section>
            )}

            {allSongs.length > 0 && (activeFilter === t('SEARCH_FILTER_ALL') || activeFilter === t('SEARCH_FILTER_SONGS')) && (
              <section className="fade-up fade-up-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-headline-md text-headline-md text-on-surface">{t('SEARCH_FILTER_SONGS')}</h3>
                  <span className="text-[12px] text-on-surface-variant">{allSongs.length} tracks</span>
                </div>
                <div className="flex flex-col gap-1">
                  {allSongs.map((song) => (
                    <button key={song.id} onClick={() => playSong(song)} data-animate className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-card transition-all press-feedback group w-full text-left">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative">
                        <CoverImage src={song.cover} alt={song.title} type="song" className="w-full h-full" rounded="rounded-xl" />
                        <div className="absolute inset-0 bg-background/30 flex items-center justify-center">
                          {song.playbackType === 'youtube' ? (
                            <span className="w-7 h-7 rounded-full bg-red-600/90 flex items-center justify-center shadow-md">
                              <span className="material-symbols-outlined text-white text-[14px] icon-fill">play_arrow</span>
                            </span>
                          ) : song.playbackType === 'full' ? (
                            <span className="w-7 h-7 rounded-full bg-green-500/90 flex items-center justify-center shadow-md">
                              <span className="material-symbols-outlined text-white text-[14px] icon-fill">play_arrow</span>
                            </span>
                           ) : song.playbackType === 'preview' ? (
                             <span className="w-7 h-7 rounded-full bg-amber-500/90 flex items-center justify-center shadow-md">
                               <span className="material-symbols-outlined text-white text-[14px]">headphones</span>
                             </span>
                           ) : song.playbackType === 'external' ? (
                             <span className="w-7 h-7 rounded-full bg-blue-500/90 flex items-center justify-center shadow-md">
                               <span className="material-symbols-outlined text-white text-[14px]">open_in_new</span>
                             </span>
                           ) : (
                             <span className="w-7 h-7 rounded-full bg-on-surface-variant/30 flex items-center justify-center shadow-md">
                               <span className="material-symbols-outlined text-white text-[14px]">block</span>
                             </span>
                           )}
                        </div>
                        {song.provider && song.provider !== 'local' && (
                          <span className="absolute -bottom-0.5 -right-0.5 px-1 py-0 rounded text-[7px] font-bold uppercase bg-black/60 text-white/80 backdrop-blur-sm">
                            {song.provider}
                          </span>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{song.title}</p>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); if (song.artistId) navigate(`/artist/${song.artistId}`, { state: { artistName: song.artistName } }); }} className="text-xs text-on-surface-variant truncate text-left hover:text-primary transition-colors">{song.artistName}</button>
                           {song.playbackType === 'youtube' && (
                             <span className="text-[9px] font-bold text-red-500 shrink-0">YouTube</span>
                           )}
                           {song.playbackType === 'preview' && (
                             <span className="text-[9px] font-bold text-amber-500 shrink-0">Preview</span>
                           )}
                           {song.playbackType === 'full' && (
                             <span className="text-[9px] font-bold text-green-500 shrink-0">Full</span>
                           )}
                           {song.playbackType === 'external' && (
                             <span className="text-[9px] font-bold text-blue-500 shrink-0">Open</span>
                           )}
                           {song.playbackType === 'unavailable' && (
                             <span className="text-[9px] font-bold text-on-surface-variant/50 shrink-0">Unavailable</span>
                           )}
                         </div>
                       </div>
                       <span className="text-xs text-on-surface-variant shrink-0">{formatDuration(song.duration)}</span>
                     </button>
                   ))}
                </div>
              </section>
            )}

            {allArtists.length > 0 && (activeFilter === t('SEARCH_FILTER_ALL') || activeFilter === t('SEARCH_FILTER_ARTISTS')) && (
              <section className="fade-up fade-up-2">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-3">{t('SEARCH_FILTER_ARTISTS')}</h3>
                <div className="flex flex-col gap-2">
                  {allArtists.map((artist) => (
                    <button key={artist.id} onClick={() => navigate(`/artist/${artist.id}`, { state: { artistName: artist.name } })}
                      data-animate
                      className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-card transition-all press-feedback group w-full text-left">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-surface-card">
                        <CoverImage src={artist.photo} alt={artist.name} type="artist" className="w-full h-full" rounded="rounded-full" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{artist.name}</p>
                        <p className="text-xs text-on-surface-variant">Artist</p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
