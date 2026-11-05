import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ArtistAvatar from '../components/ArtistAvatar';
import { Skeleton, SkeletonText, SkeletonCircle } from '../components/skeleton';

const GENRE_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500',
  'bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-yellow-500',
];

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState(null);
  const [topSongs, setTopSongs] = useState([]);
  const [topArtists, setTopArtists] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [platRes, songsRes, artistsRes] = await Promise.allSettled([
        api.analytics.getPlatform(),
        api.analytics.getTopSongs(10),
        api.analytics.getTopArtists(5),
      ]);
      if (platRes.status === 'fulfilled') setPlatform(platRes.value);
      if (songsRes.status === 'fulfilled') setTopSongs(songsRes.value);
      if (artistsRes.status === 'fulfilled') setTopArtists(artistsRes.value);
    } catch (err) {
      console.error('Analytics load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatNum = (n) => {
    if (n == null) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const playsTrend = (() => {
    if (!platform?.playsByDay?.length) return null;
    const days = platform.playsByDay.slice(-7);
    const recent = days.slice(-3).reduce((s, d) => s + (d.count || 0), 0);
    const prev = days.slice(0, 3).reduce((s, d) => s + (d.count || 0), 0);
    if (recent > prev) return 'up';
    if (recent < prev) return 'down';
    return 'flat';
  })();

  const totalPlays30 = platform?.playsByDay?.reduce((s, d) => s + (d.count || 0), 0) || 0;

  // Skeleton rather than a spinner for the first load. The `!platform` guard is
  // the existing condition: a later manual refresh (the header's refresh button
  // sets `loading` again while `platform` is already populated) falls through to
  // the real dashboard, so visible statistics are never replaced by
  // placeholders. Nothing here invents a number — the stat slots are just shapes.
  if (loading && !platform) {
    return (
      <div className="min-h-screen flex flex-col bg-background page-enter">
        <header className="flex items-center gap-4 w-full px-6 py-4 bg-background/70 backdrop-blur-xl">
          <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Analytics</h1>
        </header>
        <div className="flex-1 px-6 pb-10">
          {/* Six stat tiles, matching the `statCards` grid below. */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-border-subtle bg-surface-card p-4">
                <Skeleton width={18} height={18} radius="5px" className="mb-3" />
                <Skeleton width={72} height={22} radius="6px" className="mb-2" />
                <SkeletonText width={92} height={11} />
              </div>
            ))}
          </div>
          {/* Chart panel and the two ranked lists. */}
          <div className="rounded-2xl border border-border-subtle bg-surface-card p-5 mb-6">
            <SkeletonText width={148} height={14} className="mb-5" />
            <div className="flex items-end gap-2 h-32">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton
                  key={i}
                  width="100%"
                  height={`${34 + ((i * 17) % 52)}%`}
                  radius="rounded-t-md"
                  className="flex-1"
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1].map((section) => (
              <div key={section} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
                <SkeletonText width={124} height={14} className="mb-4" />
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <SkeletonCircle size={36} />
                      <div className="flex-1 min-w-0">
                        <SkeletonText width="56%" height={13} className="mb-1.5" />
                        <SkeletonText width="32%" height={10} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: platform?.totalUsers, icon: 'people', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Songs', value: platform?.totalSongs, icon: 'music_note', color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Total Plays', value: platform?.totalPlays, icon: 'play_circle', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Likes', value: platform?.totalLikes, icon: 'favorite', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Pending Songs', value: platform?.pendingSongs, icon: 'pending', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Total Artists', value: platform?.totalArtists, icon: 'mic', color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ];

  const maxGenreCount = Math.max(...(platform?.topGenres || []).map(g => g.count || 0), 1);

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="flex items-center gap-4 w-full px-6 py-4 bg-background/70 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Analytics</h1>
        <div className="flex-1" />
        <button onClick={loadData} className="w-10 h-10 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center press-feedback">
          <span className={`material-symbols-outlined text-on-surface-variant ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-28">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {statCards.map((s) => (
            <div key={s.label} className="bg-surface-card rounded-2xl p-4 border border-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                </div>
              </div>
              <p className="font-headline-md text-headline-md text-on-surface">{formatNum(s.value)}</p>
              <p className="font-body-xs text-body-xs text-on-surface-variant">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Top Songs */}
        {topSongs.length > 0 && (
          <section className="mb-6">
            <h2 className="font-title-lg text-title-lg text-on-surface mb-3">Top Songs</h2>
            <div className="flex flex-col gap-2">
              {topSongs.map((song, i) => (
                <div key={song.id} className="bg-surface-card rounded-2xl p-3 border border-border-subtle flex items-center gap-3">
                  <span className="font-body-lg text-body-lg text-on-surface-variant w-6 text-center font-bold">{i + 1}</span>
                  {song.cover ? (
                    <img src={song.cover} alt={song.title} className="w-11 h-11 rounded-xl object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[20px]">music_note</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body-md text-body-md text-on-surface truncate">{song.title}</p>
                    <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{song.artist_name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-purple-400 text-[16px]">play_circle</span>
                      <span className="font-body-xs text-body-xs text-on-surface-variant">{formatNum(song.play_count)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-red-400 text-[16px]">favorite</span>
                      <span className="font-body-xs text-body-xs text-on-surface-variant">{formatNum(song.like_count)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Artists */}
        {topArtists.length > 0 && (
          <section className="mb-6">
            <h2 className="font-title-lg text-title-lg text-on-surface mb-3">Top Artists</h2>
            <div className="flex flex-col gap-3">
              {topArtists.map((artist) => (
                <div key={artist.id} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                  {artist.photo ? (
                    <ArtistAvatar name={artist.name} photo={artist.photo} className="w-14 h-14" rounded="rounded-full" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">person</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-body-md text-body-md text-on-surface truncate">{artist.name}</p>
                      {artist.verified && (
                        <span className="material-symbols-outlined text-blue-400 text-[16px]">verified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-purple-400 text-[14px]">play_circle</span>
                        <span className="font-body-xs text-body-xs text-on-surface-variant">{formatNum(artist.total_plays)} plays</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-blue-400 text-[14px]">group</span>
                        <span className="font-body-xs text-body-xs text-on-surface-variant">{formatNum(artist.followers)} followers</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Genres */}
        {platform?.topGenres?.length > 0 && (
          <section className="mb-6">
            <h2 className="font-title-lg text-title-lg text-on-surface mb-3">Top Genres</h2>
            <div className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex flex-col gap-3">
              {platform.topGenres.map((genre, i) => (
                <div key={genre.name || i} className="flex items-center gap-3">
                  <span className="font-body-sm text-body-sm text-on-surface-variant w-24 truncate shrink-0">{genre.name}</span>
                  <div className="flex-1 h-6 bg-background rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${GENRE_COLORS[i % GENRE_COLORS.length]}`}
                      style={{ width: `${((genre.count || 0) / maxGenreCount) * 100}%`, minWidth: 4 }}
                    />
                  </div>
                  <span className="font-body-xs text-body-xs text-on-surface-variant w-10 text-right shrink-0">{formatNum(genre.count)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Plays Over Time */}
        {platform?.playsByDay?.length > 0 && (
          <section className="mb-6">
            <h2 className="font-title-lg text-title-lg text-on-surface mb-3">Plays Over Time</h2>
            <div className="bg-surface-card rounded-2xl p-4 border border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <p className="font-body-sm text-body-sm text-on-surface-variant">Last 30 days</p>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">{formatNum(totalPlays30)}</span>
                  {playsTrend === 'up' && <span className="material-symbols-outlined text-green-400 text-[18px]">trending_up</span>}
                  {playsTrend === 'down' && <span className="material-symbols-outlined text-red-400 text-[18px]">trending_down</span>}
                  {playsTrend === 'flat' && <span className="material-symbols-outlined text-on-surface-variant text-[18px]">trending_flat</span>}
                </div>
              </div>
              <div className="flex items-end gap-[2px] h-24">
                {platform.playsByDay.map((day, i) => {
                  const maxCount = Math.max(...platform.playsByDay.map(d => d.count || 0), 1);
                  const height = ((day.count || 0) / maxCount) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-primary/70 hover:bg-primary transition-colors min-w-[2px]"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${day.date || day.day || ''}: ${day.count || 0} plays`}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* User Registrations */}
        {platform?.usersByDay?.length > 0 && (
          <section className="mb-6">
            <h2 className="font-title-lg text-title-lg text-on-surface mb-3">User Registrations</h2>
            <div className="bg-surface-card rounded-2xl p-4 border border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <p className="font-body-sm text-body-sm text-on-surface-variant">Last 30 days</p>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {formatNum(platform.usersByDay.reduce((s, d) => s + (d.count || 0), 0))}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {platform.usersByDay.map((day, i) => {
                  const maxCount = Math.max(...platform.usersByDay.map(d => d.count || 0), 1);
                  const width = ((day.count || 0) / maxCount) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="font-body-xs text-body-xs text-on-surface-variant w-16 truncate shrink-0">{day.date || day.day || ''}</span>
                      <div className="flex-1 h-4 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-secondary/70"
                          style={{ width: `${Math.max(width, 1)}%` }}
                        />
                      </div>
                      <span className="font-body-xs text-body-xs text-on-surface-variant w-8 text-right shrink-0">{day.count || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
