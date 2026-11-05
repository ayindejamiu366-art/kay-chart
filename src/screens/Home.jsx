import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { music } from '../services/music';
import { youtube } from '../services/youtube';
import CoverImage from '../components/CoverImage';
import AppSidebar from '../components/AppSidebar';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';
import { detectCountry, getCountryName } from '../utils/country';
import { externalLinkFor } from '../utils/externalLink';
import { useCelebration } from '../context/CelebrationContext';
import { HomeSkeleton } from '../components/skeleton';

const QUICK_PICKS = [
  { label: 'Liked Songs', icon: 'favorite', path: '/liked-songs', color: 'from-primary/25 to-primary/5' },
  { label: 'Your Library', icon: 'library_music', path: '/library', color: 'from-secondary/25 to-secondary/5' },
  { label: 'Discover', icon: 'explore', path: '/explore', color: 'from-tertiary/25 to-tertiary/5' },
  { label: 'Top Charts', icon: 'leaderboard', path: '/charts', color: 'from-amber-500/25 to-amber-800/5' },
  { label: 'Downloads', icon: 'download', path: '/downloads', color: 'from-rose-500/25 to-rose-800/5' },
  { label: 'Now Playing', icon: 'graphic_eq', path: '/now-playing', color: 'from-violet-500/25 to-violet-800/5' },
];

const MIX_GRADIENTS = [
  'from-emerald-600/70 to-teal-900/70',
  'from-violet-600/70 to-purple-900/70',
  'from-amber-600/70 to-orange-900/70',
  'from-rose-600/70 to-pink-900/70',
  'from-cyan-600/70 to-blue-900/70',
  'from-fuchsia-600/70 to-purple-900/70',
];

const GENRE_GRADIENTS = [
  'from-rose-500/20 to-pink-600/30',
  'from-violet-500/20 to-purple-600/30',
  'from-amber-500/20 to-orange-600/30',
  'from-emerald-500/20 to-green-600/30',
  'from-sky-500/20 to-cyan-600/30',
  'from-fuchsia-500/20 to-pink-600/30',
  'from-red-500/20 to-rose-600/30',
  'from-teal-500/20 to-emerald-600/30',
  'from-indigo-500/20 to-blue-600/30',
];

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const trackKey = (t) => t && (t.id != null ? String(t.id) : `${t.artistName}-${t.title}`);

const playbackKind = (track) => {
  if (!track) return 'unavailable';
  if (track.playbackType) return track.playbackType;
  if (track.streamUrl || track.audioUrl) return 'full';
  if (track.previewUrl) return 'preview';
  return 'unavailable';
};

// Returns a track payload whose audioUrl is guaranteed to point at something the
// <audio> element can load, mirroring the convention in SearchResults.jsx.
const toPlayable = (track) => {
  const kind = playbackKind(track);
  if (kind === 'external' || kind === 'unavailable') return { kind, track };
  if (kind === 'preview') return { kind, track: { ...track, audioUrl: track.previewUrl } };
  const src = track.streamUrl || track.audioUrl;
  if (!src) return { kind: 'unavailable', track };
  return { kind, track: { ...track, audioUrl: src } };
};

const PlaybackBadge = ({ kind }) => {
  if (kind === 'full') return <span className="text-[9px] font-bold text-emerald-400 shrink-0">Full</span>;
  // Previews are upgraded to full-length official playback on click, so label
  // them by the source the user will actually hear rather than "Preview".
  if (kind === 'preview') return <span className="text-[9px] font-bold text-red-400 shrink-0">YouTube</span>;
  if (kind === 'external') return <span className="text-[9px] font-bold text-sky-400 shrink-0">Open</span>;
  return null;
};

