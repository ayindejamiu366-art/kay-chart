/**
 * Google Trends Chart Source
 *
 * Uses Google's real daily trending-search RSS feed, per country:
 *   https://trends.google.com/trending/rss?geo=<CC>
 *
 * Each item carries Google's own search volume (ht:approx_traffic, e.g. "1000+")
 * and a publish time, so the numbers shown to users are Google's, not ours.
 *
 * Important honesty constraint: this feed lists trending *searches*, which are
 * mostly news/sports, not songs. It is therefore used as a cross-reference
 * boost against real catalogue tracks, never as a standalone chart. An artist
 * or title that genuinely appears in the feed gets a real "trending on Google"
 * flag; everything else is left unboosted. Most charts will have few or zero
 * matches, and that is the correct result rather than a bug.
 */

const FEED = (geo) => `https://trends.google.com/trending/rss?geo=${String(geo || 'US').toUpperCase()}`;
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

function parseTraffic(text) {
  if (!text) return 0;
  const m = String(text).match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

// Strip accents and punctuation so "Beyoncé" matches a stored "Beyonce".
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class GoogleTrendsProvider {
  constructor() {
    this.name = 'google-trends';
    this.capabilities = { chartSource: true, audio: false };
  }

  async getTrendingTerms(geo = 'US') {
    const key = String(geo || 'US').toUpperCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

    const res = await fetch(FEED(key), {
      signal: AbortSignal.timeout(12000),
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    if (!res.ok) throw new Error(`Google Trends ${res.status}`);
    const xml = await res.text();

    const items = [];
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const b of blocks) {
      const title = (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      if (!title) continue;
      const trafficRaw = (b.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1];
      const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
      items.push({
        term: decodeEntities(title).replace(/<!\[CDATA\[|\]\]>/g, ''),
        traffic: parseTraffic(trafficRaw),
        trafficLabel: trafficRaw ? decodeEntities(trafficRaw).replace(/<!\[CDATA\[|\]\]>/g, '') : '',
        publishedAt: pub ? new Date(pub).toISOString() : null,
      });
    }
    cache.set(key, { ts: Date.now(), data: items });
    return items;
  }

  // Cross-reference real Google trends against real catalogue tracks.
  async boostTracks(tracks, geo = 'US') {
    let terms;
    try {
      terms = await this.getTrendingTerms(geo);
    } catch (e) {
      console.error('[GoogleTrends] feed unavailable:', e.message);
      return tracks;
    }
    if (!terms.length) return tracks;

    const index = new Map();
    for (const t of terms) index.set(norm(t.term), t);

    return tracks.map(t => {
      const artist = norm(t.artistName);
      const title = norm(t.title);
      // An exact trend term matching the artist is the strongest real signal.
      const hit = index.get(artist)
        || index.get(title)
        || (title.length > 6 ? index.get(title.split(' ').slice(0, 3).join(' ')) : null);
      if (!hit) return t;
      return {
        ...t,
        googleTrending: true,
        googleTrendTerm: hit.term,
        googleTraffic: hit.traffic,
        googleTrafficLabel: hit.trafficLabel,
      };
    });
  }

  getSourceMeta() {
    return {
      key: 'google-trends',
      label: 'Google Trends',
      rankedBy: 'searchTraffic',
      rankedByLabel: 'Google search volume',
      note: 'Tracks are only boosted when the artist or title appears in Google\'s real daily trending searches for your country.',
    };
  }

  async healthCheck() {
    try {
      const t = await this.getTrendingTerms('US');
      return { ok: true, detail: `${t.length} live trend terms` };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  }
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

module.exports = { GoogleTrendsProvider, GoogleTrends: new GoogleTrendsProvider() };
