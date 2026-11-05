/**
 * YouTube Chart Source
 *
 * Supplies real, measurable music metadata to the Charts screen. YouTube has no
 * public chart endpoint and its /feed/trending is a JS shell with no data, so
 * this is NOT an official YouTube chart. It builds a chart from real videos and
 * ranks them by real view counts, which is the strongest public signal
 * available without a Data API key.
 *
 * Honest limits, kept explicit rather than papered over:
 *  - Views are cumulative, so this favours established hits over new releases.
 *  - Like counts are NOT used. They need one watch-page fetch per video
 *    (~1.3MB / ~11s), which is not viable at chart scale.
 *
 * Playback stays on the official IFrame embed; these tracks must never reach the
 * native <audio> engine, so playbackType is pinned to 'youtube'.
 */

const { ytSearchWeb } = require('../routes/youtube.cjs');

// Real chart-driving queries. Each returns official music videos; the union is
// ranked purely by measured view count.
const CHART_QUERIES = [
  'top songs this week official',
  'trending songs official music',
  'most played songs official',
  'new music releases official',
  'pop hits official video',
];

const COUNTRY_QUERIES = {
  NG: ['nigerian hits official', 'afrobeats hits official', 'nigeria top songs official'],
  US: ['top songs usa official', 'billboard hits official', 'us pop hits official'],
  GB: ['top songs uk official', 'uk charts hits official', 'uk pop hits official'],
  FR: ['top songs france official', 'france hits official'],
  DE: ['top songs germany official', 'germany hits official'],
  BR: ['top songs brasil official', 'funk brasileira hits official'],
  JP: ['top songs japan official', 'j-pop hits official'],
  KR: ['top songs korea official', 'k-pop hits official'],
  IN: ['top songs india official', 'bollywood hits official'],
  CA: ['top songs canada official', 'canadian hits official'],
  AU: ['top songs australia official', 'australian hits official'],
  ZA: ['top songs south africa official', 'amapiano hits official'],
  GH: ['ghana hits official', 'afrobeats ghana official'],
  KE: ['kenyan hits official', 'kenyan music official'],
  MX: ['top songs mexico official', 'latin hits official'],
  ES: ['top songs espana official', 'spanish hits official'],
  IT: ['top songs italia official', 'italian hits official'],
  SE: ['top songs sverige official', 'swedish hits official'],
};

const COUNTRY_NAMES = {
  NG: 'Nigeria', US: 'United States', GB: 'United Kingdom', FR: 'France',
  DE: 'Germany', BR: 'Brazil', JP: 'Japan', KR: 'South Korea', IN: 'India',
  CA: 'Canada', AU: 'Australia', ZA: 'South Africa', GH: 'Ghana', KE: 'Kenya',
  MX: 'Mexico', ES: 'Spain', IT: 'Italy', SE: 'Sweden',
};

function parseViews(text) {
  if (!text) return 0;
  const cleaned = String(text).replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return 0;
  // "1,234,567 views" -> 1234567 ; "1.2M views" -> 1200000
  if (/[KkMmBb]/.test(String(text))) {
    const m = String(text).match(/([\d.]+)\s*([KkMmBb])/);
    if (m) {
      const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()];
      return Math.round(parseFloat(m[1]) * mult);
    }
  }
  return Math.round(n);
}

// YouTube auto-generates "<Artist> - Topic" channels for audio-only releases.
// Those are not music-video uploads, so letting them into a chart pollutes it
// with auto rows. An earlier version of this check was `name.length > 2`, which
// matched every result and therefore filtered nothing at all.
function isTopicChannel(name) {
  const n = String(name || '').trim();
  return !n || /\btopics?\b/i.test(n);
}

// Aggregator uploads (chart videos, albums, mixes, playlists) are not single
// tracks, so they are not valid chart entries even when highly viewed.
const NON_TRACK_TITLE = new RegExp([
  '\\btop\\s*(?:5|10|20|40|50|100)\\b',
  'official chart',
  'megamix',
  'compilation',
  'full album',
  '\\bplaylist\\b',
  'all songs',
  'greatest hits',
].join('|'), 'i');

// Only real music-video uploads from a real channel belong in a chart.
function looksOfficial(v) {
  if (isTopicChannel(v.artistName)) return false;
  if (NON_TRACK_TITLE.test(String(v.title || ''))) return false;
  return true;
}

async function collect(queries, perQuery) {
  const results = await Promise.allSettled(
    queries.map(q => ytSearchWeb(q, perQuery).catch(() => ({ videos: [] })))
  );
  const byId = new Map();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const v of (r.value.videos || [])) {
      if (!v || !v.videoId || !looksOfficial(v)) continue;
      if (!byId.has(v.videoId)) byId.set(v.videoId, v);
    }
  }
  return [...byId.values()];
}

// Upload titles repeat the artist, but not in a consistent order: some are
// "Artist - Song" and others "Song - Artist". Strip whichever form matches so
// the row does not read "Mad Over You - Runtown - Runtown".
function cleanTitle(title, artist) {
  const original = String(title || '').trim();
  const a = String(artist || '').trim();
  if (!a) return original;

  const lower = original.toLowerCase();
  const aLower = a.toLowerCase();
  let t = original;

  if (lower.startsWith(`${aLower} -`)) {
    t = t.slice(a.length + 1).trim();
  } else if (lower.endsWith(` - ${aLower}`)) {
    t = t.slice(0, t.length - (a.length + 3)).trim();
  }
  t = t.replace(/^[-–|]\s*/, '').replace(/\s*[-–|]\s*$/, '');
  return t || original;
}

// Rank strictly by measured views. The value is carried through to the client
// so the UI can show the real number instead of a synthetic score.
function toChartTracks(videos) {
  return videos
    .map(v => ({
      id: `yt_${v.videoId}`,
      videoId: v.videoId,
      title: cleanTitle(v.title, v.artistName),
      artistName: v.artistName,
      cover: v.cover,
      duration: v.duration,
      source: 'youtube',
      provider: 'youtube',
      isYouTube: true,
      playbackType: 'youtube',
      viewCount: parseViews(v.viewCount),
      publishedAt: v.publishedAt || '',
    }))
    .sort((a, b) => b.viewCount - a.viewCount);
}

class YouTubeChartProvider {
  constructor() {
    this.name = 'youtube-chart';
    this.capabilities = { chartSource: true, audio: false, search: true };
  }

  async getTrendingTracks(limit = 30) {
    const videos = await collect(CHART_QUERIES, 20);
    return toChartTracks(videos).slice(0, limit);
  }

  async getTracksByCountry(countryCode = 'US', limit = 30) {
    const queries = COUNTRY_QUERIES[String(countryCode).toUpperCase()] || CHART_QUERIES;
    const videos = await collect(queries, 20);
    return toChartTracks(videos).slice(0, limit);
  }

  // Real source label so the client can state where the ranking came from.
  getSourceMeta() {
    return {
      key: 'youtube',
      label: 'YouTube',
      rankedBy: 'viewCount',
      rankedByLabel: 'Real view counts',
      note: 'YouTube publishes no public chart API, so this is ranked from real video view counts, not an official chart.',
    };
  }

  async healthCheck() {
    try {
      const { videos } = await ytSearchWeb(CHART_QUERIES[0], 3);
      return { ok: true, detail: `${(videos || []).length} videos sampled` };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  }
}

module.exports = {
  YouTubeChartProvider,
  YouTubeChart: new YouTubeChartProvider(),
  COUNTRY_NAMES,
  parseViews,
  cleanTitle,
  looksOfficial,
};
