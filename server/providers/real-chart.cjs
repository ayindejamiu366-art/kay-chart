/**
 * Real Chart Builder
 *
 * Assembles the Charts screen from live internet sources and ranks with measured
 * values only. There is no synthetic "rating" invented here: every row carries
 * the real signal that positioned it (Deeer global rank, YouTube view count,
 * Google search volume) and the client renders that value directly.
 *
 * This is deliberately NOT a music provider and is not registered in
 * PROVIDER_FACTORIES. It produces chart metadata, never audio, so YouTube
 * tracks cannot leak into the native <audio> engine.
 */

const musicService = require('./music-service.cjs');
const { YouTubeChart } = require('./youtube-chart.cjs');
const { GoogleTrends } = require('./google-trends.cjs');

const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map();

function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn()
    .then(data => { cache.set(key, { ts: Date.now(), data }); return data; })
    .catch(e => {
      // Serve a stale chart rather than an empty screen if a refresh fails.
      if (hit) { console.error('[RealChart] refresh failed, serving stale:', e.message); return hit.data; }
      throw e;
    });
}

// The raw, measured value behind a row. Deezer's `rank` is a real global
// popularity rank where 1 is most streamed; YouTube contributes a real view
// count. Nothing here is synthesised.
function realSignal(t) {
  if (t.playbackType === 'youtube') {
    return {
      signal: 'views',
      value: t.viewCount || 0,
      label: formatCount(t.viewCount || 0),
      detail: 'YouTube views',
    };
  }
  if (t.rank > 0) {
    return { signal: 'deezerRank', value: t.rank, label: `#${t.rank}`, detail: 'Deezer global rank' };
  }
  if (t.popularity > 0) {
    return { signal: 'popularity', value: t.popularity, label: formatCount(t.popularity), detail: 'Provider popularity' };
  }
  return { signal: 'none', value: 0, label: '—', detail: 'No public ranking signal' };
}

function formatCount(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

// Not every real metric reads the same way: a Deezer rank of #1 is the best
// track, while a view count of 6B is the biggest. Each signal declares which
// direction means "better" so normalisation cannot invert a chart.
const LOWER_IS_BETTER = new Set(['deezerRank']);

// Normalise each source's real values onto a shared 0-100 scale so sources are
// comparable, using a linear map so intra-source ordering is preserved exactly.
// An earlier version squashed ranks through 1000/log10(rank), which saturates:
// 315813 and 322322 both rounded to 182 and the sort carried no information.
function assignScores(tracks) {
  const groups = new Map();
  for (const t of tracks) {
    if (t.realSignal.signal === 'none') continue;
    const k = t.realSignal.signal;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  for (const group of groups.values()) {
    const signal = group[0].realSignal.signal;
    const values = group.map(t => t.realSignal.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const lowerIsBetter = LOWER_IS_BETTER.has(signal);
    for (const t of group) {
      if (span <= 0) { t.chartScore = 100; continue; }
      const ratio = (t.realSignal.value - min) / span;
      t.chartScore = lowerIsBetter ? (1 - ratio) * 100 : ratio * 100;
    }
  }
  for (const t of tracks) {
    if (t.realSignal.signal === 'none') t.chartScore = -1;
  }
  return tracks;
}
// Same track from two providers collapses to one row, keeping every real
// signal it collected rather than throwing them away.
// Playback precedence when one track is matched by several sources.
// A real full audio stream beats an ad-supported YouTube embed, which in turn
// beats a 30-second preview, so a merged row must not silently downgrade to a
// preview just because the Deezer entry was seen first.
const PLAYBACK_PRECEDENCE = { full: 3, youtube: 2, preview: 1, external: 1, unavailable: 0 };
function betterPlayback(a, b) {
  return (PLAYBACK_PRECEDENCE[b] || 0) > (PLAYBACK_PRECEDENCE[a] || 0) ? b : a;
}

function dedupe(tracks) {
  const byKey = new Map();
  for (const t of tracks) {
    if (!t || !t.title) continue;
    const key = `${String(t.artistName || '').toLowerCase().trim()}|${String(t.title).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...t });
      continue;
    }
    const merged = { ...existing };
    for (const field of ['rank', 'popularity', 'viewCount']) {
      if (!merged[field] && t[field]) merged[field] = t[field];
    }
    if (t.playbackType === 'full' && merged.playbackType !== 'full') {
      merged.playbackType = 'full';
      merged.streamUrl = t.streamUrl;
      merged.audioUrl = t.audioUrl;
    }
    if (!merged.videoId && t.videoId) {
      merged.videoId = t.videoId;
      merged.isYouTube = true;
    }
    // Adopting a videoId means the row can play in full on YouTube. Promote the
    // playback type so the client routes it to the IFrame overlay instead of
    // playing the 30s preview, but never downgrade a real full audio stream.
    if (merged.videoId && merged.playbackType !== 'full') {
      merged.playbackType = betterPlayback(merged.playbackType, 'youtube');
    }
    byKey.set(key, merged);
  }
  return [...byKey.values()];
}

async function build({ scope = 'global', country = 'US', limit = 50, include = ['deezer', 'youtube', 'google'] } = {}) {
  const geo = String(country || 'US').toUpperCase();
  const key = `realchart:${scope}:${geo}:${limit}:${include.join(',')}`;

  return cached(key, CACHE_TTL, async () => {
    const tasks = [];

    if (include.includes('deezer')) {
      tasks.push(
        (scope === 'country'
          ? musicService.getTracksByCountry(geo, limit)
          : musicService.getTrendingTracks(limit)
        ).catch(e => { console.error('[RealChart] catalogue source failed:', e.message); return []; })
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (include.includes('youtube')) {
      tasks.push(
        (scope === 'country'
          ? YouTubeChart.getTracksByCountry(geo, limit)
          : YouTubeChart.getTrendingTracks(limit)
        ).catch(e => { console.error('[RealChart] YouTube source failed:', e.message); return []; })
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [catalogue, youtubeTracks] = await Promise.all(tasks);

    let merged = dedupe([...(catalogue || []), ...(youtubeTracks || [])]);

    if (include.includes('google')) {
      merged = await GoogleTrends.boostTracks(merged, geo);
    }

    merged = merged
      .map(t => ({ ...t, realSignal: realSignal(t) }));

    merged = assignScores(merged);

    merged = merged
      .sort((a, b) => {
        // A live Google trend outranks everything, since it is the only signal
        // that measures right now rather than cumulatively.
        const ag = a.googleTrending ? 1 : 0;
        const bg = b.googleTrending ? 1 : 0;
        if (ag !== bg) return bg - ag;
        if (b.chartScore !== a.chartScore) return b.chartScore - a.chartScore;
        // Deterministic tiebreak on the real value so equal scores still order
        // by actual measured data rather than by object identity.
        return a.realSignal.value - b.realSignal.value;
      })
      .slice(0, limit)
      .map((t, i) => ({ ...t, chartRank: i + 1 }));

    return {
      scope,
      country: geo,
      generatedAt: new Date().toISOString(),
      sources: [
        { key: 'deezer', label: 'Deezer', metric: 'Global stream rank', live: true },
        { key: 'youtube', label: 'YouTube', metric: 'Video view count', live: true },
        { key: 'google', label: 'Google Trends', metric: 'Daily search volume', live: true },
      ].filter(s => include.includes(s.key)),
      disclaimer: 'Ranked from real, live public signals. YouTube view counts are cumulative and favour established hits; only tracks whose artist appears in Google\'s daily trending searches for your country get a live trend boost.',
      data: merged,
    };
  });
}

module.exports = { build, formatCount, realSignal, assignScores };
