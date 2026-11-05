import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { music } from '../services/music';
import { externalLinkFor } from '../utils/externalLink';
import CoverImage from '../components/CoverImage';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';
import { ChartsSkeleton } from '../components/skeleton';

const CHART_TABS = [
  { key: 'live', label: 'Live', icon: 'bolt' },
  { key: 'global', label: 'Global', icon: 'public' },
  { key: 'rising', label: 'Rising', icon: 'trending_up' },
  { key: 'local', label: 'Local', icon: 'music_note' },
];

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' }, { code: 'BR', name: 'Brazil' },
  { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'ZA', name: 'South Africa' },
  { code: 'GH', name: 'Ghana' }, { code: 'KE', name: 'Kenya' },
  { code: 'MX', name: 'Mexico' }, { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' }, { code: 'SE', name: 'Sweden' },
];

export default function Charts() {
  const navigate = useNavigate();
  const { audio, addRecentlyPlayed, playYouTube } = useApp();
  const [activeTab, setActiveTab] = useState('live');
  const [tracks, setTracks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState('NG');
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [chartError, setChartError] = useState(null);
  const listRef = useRef(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const loadChart = useCallback(async () => {
    setLoading(true);
    setChartError(null);
    try {
      if (activeTab === 'live') {
        // Live tab reads the internet; 'local' reuses the country selector.
        const scope = country ? 'country' : 'global';
        const chart = await music.getRealChart({ scope, country, limit: 50 });
        setTracks(chart.data || []);
        setMeta({
          sources: chart.sources,
          disclaimer: chart.disclaimer,
          generatedAt: chart.generatedAt,
          country: chart.country,
          scope: chart.scope,
        });
      } else {
        setMeta(null);
        if (activeTab === 'rising') {
          const rising = await music.getRising(50).catch(() => []);
          setTracks(rising);
        } else if (activeTab === 'local') {
          const local = await music.getChart('country', country, 50).catch(() => []);
          setTracks(local);
        } else {
          const trending = await music.getTrending(50).catch(() => []);
          setTracks(trending);
        }
      }
    } catch (e) {
      console.log('Charts load failed:', e);
      setChartError(e?.message || 'Could not load the live chart.');
      setTracks([]);
    }
    setLoading(false);
  }, [activeTab, country]);

  useEffect(() => { loadChart(); }, [loadChart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChart();
    setRefreshing(false);
    setPullDistance(0);
  }, [loadChart]);

  const handleTouchStart = (e) => {
    if (listRef.current && listRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && listRef.current && listRef.current.scrollTop <= 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  };

  const handleTouchEnd = () => {
    isPulling.current = false;
    if (pullDistance > 50 && !refreshing) {
      onRefresh();
    } else {
      setPullDistance(0);
    }
  };

  useGSAP(() => {
    if (prefersReduced || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-chart-item]');
    gsap.fromTo(items,
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'power3.out', overwrite: 'auto', delay: 0.1 }
    );
  }, { dependencies: [activeTab, loading] });

  const playTrack = (track, index) => {
    if (!track) return;
    // YouTube chart rows have no audio stream; they play in the IFrame overlay.
    if (track.playbackType === 'youtube' && track.videoId) {
      const ytQueue = tracks.filter(t => t.playbackType === 'youtube' && t.videoId);
      playYouTube(track, ytQueue);
      music.trackEvent('play', track.id, 'youtube').catch(() => {});
      return;
    }
    addRecentlyPlayed(track.id);
    let src = null;
    if (track.playbackType === 'full') {
      src = track.streamUrl || track.audioUrl;
    } else if (track.playbackType === 'preview') {
      src = track.previewUrl;
    } else if (track.playbackType === 'external') {
      const ext = externalLinkFor(track);
      if (ext) {
        if (ext.isYouTube) playYouTube({ ...track, videoId: ext.videoId || track.videoId }, [track]);
        else window.open(ext.url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (src) {
      audio.play({ ...track, audioUrl: src }, tracks);
      music.trackEvent('play', track.id, track.provider).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <header className="px-5 pt-12 pb-3">
        <h1 className="font-headline-xl text-headline-xl text-on-surface">Charts</h1>
        <p className="text-[13px] text-on-surface-variant mt-1">
          {activeTab === 'live' ? 'Live chart from YouTube, Deezer and Google' : 'Trending music across all providers'}
        </p>
      </header>

      {/* The four tabs are wider than a 375px viewport together, so this rail
          scrolls horizontally instead of widening the page. `overflow-x-auto`
          contains the row; the tab itself needs `shrink-0` so it keeps its
          natural width rather than being squeezed. */}
      <div className="px-5 mb-4 flex gap-2 overflow-x-auto hide-scrollbar">
        {CHART_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full font-body-sm text-body-sm font-semibold transition-all press-feedback ${
              activeTab === tab.key
                ? 'bg-primary text-background'
                : 'bg-surface-card text-on-surface-variant border border-border-subtle hover:bg-surface-card-hover'
            }`}>
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === 'local' || activeTab === 'live') && (
        <div className="px-5 mb-3">
          <div className="flex items-center gap-2 bg-surface-card rounded-xl border border-border-subtle px-3 py-2">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">location_on</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="bg-transparent text-[13px] text-on-surface font-semibold outline-none flex-1 cursor-pointer">
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code} className="bg-background text-on-surface">{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {meta?.sources?.length > 0 && (
        <div className="px-5 mb-3 flex flex-wrap gap-1.5">
          {meta.sources.map(s => (
            <span key={s.key} className="px-2 py-1 rounded-full bg-surface-card border border-border-subtle text-[10px] font-semibold text-on-surface-variant">
              {s.label} · {s.metric}
            </span>
          ))}
        </div>
      )}

      {/* Only the first load gets the full skeleton. A pull-to-refresh keeps the
          existing rows on screen behind the refresh indicator, so replacing them
          with placeholders would be a regression. */}
      {(loading || refreshing) && pullDistance === 0 ? (
        tracks.length === 0 ? (
          <div className="flex-1">
            <ChartsSkeleton />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-[13px] text-on-surface-variant">Loading charts...</p>
            </div>
          </div>
        )
      ) : tracks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[48px]">leaderboard</span>
            <p className="text-[14px] text-on-surface-variant">
              {chartError
                ? chartError
                : activeTab === 'live'
                  ? 'No live chart data available right now. Pull down to retry.'
                  : activeTab === 'rising'
                    ? 'No rising chart data yet. Charts build as users listen to music. Check back after a few listening sessions.'
                    : activeTab === 'local'
                      ? 'Local charts will appear as listening data accumulates from your region.'
                      : 'No chart data yet'}
            </p>
            <p className="text-[12px] text-on-surface-variant/60">Charts update every 30 minutes</p>
          </div>
        </div>
      ) : (
        <div ref={listRef} className="flex-1 overflow-y-auto hide-scrollbar px-5"
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {pullDistance > 0 && (
            <div className="flex justify-center py-2 transition-all" style={{ height: pullDistance }}>
              <div className={`w-6 h-6 rounded-full border-2 border-primary border-t-transparent ${refreshing ? 'animate-spin' : ''}`}
                style={{ transform: refreshing ? '' : `rotate(${pullDistance * 3}deg)` }} />
            </div>
          )}
          {tracks.map((track, i) => (
            <button key={track.id || i} data-chart-item onClick={() => playTrack(track, i)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-card transition-all press-feedback group w-full text-left mb-1">
              <span className={`w-8 text-center font-headline-sm text-headline-sm shrink-0 ${
                i < 3 ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}>
                {i + 1}
              </span>
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative bg-surface-card">
                <CoverImage src={track.cover || track.artworkUrl} alt={track.title} type="song" className="w-full h-full" rounded="rounded-xl" />
                <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {track.playbackType === 'youtube' ? (
                    <span className="w-7 h-7 rounded-full bg-red-600/90 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[14px] icon-fill">play_arrow</span>
                    </span>
                  ) : track.playbackType === 'full' ? (
                    <span className="w-7 h-7 rounded-full bg-green-500/90 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[14px] icon-fill">play_arrow</span>
                    </span>
                  ) : track.playbackType === 'preview' ? (
                    <span className="w-7 h-7 rounded-full bg-amber-500/90 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[14px]">headphones</span>
                    </span>
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-blue-500/90 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[14px]">open_in_new</span>
                    </span>
                  )}
                </div>
                {track.provider && track.provider !== 'local' && (
                  <span className="absolute -bottom-0.5 -right-0.5 px-1 py-0 rounded text-[7px] font-bold uppercase bg-black/60 text-white/80 backdrop-blur-sm">
                    {track.provider}
                  </span>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-[14px] font-semibold text-on-surface truncate">{track.title}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] text-on-surface-variant truncate">{track.artistName}</p>
                  {track.playbackType === 'youtube' && (
                    <span className="text-[9px] font-bold text-red-500 shrink-0">YouTube</span>
                  )}
                  {track.playbackType === 'preview' && (
                    <span className="text-[9px] font-bold text-amber-500 shrink-0">Preview</span>
                  )}
                  {track.playbackType === 'full' && (
                    <span className="text-[9px] font-bold text-green-500 shrink-0">Full</span>
                  )}
                  {track.playbackType === 'external' && (
                    <span className="text-[9px] font-bold text-blue-500 shrink-0">Open</span>
                  )}
                </div>
                {track.googleTrending && (
                  <p className="text-[10px] text-amber-500/90 truncate mt-0.5">
                    Trending on Google{track.googleTrafficLabel ? ` · ${track.googleTrafficLabel} searches` : ''}
                  </p>
                )}
              </div>
              {/* The real, measured value that positioned this row. */}
              {track.realSignal && track.realSignal.signal !== 'none' ? (
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-bold text-on-surface-variant">{track.realSignal.label}</p>
                  <p className="text-[9px] text-on-surface-variant/50">{track.realSignal.detail}</p>
                </div>
              ) : track.popularity > 0 ? (
                <span className="text-[10px] text-on-surface-variant/60 shrink-0">
                  {track.popularity >= 1000000 ? `${(track.popularity / 1000000).toFixed(1)}M` : track.popularity >= 1000 ? `${(track.popularity / 1000).toFixed(0)}K` : track.popularity}
                </span>
              ) : null}
            </button>
          ))}
          {meta?.disclaimer && (
            <div className="px-3 py-3 mt-2 rounded-xl bg-surface-card/50 border border-border-subtle">
              <p className="text-[10px] text-on-surface-variant/70 leading-relaxed">{meta.disclaimer}</p>
              {meta.generatedAt && (
                <p className="text-[10px] text-on-surface-variant/40 mt-1">
                  Updated {new Date(meta.generatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}
