/**
 * Unified Music Service
 * Queries all active providers in parallel, normalizes, deduplicates, and merges results.
 *
 * PROVIDER AUTHORITY RANKING:
 *   Spotify (catalog) > Deezer (preview) > Audius (independent) > Local (uploaded)
 *
 * CANONICAL TRACK RESOLUTION:
 *   When multiple providers match the same title+artist, the canonical result
 *   comes from the most authoritative provider. Playback availability is
 *   a SECONDARY factor after relevance and authority.
 */

const db = require('../db.cjs');
const { getActiveProviders, getProviderByName } = require('./index.cjs');

// Provider authority: lower number = higher authority
const PROVIDER_AUTHORITY = {
  spotify: 1,
  deezer: 2,
  audius: 3,
  local: 4,
};

function getAuthority(providerName) {
  return PROVIDER_AUTHORITY[providerName] ?? 99;
}

// Simple in-memory cache with TTL and stale fallback
const memCache = new Map();
function cached(key, ttlMs, fn) {
  const entry = memCache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => {
    memCache.set(key, { data, ts: Date.now() });
    if (memCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of memCache) {
        if (now - v.ts > ttlMs) memCache.delete(k);
      }
    }
    return data;
  }).catch(err => {
    if (entry) {
      console.warn(`[MusicService] ${key} failed (${err.message}), serving stale cache`);
      return entry.data;
    }
    throw err;
  });
}

// DB cache helpers
function getCached(key, maxAgeSec = 3600) {
  try {
    const row = db.prepare(
      "SELECT data, created_at FROM catalog_cache WHERE cache_key = ? AND datetime(created_at, '+' || ? || ' seconds') > datetime('now')"
    ).get(key, maxAgeSec);
    if (row) return JSON.parse(row.data);
  } catch {}
  return null;
}