function TopHeader() {
  const navigate = useNavigate();
  const { notifications } = useApp();
  const [query, setQuery] = useState('');
  const unread = notifications.filter(n => !n.read).length;

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search/${encodeURIComponent(q)}`);
    else navigate('/search');
  };

  return (
    <header className="h-[64px] shrink-0 flex items-center gap-3 px-4 sm:px-5 border-b border-border-subtle bg-surface-nav/40 backdrop-blur-xl">
      <div className="lg:hidden flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-[18px] icon-fill">music_note</span>
        </div>
      </div>

      <form onSubmit={submit} className="flex-1 min-w-0 max-w-xl">
        <div className="input-glass rounded-full flex items-center gap-3 px-4 h-10 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to play?"
            aria-label="Search"
            className="bg-transparent border-none focus:ring-0 text-on-surface text-[14px] placeholder:text-on-surface-variant p-0 outline-none flex-1 min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-on-surface-variant hover:text-on-surface press-feedback"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </form>

      <button
        onClick={() => navigate('/notifications')}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors press-feedback shrink-0"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </header>
  );
}

function NowPlayingPanel() {
  const navigate = useNavigate();
  const { audio, likedSongs, toggleLike, playYouTube } = useApp();
  const { currentTrack, isPlaying, togglePlay, queue, queueIndex, error } = audio;
  const isLiked = likedSongs.includes(currentTrack?.id);
  const extLink = externalLinkFor(currentTrack);

  const upNext = useMemo(() => {
    if (!currentTrack || !queue.length) return [];
    return queue.slice(queueIndex + 1, queueIndex + 7);
  }, [currentTrack, queue, queueIndex]);

  return (
    <aside className="hidden xl:flex w-[290px] shrink-0 flex-col border-l border-border-subtle bg-surface-nav/40">
      <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
        <section className="p-5 border-b border-border-subtle">
          <h2 className="font-headline-md text-on-surface mb-4">Now Playing</h2>

          {currentTrack ? (
            <>
              <div className="flex gap-3">
                <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 group relative">
                  <CoverImage
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    type="album"
                    className="w-full h-full"
                    rounded="rounded-xl"
                  />
                  <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-white text-[26px] icon-fill">
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-on-surface truncate">{currentTrack.title}</p>
                  <p className="text-[12px] text-on-surface-variant truncate mt-0.5">{currentTrack.artistName}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => toggleLike(currentTrack.id)}
                      aria-label={isLiked ? 'Unlike' : 'Like'}
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 press-feedback"
                    >
                      <span className={`material-symbols-outlined text-[17px] ${isLiked ? 'text-primary icon-fill' : 'text-on-surface-variant'}`}>
                        favorite
                      </span>
                    </button>
                    {extLink && (
                      <button
                        onClick={() => {
                          // A YouTube link plays in the overlay rather than
                          // bouncing the user out to the site.
                          if (extLink.isYouTube) {
                            playYouTube({ ...currentTrack, videoId: extLink.videoId || currentTrack.videoId }, [currentTrack]);
                            return;
                          }
                          window.open(extLink.url, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={extLink.label}
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 press-feedback"
                      >
                        <span className="material-symbols-outlined text-[17px] text-on-surface-variant">open_in_new</span>
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/queue')}
                      aria-label="Open queue"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 press-feedback"
                    >
                      <span className="material-symbols-outlined text-[17px] text-on-surface-variant">queue_music</span>
                    </button>
                  </div>
                </div>
              </div>
              {error && <p className="text-[11px] text-error mt-3">{error}</p>}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-medium px-4 py-6 text-center">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40">music_off</span>
              <p className="text-[12px] text-on-surface-variant mt-2">Nothing playing yet</p>
              <p className="text-[11px] text-on-surface-variant/60 mt-1">Pick a track to start your session.</p>
            </div>
          )}
        </section>

        {currentTrack?.artistId && (
          <section className="p-5 border-b border-border-subtle">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">About the Artist</h3>
            <button
              onClick={() => navigate(`/artist/${currentTrack.artistId}`, { state: { artistName: currentTrack.artistName } })}
              className="w-full flex items-center gap-3 text-left press-feedback"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                <CoverImage
                  src={currentTrack.artistPhoto}
                  alt={currentTrack.artistName}
                  type="artist"
                  className="w-full h-full"
                  rounded="rounded-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-on-surface truncate">{currentTrack.artistName}</p>
                <p className="text-[11px] text-primary mt-0.5">View artist</p>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">chevron_right</span>
            </button>
          </section>
        )}

        <section className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Up Next</h3>
            {upNext.length > 0 && (
              <button onClick={() => navigate('/queue')} className="text-[11px] text-primary hover:underline press-feedback">
                View all
              </button>
            )}
          </div>
          {upNext.length > 0 ? (
            <ul className="space-y-0.5">
              {upNext.map((t, i) => (
                <li key={trackKey(t) || i}>
                  <QueueRow track={t} onPlay={() => audio.play(toPlayable(t).track, queue)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-on-surface-variant/60">Your queue is empty.</p>
          )}
        </section>
      </div>
    </aside>
  );
}

function QueueRow({ track, onPlay }) {
  return (
    <button onClick={onPlay} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors press-feedback text-left">
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-card">
        <CoverImage src={track.cover} alt={track.title} type="song" className="w-full h-full" rounded="rounded-lg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-on-surface truncate">{track.title}</p>
        <p className="text-[10px] text-on-surface-variant truncate">{track.artistName}</p>
      </div>
      <PlaybackBadge kind={playbackKind(track)} />
    </button>
  );
}

function PlayerBar() {
  const navigate = useNavigate();
  const { audio, likedSongs, toggleLike } = useApp();
  const {
    currentTrack, isPlaying, isLoading, error,
    currentTime, duration, volume, shuffle, repeat,
    togglePlay, handleNext, handlePrev, seek,
    toggleShuffle, cycleRepeat, setVolumeLevel,
  } = audio;
  const isLiked = likedSongs.includes(currentTrack?.id);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const canSeek = Boolean(currentTrack) && duration > 0;

  const onScrub = (e) => {
    const next = Number(e.target.value);
    if (Number.isFinite(next)) seek(next);
  };

  return (
    <div data-tour="player" className="shrink-0 border-t border-border-subtle bg-surface-nav/85 backdrop-blur-xl">
      <div className="relative h-[3px] bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
        {canSeek && (
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={currentTime}
            onChange={onScrub}
            aria-label="Seek"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        )}
      </div>

      <div className="flex items-center gap-3 px-3 sm:px-4 h-[68px]">
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-[1.4]">
          <button
            onClick={() => currentTrack && navigate('/now-playing')}
            className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-surface-card press-feedback"
            aria-label="Open now playing"
          >
            {currentTrack ? (
              <CoverImage src={currentTrack.cover} alt={currentTrack.title} type="song" className="w-full h-full" rounded="rounded-lg" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-[20px]">music_note</span>
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-on-surface truncate">
              {currentTrack ? currentTrack.title : 'Nothing playing'}
            </p>
            <p className="text-[11px] text-on-surface-variant truncate">
              {currentTrack ? currentTrack.artistName : 'Choose a track to get started'}
            </p>
            {error && <p className="text-[10px] text-error truncate">{error}</p>}
          </div>
          {currentTrack && (
            <button
              onClick={() => toggleLike(currentTrack.id)}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full hover:bg-white/10 press-feedback shrink-0"
            >
              <span className={`material-symbols-outlined text-[18px] ${isLiked ? 'text-primary icon-fill' : 'text-on-surface-variant'}`}>
                favorite
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={`hidden md:flex w-8 h-8 items-center justify-center rounded-full press-feedback ${shuffle ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[18px]">shuffle</span>
          </button>
          <button
            onClick={handlePrev}
            disabled={!currentTrack}
            aria-label="Previous track"
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface disabled:opacity-40 press-feedback"
          >
            <span className="material-symbols-outlined text-[20px] icon-fill">skip_previous</span>
          </button>
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 press-feedback"
            style={{ boxShadow: '0 0 18px rgba(214,255,61,0.28)' }}
          >
            {isLoading ? (
              <span className="material-symbols-outlined text-[20px] text-on-primary animate-spin">progress_activity</span>
            ) : (
              <span className={`material-symbols-outlined text-[22px] text-on-primary icon-fill ${isPlaying ? '' : 'ml-0.5'}`}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            )}
          </button>
          <button
            onClick={handleNext}
            disabled={!currentTrack}
            aria-label="Next track"
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface disabled:opacity-40 press-feedback"
          >
            <span className="material-symbols-outlined text-[20px] icon-fill">skip_next</span>
          </button>
          <button
            onClick={cycleRepeat}
            aria-label="Repeat"
            className={`hidden md:flex w-8 h-8 items-center justify-center rounded-full press-feedback ${repeat !== 'off' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[18px]">{repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="text-[11px] text-on-surface-variant tabular-nums shrink-0">{formatTime(currentTime)}</span>
          <div className="h-[3px] w-full max-w-[180px] min-w-[60px] rounded-full bg-white/10 relative">
            <div className="h-full bg-on-surface-variant/70 rounded-full" style={{ width: `${progress}%` }} />
            {canSeek && (
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.5}
                value={currentTime}
                onChange={onScrub}
                aria-label="Seek"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            )}
          </div>
          <span className="text-[11px] text-on-surface-variant tabular-nums shrink-0">{formatTime(duration)}</span>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 ml-2">
            {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolumeLevel(Number(e.target.value))}
            aria-label="Volume"
            className="w-20 h-1 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

function TrackCard({ track, onPlay, width = 'w-[172px]', rank, loading = false }) {
  return (
    <button onClick={onPlay} disabled={loading} className={`${width} shrink-0 snap-start text-left group press-feedback ${loading ? 'opacity-70' : ''}`}>
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-surface-card mb-2.5">
        <CoverImage src={track.cover} alt={track.title} type="album" className="w-full h-full" rounded="rounded-2xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {rank != null && (
          <span className="absolute top-2 left-2 min-w-[22px] h-[22px] px-1 rounded-full bg-black/65 flex items-center justify-center text-[11px] font-bold text-white">
            {rank}
          </span>
        )}
        {loading ? (
          <span className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-black/70 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-on-surface text-[20px] animate-spin">progress_activity</span>
          </span>
        ) : (
          <span className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 touch-visible translate-y-1.5 group-hover:translate-y-0 transition-all press-feedback">
            <span className="material-symbols-outlined text-on-primary text-[20px] icon-fill">play_arrow</span>
          </span>
        )}
      </div>
      <p className="text-[13px] font-semibold text-on-surface truncate">{track.title}</p>
      <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{track.artistName}</p>
    </button>
  );
}

// One artist in the "Popular Artists" rail. The photo is the provider's own
// artwork; when a provider supplies none the initials are used rather than a
// stand-in image of somebody else.
function ArtistCard({ artist, onOpen, onPlay }) {
  const name = artist.name || 'Unknown';
  const initials = name.replace(/[^A-Za-z0-9\s]/g, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-[148px] shrink-0 snap-start">
      <div className="relative mb-2.5">
        <button
          onClick={onOpen}
          className="block w-full aspect-square rounded-2xl overflow-hidden bg-surface-card press-feedback"
          aria-label={`Open ${name}`}
        >
          {artist.photo ? (
            <img src={artist.photo} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-headline-md text-on-surface-variant">{initials}</span>
          )}
        </button>
        {artist.tracks?.length > 0 && (
          <button
            onClick={onPlay}
            aria-label={`Play ${name}`}
            className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-on-primary/90 flex items-center justify-center opacity-0 hover:opacity-100 focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-visible translate-y-1.5 hover:translate-y-0 transition-all"
          >
            <span className="material-symbols-outlined text-primary text-[20px] icon-fill">play_arrow</span>
          </button>
        )}
      </div>
      <p className="text-[13px] font-semibold text-on-surface truncate">{name}</p>
      <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
        {artist.totalTracks > 0 ? `${artist.totalTracks} track${artist.totalTracks === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-headline-md text-on-surface">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[12px] font-medium text-primary hover:underline press-feedback">
          {action}
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, audio, addRecentlyPlayed, recentlyPlayed, playYouTube, appendYouTubeQueue } = useApp();
  // Celebration context is ambient: the whole app is themed already, so this is
  // just a dismissible line of context.
  const { message: celebrationMessage, themeValues, bannerDismissed, setBannerDismissed } = useCelebration();
  const celebrationAccent = themeValues?.accent || 'rgb(var(--color-primary))';
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [rising, setRising] = useState([]);
  const [countryTracks, setCountryTracks] = useState([]);
  const [genres, setGenres] = useState([]);
  // Resolved live from the configured providers (real ids, real photos, real
  // tracks) so these artists are reachable without typing their name.
  const [featuredArtists, setFeaturedArtists] = useState([]);
  // Key of the row currently being matched to a YouTube video, so the row can
  // show a spinner instead of appearing to do nothing during the lookup.
  const [resolvingKey, setResolvingKey] = useState(null);
  const resolvingRef = useRef(false);
  const sectionsRef = useRef(null);

  const country = useMemo(() => detectCountry(), []);
  const countryName = useMemo(() => getCountryName(country), [country]);

  const userName = user?.name?.split(' ')[0] || 'there';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [homeRes, trendRes, countryRes, risingRes, artistsRes] = await Promise.allSettled([
        music.getHome(country).catch(() => null),
        music.getTrending(24).catch(() => []),
        music.getTracksByCountry(country, 12).catch(() => []),
        music.getRising(20).catch(() => []),
        music.getPopularArtists(12).catch(() => []),
      ]);
      if (cancelled) return;

      const home = homeRes.status === 'fulfilled' && homeRes.value ? homeRes.value : {};
      const dedupe = (list) => {
        const seen = new Set();
        return (Array.isArray(list) ? list : []).filter(t => {
          const k = trackKey(t);
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      };

      const merged = dedupe([...(home.trending || []), ...(trendRes.status === 'fulfilled' ? trendRes.value : [])]);
      setTrending(merged);
      setPopular(dedupe(home.popular || []).slice(0, 10));
      setRising(dedupe(risingRes.status === 'fulfilled' ? risingRes.value : []).slice(0, 10));
      setCountryTracks(dedupe(countryRes.status === 'fulfilled' ? countryRes.value : []).slice(0, 10));
      setGenres((home.genres || []).slice(0, 9));
      setFeaturedArtists(artistsRes.status === 'fulfilled' && Array.isArray(artistsRes.value) ? artistsRes.value : []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [country]);

  useGSAP(() => {
    if (loading || prefersReduced || !sectionsRef.current) return;
    gsap.from(sectionsRef.current.children, {
      y: 24,
      opacity: 0,
      duration: 0.45,
      stagger: 0.06,
      ease: 'power3.out',
      clearProps: 'all',
    });
  }, { dependencies: [loading] });

  const playTrack = useCallback(async (track, queue) => {
    if (!track) return;
    const { kind, track: payload } = toPlayable(track);
    if (kind === 'external') {
      if (track.externalUrl) window.open(track.externalUrl, '_blank', 'noopener');
      return;
    }
    if (kind === 'unavailable') return;

    // Deezer/Spotify rows only carry a 30-second clip, so trade the clip for
    // the full song on YouTube. Resolution costs a round trip, so the clicked
    // track plays as soon as it matches and the rest of the queue is filled in
    // behind it — waiting for every lookup would stall playback for seconds.
    if (kind === 'preview') {
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      const key = trackKey(track);
      setResolvingKey(key);
      let first = null;
      try {
        first = await youtube.resolve(track.title, track.artistName, track.duration);
      } catch {
        first = null;
      } finally {
        setResolvingKey(null);
        resolvingRef.current = false;
      }

      if (first) {
        playYouTube(first, [first]);
        music.trackEvent('play', track.id, 'youtube').catch(() => {});

        // Next/previous then walk real full-length tracks instead of ending at
        // a one-item queue.
        const queueList = Array.isArray(queue) ? queue : [];
        const at = queueList.findIndex(t => trackKey(t) === key);
        queueList
          .filter((t, i) => i !== at && playbackKind(t) === 'preview')
          .slice(0, 4)
          .forEach(t => {
            youtube.resolve(t.title, t.artistName, t.duration)
              .then(hit => { if (hit) appendYouTubeQueue([hit]); })
              .catch(() => {});
          });
        return;
      }
      // Unmatched: fall through to the 30-second clip.
    }

    audio.play(payload, queue && queue.length ? queue : [payload]);
    addRecentlyPlayed(track.id);
    music.trackEvent('play', track.id, track.provider).catch(() => {});
  }, [audio, addRecentlyPlayed, playYouTube, appendYouTubeQueue]);

  const recentTracks = useMemo(() => {
    const list = Array.isArray(recentlyPlayed) ? recentlyPlayed : [];
    const seen = new Set();
    return list.filter(t => {
      const k = trackKey(t);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 10);
  }, [recentlyPlayed]);

  // "Made for You" mixes are built from real catalogue data: genre buckets
  // first, then a fallback that chunks real tracks so the row is never fake.
  const mixes = useMemo(() => {
    const pool = dedupeById([...trending, ...popular, ...rising]);
    const used = new Set();
    const out = [];

    for (const g of genres) {
      const name = g?.name || g;
      if (!name) continue;
      const key = String(name).toLowerCase();
      const bucket = pool.filter(t => String(t.genre || '').toLowerCase() === key && !used.has(trackKey(t)));
      if (bucket.length < 3) continue;
      bucket.slice(0, 8).forEach(t => used.add(trackKey(t)));
      out.push({ id: `genre-${key}`, name: `${name} Mix`, subtitle: `${bucket.length} tracks`, tracks: bucket.slice(0, 8) });
    }

    if (out.length < 3) {
      const rest = pool.filter(t => !used.has(trackKey(t)));
      for (let i = 0; i + 2 < rest.length && out.length < 6; i += 5) {
        const chunk = rest.slice(i, i + 5);
        out.push({
          id: `mix-${i}`,
          name: `Kay Chart Mix ${String(out.length + 1).padStart(2, '0')}`,
          subtitle: `${chunk.length} tracks`,
          tracks: chunk,
        });
      }
    }

    return out.slice(0, 6);
  }, [genres, trending, popular, rising]);

  const topArtists = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const t of [...trending, ...rising, ...popular]) {
      if (!t.artistId || seen.has(t.artistId)) continue;
      seen.add(t.artistId);
      out.push({ id: t.artistId, name: t.artistName, photo: t.artistPhoto || t.cover });
      if (out.length >= 8) break;
    }
    return out;
  }, [trending, rising, popular]);

  const heroTrack = useMemo(
    () => trending.find(t => ['full', 'preview'].includes(playbackKind(t))) || trending[0] || null,
    [trending]
  );

  const hasContent = trending.length > 0 || popular.length > 0 || rising.length > 0 || countryTracks.length > 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />

        <main className="min-h-0 flex-1 overflow-y-auto hide-scrollbar pb-24 lg:pb-0">
          <div ref={sectionsRef} className="px-4 sm:px-6 py-5 space-y-8 max-w-[1500px]">
            {/* Optional, dismissible. The visual atmosphere is the main
                experience — this is only a quiet line of context. */}
            {/* While the first real load is in flight, show the Home layout as
                shapes. This is driven by the actual request state: `loading`
                starts true and is only cleared once the load settles, so an
                error or an empty response falls through to the real content and
                the existing "could not load" panel rather than showing a
                skeleton forever. */}
            {loading ? (
              <HomeSkeleton />
            ) : (
              <>
            {celebrationMessage && !bannerDismissed && (
              <div
                className="flex items-center gap-3 rounded-2xl border border-border-subtle/70 bg-surface-card/40 px-4 py-3"
                role="status"
              >
                <span className="material-symbols-outlined text-[20px] shrink-0" style={{ color: celebrationAccent }} aria-hidden="true">
                  celebration
                </span>
                <div className="min-w-0 flex-grow">
                  <p className="text-[13px] font-medium text-on-surface truncate">{celebrationMessage}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">Kay Chart has dressed up for the occasion.</p>
                </div>
                <button
                  onClick={() => setBannerDismissed(true)}
                  aria-label="Dismiss celebration message"
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors press-feedback"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                </button>
              </div>
            )}

            <section>
                <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-headline-xl text-on-surface">{greeting}, {userName}</h1>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {loading ? 'Tuning your station…' : `Fresh picks from ${countryName}.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => heroTrack && playTrack(heroTrack, trending)}
                    disabled={!heroTrack}
                    className="btn-primary px-5 py-2.5 rounded-full flex items-center gap-2 press-feedback disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px] icon-fill">play_arrow</span>
                    <span className="text-[13px] font-semibold">Start Listening</span>
                  </button>
                  <button
                    onClick={() => navigate('/explore')}
                    className="px-4 py-2.5 rounded-full bg-surface-card border border-border-subtle flex items-center gap-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-card-hover transition-colors press-feedback"
                  >
                    <span className="material-symbols-outlined text-[16px]">explore</span>
                    <span className="text-[13px]">Discover</span>
                  </button>
                </div>
              </div>
            </section>

            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {QUICK_PICKS.map(pick => (
                  <button
                    key={pick.label}
                    onClick={() => navigate(pick.path)}
                    className={`bg-gradient-to-br ${pick.color} rounded-2xl px-3.5 py-3.5 flex items-center gap-2.5 text-left hover:scale-[1.02] active:scale-[0.98] transition-transform border border-white/5 press-feedback`}
                  >
                    <span className="material-symbols-outlined text-white text-[20px] shrink-0">{pick.icon}</span>
                    <span className="text-white font-semibold text-[12px] leading-tight truncate">{pick.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {mixes.length > 0 && (
              <section>
                <SectionHeader title="Made for You" action="Browse" onAction={() => navigate('/library')} />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {mixes.map((mix, i) => (
                    <button
                      key={mix.id}
                      onClick={() => playTrack(mix.tracks[0], mix.tracks)}
                      className="w-[172px] shrink-0 snap-start text-left group press-feedback"
                    >
                      <div className={`relative w-full aspect-square rounded-2xl bg-gradient-to-br ${MIX_GRADIENTS[i % MIX_GRADIENTS.length]} mb-2.5 overflow-hidden`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white/70 text-[34px] icon-fill">playlist_play</span>
                        </div>
                        <span className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-on-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1.5 group-hover:translate-y-0 transition-all">
                          <span className="material-symbols-outlined text-primary text-[20px] icon-fill">play_arrow</span>
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-on-surface truncate">{mix.name}</p>
                      <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{mix.subtitle}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {recentTracks.length > 0 && (
              <section>
                <SectionHeader title="Recently Played" action="History" onAction={() => navigate('/library')} />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {recentTracks.map(t => (
                    <TrackCard key={trackKey(t)} track={t} loading={resolvingKey === trackKey(t)} onPlay={() => playTrack(t, recentTracks)} />
                  ))}
                </div>
              </section>
            )}

            {featuredArtists.length > 0 && (
              <section>
                <SectionHeader title="Popular Artists" action="Search" onAction={() => navigate('/search')} />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {featuredArtists.map(artist => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onOpen={() => navigate(`/artist/${artist.id}`, { state: { artistName: artist.name } })}
                      onPlay={() => artist.tracks?.[0] && playTrack(artist.tracks[0], artist.tracks)}
                    />
                  ))}
                </div>
              </section>
            )}

            {trending.length > 0 && (
              <section>
                <SectionHeader title="Trending Music" action="See all" onAction={() => navigate('/charts')} />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {trending.slice(0, 10).map((t, i) => (
                    <TrackCard key={trackKey(t)} track={t} rank={i + 1} loading={resolvingKey === trackKey(t)} onPlay={() => playTrack(t, trending)} />
                  ))}
                </div>
              </section>
            )}

            {countryTracks.length > 0 && (
              <section>
                <SectionHeader title={`Top in ${countryName}`} action="Explore" onAction={() => navigate('/explore')} />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {countryTracks.map(t => (
                    <TrackCard key={trackKey(t)} track={t} loading={resolvingKey === trackKey(t)} onPlay={() => playTrack(t, countryTracks)} />
                  ))}
                </div>
              </section>
            )}

            {rising.length > 0 && (
              <section>
                <SectionHeader title="Rising Now" action="See all" onAction={() => navigate('/charts')} />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {rising.map(t => (
                    <TrackCard key={trackKey(t)} track={t} loading={resolvingKey === trackKey(t)} onPlay={() => playTrack(t, rising)} />
                  ))}
                </div>
              </section>
            )}

            {popular.length > 0 && (
              <section>
                <SectionHeader title="Top Charts" action="Full charts" onAction={() => navigate('/charts')} />
                <div className="space-y-0.5">
                  {popular.map((t, i) => (
                    <button
                      key={trackKey(t)}
                      onClick={() => playTrack(t, popular)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-card transition-colors press-feedback group text-left"
                    >
                      <span className="text-[14px] font-bold text-on-surface-variant w-5 text-center shrink-0 tabular-nums">{i + 1}</span>
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <CoverImage src={t.cover} alt={t.title} type="song" className="w-full h-full" rounded="rounded-lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface truncate">{t.title}</p>
                        <p className="text-[11px] text-on-surface-variant truncate">{t.artistName}</p>
                      </div>
                      <PlaybackBadge kind={playbackKind(t)} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {topArtists.length > 0 && (
              <section>
                <SectionHeader title="Artists You Should Know" />
                <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
                  {topArtists.map(a => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/artist/${a.id}`, { state: { artistName: a.name } })}
                      className="w-[128px] shrink-0 snap-start text-center group press-feedback"
                    >
                      <div className="w-full aspect-square rounded-full overflow-hidden bg-surface-card mb-2.5 border border-border-subtle group-hover:border-primary/40 transition-colors">
                        <CoverImage src={a.photo} alt={a.name} type="artist" className="w-full h-full" rounded="rounded-full" />
                      </div>
                      <p className="text-[12px] font-semibold text-on-surface truncate">{a.name}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {genres.length > 0 && (
              <section>
                <SectionHeader title="Browse Genres" action="All genres" onAction={() => navigate('/explore')} />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {genres.map((g, i) => {
                    const name = g?.name || g;
                    if (!name) return null;
                    return (
                      <button
                        key={g.id || name}
                        onClick={() => navigate(`/search/${encodeURIComponent(name)}`)}
                        className={`bg-gradient-to-br ${GENRE_GRADIENTS[i % GENRE_GRADIENTS.length]} border border-border-subtle rounded-2xl px-3 py-3.5 text-left hover:scale-[1.02] active:scale-[0.98] transition-transform press-feedback`}
                      >
                        <span className="material-symbols-outlined text-on-surface/50 text-[18px] mb-1 block">graphic_eq</span>
                        <p className="text-[12px] font-semibold text-on-surface truncate">{name}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {!hasContent && (
              <section className="rounded-3xl border border-dashed border-border-medium px-6 py-14 text-center">
                <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30">cloud_off</span>
                <p className="text-[15px] font-semibold text-on-surface mt-3">Could not load music right now</p>
                <p className="text-[13px] text-on-surface-variant mt-1">Check your connection and try again.</p>
                <button
                  onClick={() => navigate('/search')}
                  className="mt-4 px-5 py-2.5 rounded-full bg-surface-card border border-border-subtle text-[13px] text-on-surface press-feedback"
                >
                  Browse search instead
                </button>
              </section>
            )}
              </>
            )}
          </div>
        </main>

        <PlayerBar />
      </div>

      <NowPlayingPanel />
    </div>
  );
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter(t => {
    const k = trackKey(t);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