function setCached(key, data, provider = 'multi') {
  try {
    db.prepare(
      "INSERT OR REPLACE INTO catalog_cache (cache_key, data, provider, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(key, JSON.stringify(data), provider);
  } catch {}
}

// Deduplication: normalize title+artist for matching
function dedupKey(track) {
  return `${(track.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')}_${(track.artistName || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

/**
 * Orders two candidate entries for the same song.
 *
 * Playability is the PRIMARY key and provider authority only breaks ties. The
 * previous order (authority first) meant a Spotify row always beat the Audius or
 * Deezer row for the same song — but Spotify no longer returns preview URLs for
 * this app, so those winning rows were unplayable "Open in Spotify" links while
 * the genuinely playable version was thrown away during dedup. That is what
 * flooded the catalogue with external links.
 */
function compareTracks(a, b) {
  const playbackDiff = playbackScore(b) - playbackScore(a);
  if (playbackDiff !== 0) return playbackDiff;
  return getAuthority(a.provider) - getAuthority(b.provider);
}

/**
 * Removes entries the app should not present.
 *
 * Two reasons:
 *
 * 1. Unplayable entries. Spotify no longer returns preview URLs for this app, so
 *    a Spotify track with no match on a playable provider resolves to
 *    `playbackType: 'external'` — a row whose only action is an "Open in Spotify"
 *    link. Those are dropped because every provider's playable version is already
 *    preferred by `compareTracks` during dedup, so anything still external here
 *    genuinely has nothing playable behind it. `unavailable` is dropped for the
 *    same reason (no source at all).
 *
 * 2. Unlicensed rips, which open upload platforms attract and which advertise
 *    themselves through download-site watermarks in the title.
 */
function dropUnusable(tracks) {
  return (tracks || []).filter(t =>
    t
    && t.playbackType !== 'external'
    && t.playbackType !== 'unavailable'
    && !isUnofficialUpload(t)
  );
}

function dedupTracks(allTracks) {
  const seen = new Map();
  const result = [];
  for (const track of allTracks) {
    if (!track) continue;
    const key = dedupKey(track);
    if (seen.has(key)) {
      const existing = seen.get(key);
      // Negative means `track` is the better entry for this song.
      if (compareTracks(track, existing) < 0) {
        const idx = result.findIndex(t => dedupKey(t) === key);
        if (idx >= 0) result[idx] = track;
        seen.set(key, track);
      }
    } else {
      seen.set(key, track);
      result.push(track);
    }
  }
  // Playable entries first so a caller that slices the list keeps real audio.
  return result.sort(compareTracks);
}

function playbackScore(track) {
  // YouTube plays in-app through the official embed overlay, so it is a full
  // experience rather than a link out.
  if (track.playbackType === 'full' || track.playbackType === 'youtube') return 3;
  if (track.playbackType === 'preview') return 2;
  if (track.playbackType === 'external') return 1;
  return 0;
}

/**
 * High-confidence markers that a track is an unlicensed upload rather than a
 * release. Open upload platforms inevitably attract rips, and the titles carry
 * the fingerprint of the download site they came from — e.g.
 * "Wizkid-OJUELEGBA-Naijaloaded.com_.ng_" or
 * "Tems-Ft-Drake-Fountains-(TrendyBeatz.com)".
 *
 * Deliberately narrow: it only rejects titles containing a known rip domain or
 * a bare web address, so genuine releases, remixes and live versions still pass
 * (those are handled by the softer ranking penalty in search, not removed).
 */
const RIP_SOURCE_MARKERS = /(naijaloaded|trendybeatz|toonafyn|mp3download|9icebanger|celebrityarebest|netnaija|ghanaheaven|africaheaven|mp3juice|juicebanger|songsgalaxy|zicsquad|topsongz|onemorebanger|afload|pluggedgh|waaminternational|my9ice|naijafresh)/i;
const BARE_WEB_ADDRESS = /\b[a-z0-9-]+\.(com|net|org|ng|io|co|xyz|me|info|link|tv|site|online|top|club)\b/i;

function isUnofficialUpload(track) {
  const title = String(track?.title || '');
  if (!title) return false;
  return RIP_SOURCE_MARKERS.test(title) || BARE_WEB_ADDRESS.test(title);
}

// ---- SEARCH RELEVANCE SCORING ----

// Normalize text for comparison: lowercase, strip punctuation, collapse whitespace
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[''\u2018\u2019]/g, '')    // apostrophes
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212-]/g, ' ') // hyphens/dashes → space
    .replace(/[^a-z0-9\s]/g, '')         // remove non-alphanumeric
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}

// Alternative-version indicators (applied as penalty when detected in title)
// Covers remixes, covers, bootlegs, type beats, live versions, etc.
const ALT_VERSION_TERMS = /\b(remix|remastered|live|cover|covers|acoustic|instrumental|karaoke|lo[\s-]*fi|type\s*beat|bootleg|edit|mix|sped\s*up|slowed|rework|mashup|tribute|official\s*audio|official\s*music|video)\b/i;

// Tracks that are known to be from the original artist (verified by provider)
// Spotify tracks with exact artist+title match are treated as canonical
function hasAltVersionIndicator(text) {
  return ALT_VERSION_TERMS.test(text || '');
}

// Check if a track appears to be from the original authoritative source
// (e.g., Spotify track where artist matches the query)
function isCanonicalTrack(track, query) {
  if (!query) return false;
  const q = normalize(query);
  const a = normalize(track.artistName);
  const t = normalize(track.title);
  // Canonical if exact artist match AND exact or close title match from Spotify/Deezer
  return (a === q && (t === q || t.includes(q))) &&
    (track.provider === 'spotify' || track.provider === 'deezer');
}

// Compute search relevance score for a track against a query.
// Higher = more relevant. Playback is a secondary bonus only.
function scoreSearchResult(track, query) {
  const q = normalize(query);
  const t = normalize(track.title);
  const a = normalize(track.artistName);
  const combined = `${t} ${a}`;

  if (!q) return 0;

  let score = 0;

  // --- Title match (primary) ---
  if (t === q) {
    // Exact title match
    score += 80;
  } else if (t.startsWith(q)) {
    // Title starts with query
    score += 65;
  } else if (q.length >= 3 && t.includes(q)) {
    // Title contains query as substring
    score += 50;
  } else if (q.length >= 3 && levenshteinRatio(t, q) > 0.7) {
    // Fuzzy title match (close spelling)
    score += 30;
  }

  // --- Artist match (secondary) ---
  if (a === q) {
    score += 25; // exact artist match
  } else if (q.length >= 3 && a.includes(q)) {
    score += 15; // artist contains query
  } else if (q.length >= 3 && levenshteinRatio(a, q) > 0.7) {
    score += 8;  // fuzzy artist match
  }

  // --- Combined title + artist bonus ---
  if (combined.includes(q) && q.length >= 3) {
    score += 10;
  }

  // --- Alternative version penalty ---
  // Only penalize when the query appears to target the original song
  // and the title contains an obvious version indicator
  if (score > 0 && hasAltVersionIndicator(track.title)) {
    score -= 30;
  }

  // --- Playback bonus (secondary tiebreaker) ---
  score += playbackScore(track);

  return score;
}

// Simple Levenshtein distance ratio (0..1)
function levenshteinRatio(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const lenA = a.length, lenB = b.length;
  if (lenA === 0) return 0;
  if (lenB === 0) return 0;

  const matrix = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) matrix[i][0] = i;
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return 1 - matrix[lenA][lenB] / Math.max(lenA, lenB);
}

// Execute with timeout and error handling
// Must exceed the slowest provider's own abort timeout (Audius 15s, Deezer 12s).
// When this wrapper was shorter than a provider's internal timeout it cut healthy
// requests short and made a working provider look broken to the circuit breaker.
// Kept close to the provider budgets so a failing provider still fails fast.
async function safeProviderCall(provider, method, args = [], timeoutMs = 17000) {
  try {
    const result = await Promise.race([
      provider[method](...args),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
    ]);
    db.incrementProviderRequests(provider.name);
    return result;
  } catch (e) {
    db.updateProviderHealth(provider.name, 'failed', e.message);
    console.error(`[MusicService] ${provider.name}.${method} failed:`, e.message);
    return null;
  }
}

// Execute method across all providers in parallel
async function queryAllProviders(method, args = [], timeoutMs = 17000) {
  const providers = getActiveProviders();
  const results = await Promise.allSettled(
    providers.map(p => safeProviderCall(p, method, args, timeoutMs))
  );
  const all = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      all.push(...result.value);
    }
  }
  return all;
}

class UnifiedMusicService {
  constructor() {
    this._providers = getActiveProviders;
  }

  get activeProviders() {
    return getActiveProviders().map(p => {
      const dbHealth = db.prepare('SELECT * FROM provider_health WHERE provider = ?').get(p.name);
      return {
        name: p.name,
        capabilities: p.capabilities,
        supportsFullTracks: p.supportsFullTracks,
        supportsPreview: p.supportsPreview,
        healthy: dbHealth?.status !== 'failed',
        lastError: dbHealth?.last_error || null,
      };
    });
  }

  // ---- SEARCH ----

  async searchTracks(query, limit = 20) {
    if (!query) return [];
    const cacheKey = `music:search:${query}:${limit}`;
    return cached(cacheKey, 30000, async () => {
      const allTracks = await queryAllProviders('searchTracks', [query, limit * 2]);
      const deduped = dedupTracks(allTracks);

      // Score and sort by relevance (primary), authority (secondary), playback (tertiary)
      const scored = deduped.map(track => ({
        track,
        relevance: scoreSearchResult(track, query),
        authority: getAuthority(track.provider),
      }));
      scored.sort((a, b) => {
        if (b.relevance !== a.relevance) return b.relevance - a.relevance;
        if (a.authority !== b.authority) return a.authority - b.authority;
        // Penalize alternative versions when original is available
        const aAlt = hasAltVersionIndicator(a.track.title) && a.relevance > 0;
        const bAlt = hasAltVersionIndicator(b.track.title) && b.relevance > 0;
        if (aAlt && !bAlt) return 1;
        if (!aAlt && bAlt) return -1;
        return playbackScore(b.track) - playbackScore(a.track);
      });

      // Filter before slicing so the page is filled with playable results. The
      // sort above already ranks playable entries first.
      return dropUnusable(scored.map(s => this.resolvePlaybackSource(s.track))).slice(0, limit);
    });
  }

  async searchArtists(query, limit = 10) {
    if (!query) return [];
    const cacheKey = `music:artist-search:${query}:${limit}`;
    return cached(cacheKey, 30000, async () => {
      const allArtists = await queryAllProviders('searchArtists', [query, limit]);
      // Dedup artists by name
      const seen = new Set();
      const result = [];
      for (const artist of allArtists) {
        if (!artist) continue;
        const key = (artist.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seen.has(key)) {
          seen.add(key);
          result.push(artist);
        }
      }
      return result.slice(0, limit);
    });
  }

  async searchAlbums(query, limit = 20) {
    if (!query) return [];
    const cacheKey = `music:album-search:${query}:${limit}`;
    return cached(cacheKey, 30000, async () => {
      const allAlbums = await queryAllProviders('searchAlbums', [query, limit]);
      const seen = new Set();
      const result = [];
      for (const album of allAlbums) {
        if (!album) continue;
        const key = `${(album.title || '').toLowerCase()}_${(album.artistName || '').toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(album);
        }
      }
      return result.slice(0, limit);
    });
  }

  // ---- TRACKS ----

  async getTrack(trackId) {
    const providerName = trackId.split('_')[0];
    const provider = getProviderByName(providerName);
    if (provider) return safeProviderCall(provider, 'getTrack', [trackId]);
    // Try all providers
    const providers = getActiveProviders();
    for (const p of providers) {
      const result = await safeProviderCall(p, 'getTrack', [trackId]);
      if (result) return result;
    }
    return null;
  }

  // ---- TRENDING / POPULAR ----

  async getTrendingTracks(limit = 20) {
    const cacheKey = `music:trending:${limit}`;
    return cached(cacheKey, 120000, async () => {
      const allTracks = await queryAllProviders('getTrendingTracks', [limit * 3]);
      const deduped = dedupTracks(allTracks);
      // Filter before slicing: dedup already sorts playable entries first, so
      // this fills the whole page with tracks that actually play.
      return dropUnusable(deduped.map(t => this.resolvePlaybackSource(t))).slice(0, limit);
    });
  }

  async getPopularTracks(limit = 20) {
    const cacheKey = `music:popular:${limit}`;
    return cached(cacheKey, 120000, async () => {
      const allTracks = await queryAllProviders('getPopularTracks', [limit * 3]);
      const deduped = dedupTracks(allTracks);
      return dropUnusable(deduped.map(t => this.resolvePlaybackSource(t))).slice(0, limit);
    });
  }

  async getTracksByGenre(genreId, limit = 20) {
    const cacheKey = `music:genre:${genreId}:${limit}`;
    return cached(cacheKey, 120000, async () => {
      const allTracks = await queryAllProviders('getTracksByGenre', [genreId, limit * 2]);
      const deduped = dedupTracks(allTracks);
      return dropUnusable(deduped.map(t => this.resolvePlaybackSource(t))).slice(0, limit);
    });
  }

  async getTracksByCountry(countryCode, limit = 20) {
    const cacheKey = `music:country:${countryCode}:${limit}`;
    return cached(cacheKey, 120000, async () => {
      const allTracks = await queryAllProviders('getTracksByCountry', [countryCode, limit * 2]);
      const deduped = dedupTracks(allTracks);
      return dropUnusable(deduped.map(t => this.resolvePlaybackSource(t))).slice(0, limit);
    });
  }

  // ---- ARTISTS ----

  async getArtist(artistId) {
    const providerName = artistId.split('_')[0];
    const provider = getProviderByName(providerName);
    if (provider) return safeProviderCall(provider, 'getArtist', [artistId]);
    return null;
  }
  async getArtistTopTracks(artistId, limit = 20) {
    const providerName = artistId.split('_')[0];
    const provider = getProviderByName(providerName);
    if (!provider) return [];

    const tracks = await safeProviderCall(provider, 'getArtistTopTracks', [artistId, limit * 2]);
    const playable = Array.isArray(tracks)
      ? dropUnusable(dedupTracks(tracks).map(t => this.resolvePlaybackSource(t))).slice(0, limit)
      : [];

    if (playable.length) return playable;

    // This artist's catalogue on its home provider has no playable audio (common
    // for Deezer top-tracks, which often lack preview URLs). Rather than show an
    // empty page, look the artist up on a provider that streams full audio. One
    // extra lookup per artist page, and the result is cached by the caller.
    const artist = await safeProviderCall(provider, 'getArtist', [artistId]);
    const artistName = (artist && (artist.name || artist.artistName)) || null;
    if (!artistName) return [];

    const found = await this.searchTracks(artistName, limit);
    if (!Array.isArray(found) || !found.length) return [];

    return dropUnusable(dedupTracks(found).map(t => this.resolvePlaybackSource(t))).slice(0, limit);
  }

  async getArtistAlbums(artistId, limit = 20) {
    const providerName = artistId.split('_')[0];
    const provider = getProviderByName(providerName);
    if (provider) return safeProviderCall(provider, 'getArtistAlbums', [artistId, limit]) || [];
    return [];
  }

  // ---- ALBUMS ----

  async getAlbum(albumId) {
    const providerName = albumId.split('_')[0];
    const provider = getProviderByName(providerName);
    if (provider) return safeProviderCall(provider, 'getAlbum', [albumId]);
    return null;
  }

  async getAlbumTracks(albumId, limit = 50) {
    const providerName = albumId.split('_')[0];
    const provider = getProviderByName(providerName);
    if (provider) {
      const tracks = await safeProviderCall(provider, 'getAlbumTracks', [albumId, limit * 2]);
      if (!tracks) return [];
      return dropUnusable(dedupTracks(tracks).map(t => this.resolvePlaybackSource(t))).slice(0, limit);
    }
    return [];
  }

  // ---- GENRES ----

  async getGenres() {
    const cacheKey = 'music:genres:all';
    return cached(cacheKey, 600000, async () => {
      const allGenres = await queryAllProviders('getGenres', []);
      const seen = new Set();
      const result = [];
      for (const g of allGenres) {
        if (!g || !g.name) continue;
        const key = g.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(g);
        }
      }
      return result;
    });
  }

  // ---- PLAYBACK RESOLUTION ----

  /**
   * Resolve the best playable source for a track.
   * Preserves canonical metadata from the authoritative provider.
   *
   * Priority:
   * 1. Nocturne upload (local) with audio file → FULL
   * 2. Audius original track (not cover/remix) → FULL
   * 3. Spotify preview → PREVIEW
   * 4. Deezer preview → PREVIEW
   * 5. Spotify external → EXTERNAL (open in Spotify)
   * 6. No valid source → UNAVAILABLE
   */
  resolvePlaybackSource(track) {
    if (!track) return null;

    // Local uploaded track with audio file → FULL
    if (track.provider === 'local' && track.streamUrl && track.playbackType === 'full') {
      return { ...track, playbackType: 'full', source: 'local', audioUrl: track.streamUrl };
    }

    // Audius track → FULL (if streamable)
    if (track.provider === 'audius' && track.isPlayable && track.streamUrl) {
      // Check if track is a cover/remix
      if (hasAltVersionIndicator(track.title)) {
        // Mark as alternative but still playable
        return { ...track, playbackType: 'full', source: 'audius', isAlternative: true };
      }
      return { ...track, playbackType: 'full', source: 'audius', audioUrl: track.streamUrl };
    }

    // Spotify preview → PREVIEW
    if (track.provider === 'spotify' && track.previewUrl) {
      return { ...track, playbackType: 'preview', source: 'spotify', audioUrl: track.previewUrl };
    }

    // Deezer preview → PREVIEW
    if (track.provider === 'deezer' && track.previewUrl) {
      return { ...track, playbackType: 'preview', source: 'deezer', audioUrl: track.previewUrl };
    }

    // Spotify external → EXTERNAL (open in Spotify)
    if (track.provider === 'spotify' && track.externalUrl) {
      return { ...track, playbackType: 'external', source: 'spotify', externalUrl: track.externalUrl };
    }

    // Deezer external → EXTERNAL
    if (track.provider === 'deezer' && track.externalUrl) {
      return { ...track, playbackType: 'external', source: 'deezer', externalUrl: track.externalUrl };
    }

    // No valid source
    return { ...track, playbackType: 'unavailable', source: null };
  }

  /**
   * Get a canonical track with the best playback source resolved.
   * Given a track ID from any provider, find the canonical version
   * and resolve its playback source.
   */
  async resolveTrack(trackId) {
    const track = await this.getTrack(trackId);
    if (!track) return null;

    // If the track is already canonical (Spotify/Deezer), resolve playback
    if (track.provider === 'spotify' || track.provider === 'deezer') {
      return this.resolvePlaybackSource(track);
    }

    // For non-catalog tracks, try to find the canonical version
    const canonical = await this.findCanonicalTrack(track.title, track.artistName);
    if (canonical) {
      return this.resolvePlaybackSource(canonical);
    }

    return this.resolvePlaybackSource(track);
  }

  /**
   * Find the canonical version of a track from the most authoritative provider.
   */
  async findCanonicalTrack(title, artist) {
    if (!title || !artist) return null;
    const query = `${artist} ${title}`;
    const allTracks = await queryAllProviders('searchTracks', [query, 5]);
    if (allTracks.length === 0) return null;

    // Find tracks that match both title and artist exactly
    const exactMatch = allTracks.find(t => {
      const tNorm = normalize(t.title);
      const aNorm = normalize(t.artistName);
      const titleNorm = normalize(title);
      const artistNorm = normalize(artist);
      return aNorm === artistNorm && tNorm === titleNorm;
    });

    if (exactMatch) {
      // Return the one from the most authoritative provider
      const sorted = [exactMatch].sort((a, b) => getAuthority(a.provider) - getAuthority(b.provider));
      return sorted[0];
    }

    // Fallback: return the highest authority track that matches title
    const titleMatch = allTracks.find(t => {
      const tNorm = normalize(t.title);
      const titleNorm = normalize(title);
      return tNorm === titleNorm || tNorm.includes(titleNorm) || titleNorm.includes(tNorm);
    });

    return titleMatch || null;
  }

  // ---- HOME ----

  async getHome(country = 'NG') {
    const cacheKey = `music:home:${country}`;
    return cached(cacheKey, 60000, async () => {
      // Fetch trending, popular, and genres with shorter cache for freshness
      const [trendingResult, popularResult, genresResult] = await Promise.allSettled([
        this.getTrendingTracks(30),
        this.getPopularTracks(20),
        this.getGenres(),
      ]);

      const trending = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
      const popular = popularResult.status === 'fulfilled' ? popularResult.value : [];
      const genres = genresResult.status === 'fulfilled' ? genresResult.value : [];

      // getTrendingTracks / getPopularTracks already resolved sources and
      // dropped anything unplayable, but guard here too so a future caller that
      // skips that step can never reintroduce "Open in Spotify" rows.
      const resolvedTrending = dropUnusable(trending.map(t => this.resolvePlaybackSource(t)));
      const resolvedPopular = dropUnusable(popular.map(t => this.resolvePlaybackSource(t)));

      // Separate full-playback and preview tracks for homepage
      const fullTracks = resolvedTrending.filter(t => t.playbackType === 'full' || t.playbackType === 'youtube');
      const previewTracks = resolvedTrending.filter(t => t.playbackType === 'preview');

      return {
        trending: [...fullTracks, ...previewTracks].slice(0, 15),
        previewTracks: previewTracks.slice(0, 10),
        popular: resolvedPopular.slice(0, 10),
        genres: (genres || []).slice(0, 20),
      };
    });
  }

  // ---- PROVIDER STATUS ----

  async getProviderStatus() {
    const providers = getActiveProviders();
    const statuses = [];
    for (const p of providers) {
      const health = await p.healthCheck();
      const dbHealth = db.prepare('SELECT * FROM provider_health WHERE provider = ?').get(p.name);
      statuses.push({
        name: p.name,
        capabilities: p.capabilities,
        supportsFullTracks: p.supportsFullTracks,
        supportsPreview: p.supportsPreview,
        healthy: health.healthy,
        responseMs: health.responseMs || 0,
        error: health.error || null,
        trackCount: health.trackCount || 0,
        lastSuccessAt: dbHealth?.last_success_at || null,
        lastFailureAt: dbHealth?.last_failure_at || null,
        totalRequests: dbHealth?.total_requests || 0,
        failedRequests: dbHealth?.failed_requests || 0,
        lastSyncAt: dbHealth?.last_sync_at || null,
      });
    }
    return statuses;
  }

  // Clear cache
  clearCache(pattern) {
    if (pattern) {
      for (const [k] of memCache) {
        if (k.includes(pattern)) memCache.delete(k);
      }
    } else {
      memCache.clear();
    }
  }
}

const musicService = new UnifiedMusicService();
module.exports = musicService;
