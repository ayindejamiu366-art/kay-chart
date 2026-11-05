const express = require('express');
const router = express.Router();

// Clean YouTube video titles: remove "(Official Video)", "[Music Video]", etc.
function cleanTitle(raw) {
  if (!raw) return 'Untitled';
  let t = raw;
  // Remove common YouTube suffixes in parens, brackets
  t = t.replace(/\s*[\(\[\{]\s*(official\s+(music\s+)?video|music\s+video|official\s+audio|lyric\s+video|visualizer|official\s+audio\s+lyrics|video\s+lyrics|official|lyrics|audio)\s*[\)\]\}]/gi, '');
  // Remove trailing: - Official Video, | Official Music Video, etc.
  t = t.replace(/[\-–\|]\s*(official\s+(music\s+)?video|music\s+video|official\s+audio|lyric\s+video|visualizer|official)/gi, '');
  // Remove standalone suffixes at end
  t = t.replace(/\s*[\-–\|]?\s*(Official Video|Official Music Video|Music Video|Lyric Video|Visualizer|Official Audio|Audio|Lyrics)\s*$/gi, '');
  // Remove ft. artist duplicates from title if already in artistName
  // Clean up extra whitespace / trailing pipes/dashes
  t = t.replace(/[\s\-–\|]+$/, '').trim();
  return t || 'Untitled';
}

const cache = new Map();
function cached(key, ttlMs, fn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => {
    if (data && ((data.videos && data.videos.length > 0) || (data.tracks && data.tracks.length > 0))) {
      cache.set(key, { data, ts: Date.now() });
    }
    return data;
  });
}

// Search YouTube by scraping the search results page
async function ytSearchWeb(query, limit = 20, continuation = null) {
  try {
    let url;
    if (continuation) {
      // Pagination: use continuation token
      url = new URL('https://www.youtube.com/results');
      url.searchParams.set('search_query', query);
      url.searchParams.set('sp', continuation);
    } else {
      url = new URL('https://www.youtube.com/results');
      url.searchParams.set('search_query', query + ' official');
      url.searchParams.set('sp', 'EgIQAQ%3D%3D'); // Music filter
    }

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`YouTube ${res.status}`);
    const html = await res.text();

    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!match) return { videos: [], nextContinuation: null };

    const data = JSON.parse(match[1]);
    const sectionContents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    let videos = [];
    let nextContinuation = null;

    for (const section of sectionContents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const video = item.videoRenderer;
        if (!video || !video.videoId) continue;

        const durationText = video.lengthText?.simpleText || '';
        const durationParts = durationText.split(':').map(Number);
        const duration = durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts.length === 2
          ? durationParts[0] * 60 + durationParts[1]
          : durationParts[0] || 0;

        videos.push({
          id: `yt_${video.videoId}`,
          videoId: video.videoId,
          title: cleanTitle(video.title?.runs?.[0]?.text),
          artistName: video.ownerText?.runs?.[0]?.text || 'Unknown',
          cover: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
          duration,
          source: 'youtube',
          isYouTube: true,
          viewCount: parseInt(video.viewCountText?.simpleText?.replace(/[^0-9]/g, '') || '0'),
          publishedAt: video.publishedTimeText?.simpleText || '',
        });
      }

      // Check for continuation token (next page)
      const contRenderer = section?.continuationItemRenderer;
      if (contRenderer) {
        nextContinuation = contRenderer.continuationEndpoint?.continuationCommand?.token || null;
      }
    }

    return { videos: videos.slice(0, limit), nextContinuation };
  } catch (e) {
    console.error('YouTube web search error:', e.message);
    return { videos: [], nextContinuation: null };
  }
}

// Comparison key for channel names. Channel decorations are often glued to the
// name ("DaftPunkVEVO"), so we squash to alphanumerics and drop "vevo"/"topic"
// anywhere rather than on word boundaries alone.
function channelKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s*-\s*topic\b/g, '')
    .replace(/vevo/g, '')
    .replace(/topic/g, '')
    .replace(/\bofficial\b/g, '')
    .replace(/\bmusic\s*video\b/g, '')
    .replace(/\bmusic\b/g, '')
    .replace(/\brecords\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Multi-query search to get ALL songs by an artist
async function ytArtistSearch(artistName, totalLimit = 50) {
  const queries = [
    `${artistName} official audio`,
    `${artistName} official video`,
    `${artistName} music video`,
    `${artistName} lyrics`,
    `${artistName} hit`,
    `${artistName} popular`,
  ];

  const seen = new Set();
  const allVideos = [];

  // Run 3 queries at a time to speed up
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(q => ytSearchWeb(q, 20).catch(() => ({ videos: [] })))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const v of r.value.videos) {
          if (!seen.has(v.videoId)) {
            seen.add(v.videoId);
            allVideos.push(v);
          }
        }
      }
    }
    if (allVideos.length >= totalLimit) break;
  }

  // The multi-query sweep also picks up other artists' songs that merely
  // mention this artist in their title, so rank the artist's own channel
  // first and use the rest only as filler.
  const target = channelKey(artistName);
  const isOwn = (v) => {
    const owner = channelKey(v.artistName);
    if (!owner || !target) return false;
    return owner === target || owner.startsWith(target) || target.startsWith(owner);
  };
  const own = allVideos.filter(isOwn).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const rest = allVideos.filter(v => !isOwn(v)).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  return [...own, ...rest].slice(0, totalLimit);
}

// --- Single-track resolution ---

// Compare titles/artists on word overlap rather than exact equality: catalogue
// titles carry "(Remastered 2011)" noise and YouTube titles carry feature
// credits, so neither string is a reliable literal key.
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Share of the *query's* words that appear in the candidate. Measuring against
// the candidate instead would penalise official titles purely for carrying
// feature credits ("ft. Pharrell Williams, Nile Rodgers").
function tokenOverlap(query, candidate) {
  const A = new Set(normalizeText(query).split(' ').filter(Boolean));
  const B = new Set(normalizeText(candidate).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hits = 0;
  for (const t of A) if (B.has(t)) hits++;
  return hits / A.size;
}

// Words that mark a candidate as something other than the canonical record:
// other languages, other takes, and non-song uploads. A perfect title/duration
// match on one of these is still the wrong track.
const VARIANT_WORDS = [
  'rehearsal', 'live', 'cover', 'remix', 'karaoke', 'instrumental',
  'nightcore', 'sped up', 'slowed', 'reverb', 'reaction', 'review',
  'interview', 'concert', 'medley', 'tribute', 'mashup', '8d', 'loop',
  'snippet', 'preview', 'shorts', 'demo', 'unplugged', 'acoustic',
  'piano version', 'tutorial', 'lesson', 'how to', 'fan made', 'ai cover',
  'version', 'spa', 'ingles', 'espanol', 'portugues', 'french version',
  'german version', 'italian version', 'spanish version', 'edit', 'mix',
];

function variantPenalty(title) {
  const t = normalizeText(title);
  let penalty = 0;
  for (const w of VARIANT_WORDS) {
    if (t.includes(normalizeText(w))) penalty += 35;
  }
  return penalty;
}

function scoreCandidate(v, title, artist, duration) {
  let score = 0;
  score += tokenOverlap(title, v.title) * 60;
  score += tokenOverlap(artist, v.artistName) * 25;
  const ca = channelKey(artist);
  const cv = channelKey(v.artistName);
  if (ca && (ca === cv || cv.startsWith(ca) || ca.startsWith(cv))) score += 25;
  // Duration corroborates, but it never outranks identity. Official music-video
  // lengths are frequently shorter than the album runtime the catalogue
  // reports, so an exact match on duration must not be able to promote some
  // stranger's re-upload over the artist's own video.
  if (duration > 0 && v.duration > 0) {
    const diff = Math.abs(v.duration - duration);
    if (diff <= Math.max(20, duration * 0.15)) score += 15;
    else if (diff > Math.max(75, duration * 0.35)) score -= 20;
  }
  // Popularity separates the canonical upload from a stranger re-uploading the
  // same title: the real record has orders of magnitude more views than any
  // cover, which text matching on its own cannot see.
  score += Math.log10((v.viewCount || 0) + 1) * 8;
  score -= variantPenalty(v.title);
  return score;
}

async function ytResolveTrack(title, artist, duration) {
  // Two phrasings, because scoring can only pick a studio cut that is actually
  // in the candidate set: the plain query surfaces the record, while the
  // "official video" query surfaces the artist's own upload when it is not the
  // top hit.
  const base = `${artist} ${title}`.trim();
  const [a, b] = await Promise.all([
    ytSearchWeb(base, 20).catch(() => ({ videos: [] })),
    ytSearchWeb(`${base} official video`, 20).catch(() => ({ videos: [] })),
  ]);

  const byId = new Map();
  for (const v of [...(a.videos || []), ...(b.videos || [])]) {
    if (v && v.videoId && !byId.has(v.videoId)) byId.set(v.videoId, v);
  }

  let best = null;
  let bestScore = -Infinity;
  for (const v of byId.values()) {
    const s = scoreCandidate(v, title, artist, duration);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  // Below the floor the best hit is a different song; returning nothing lets the
  // caller fall back rather than playing the wrong track.
  if (!best || bestScore < 45) return [];
  return [best];
}

// --- Routes ---

// General search
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json({ tracks: [], total: 0 });
    const result = await cached(`yt:search:${q}:${limit}`, 60000, () => ytSearchWeb(q, Number(limit)));
    res.json({ tracks: result.videos, total: result.videos.length, nextContinuation: result.nextContinuation });
  } catch (e) {
    console.error('YouTube search error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Artist-specific search — fetches ALL their music
router.get('/artist', async (req, res) => {
  try {
    const { name, limit = 50 } = req.query;
    if (!name) return res.json({ tracks: [], total: 0 });
    const tracks = await cached(`yt:artist:${name}:${limit}`, 300000, () => ytArtistSearch(name, Number(limit)));
    res.json({ tracks, total: tracks.length });
  } catch (e) {
    console.error('YouTube artist search error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

// Resolve one catalogue track (title + artist) to a single best video. Used to
// upgrade 30-second provider previews into full-length official playback.
router.get('/resolve', async (req, res) => {
  try {
    const { title, artist = '', duration = 0 } = req.query;
    if (!title) return res.json({ track: null });
    const dur = Number(duration) || 0;
    const result = await cached(`yt:resolve:${artist}:${title}:${dur}`, 86400000, async () => ({
      tracks: await ytResolveTrack(title, artist, dur),
    }));
    res.json({ track: result.tracks[0] || null });
  } catch (e) {
    console.error('YouTube resolve error:', e.message);
    res.json({ track: null });
  }
});

// Normalise for comparison: lowercase, strip punctuation, collapse spacing.
const normText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Unofficial versions (remixes, covers, live cuts, "sped up" edits). Used to
// penalise a candidate when scoring an audio alternative, so switching a video
// to audio does not silently swap the song for a remix.
const ALT_VERSION_TITLE = /\b(remix|cover|live|acoustic|instrumental|karaoke|lo[\s-]*fi|type\s*beat|bootleg|edit|rework|mashup|flip|sped\s*up|slowed|nightcore|montage)\b/i;
function hasAltVersionIndicator(title) {
  return ALT_VERSION_TITLE.test(title || '');
}

/**
 * Score how well a candidate is actually the requested song.
 *
 * Relevance has to outrank length: preferring a full-length track over a 30
 * second clip is only correct when both are the same recording. Sorting by
 * playback type alone returned a Spanish remix for "love nwantiti" and an
 * unrelated re-upload, so the song match is scored first and a full-length
 * stream is only a tie-break.
 */
function scoreAudioCandidate(candidate, wantedTitle, wantedArtist) {
  if (!candidate) return -1;
  if (candidate.playbackType !== 'full' && candidate.playbackType !== 'preview') return -1;

  const wantTitle = normText(wantedTitle);
  const gotTitle = normText(candidate.title);
  const wantArtist = normText(wantedArtist);
  const gotArtist = normText(candidate.artistName);
  if (!wantTitle || !gotTitle) return -1;

  let score = 0;
  if (gotTitle === wantTitle) score += 100;
  else if (gotTitle.includes(wantTitle)) score += 60;
  else if (wantTitle.includes(gotTitle)) score += 45;
  else {
    // Compare the leading words, which survive titles like "Artist - Song (ft. X)".
    const wantHead = wantTitle.split(' ').slice(0, 4).join(' ');
    if (wantHead.length > 6 && gotTitle.includes(wantHead)) score += 35;
    else return -1;
  }

  if (wantArtist && gotArtist) {
    if (gotArtist === wantArtist) score += 25;
    else if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist)) score += 15;
    else score -= 10;
  }

  if (candidate.playbackType === 'full') score += 8;
  if (hasAltVersionIndicator(candidate.title)) score -= 30;

  return score;
}

// Find a genuinely playable AUDIO source for a song that is currently playing as
// a YouTube video.
//
// The IFrame embed cannot be played as audio-only, so "play the audio instead"
// is only possible when the same song exists on a provider that streams real
// audio (Audius full-length, Deezer/Spotify preview, or a local upload). This
// returns the best such match, or null when the song has no audio alternative
// so the client can say so plainly instead of failing silently.
router.get('/audio-alternative', async (req, res) => {
  try {
    const { title, artist = '' } = req.query;
    if (!title) return res.json({ track: null });

    const musicService = require('../providers/music-service.cjs');
    // The shared cache only persists payloads carrying a non-empty `tracks`
    // array, so the resolved match is cached in that shape.
    const result = await cached(`yt:auda:${artist}:${title}`, 3600000, async () => {
      const found = await musicService.searchTracks(`${artist} ${title}`.trim(), 12);
      const candidates = Array.isArray(found) ? found : [];
      let best = null;
      let bestScore = 0;
      for (const candidate of candidates) {
        const score = scoreAudioCandidate(candidate, title, artist);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }
      return { tracks: best ? [best] : [] };
    });

    const match = (result.tracks || [])[0] || null;
    res.json({
      track: match
        ? { ...match, videoId: null, audioUrl: match.audioUrl || match.previewUrl || match.streamUrl || null }
        : null,
    });
  } catch (e) {
    console.error('YouTube audio-alternative error:', e.message);
    res.json({ track: null });
  }
});

// Load more (pagination)
router.get('/search/more', async (req, res) => {
  try {
    const { q, continuation, limit = 20 } = req.query;
    if (!q || !continuation) return res.json({ tracks: [], total: 0 });
    const result = await ytSearchWeb(q, Number(limit), continuation);
    res.json({ tracks: result.videos, total: result.videos.length, nextContinuation: result.nextContinuation });
  } catch (e) {
    console.error('YouTube search more error:', e.message);
    res.json({ tracks: [], total: 0 });
  }
});

module.exports = router;
// Exposed so the chart provider reuses this scraper instead of duplicating it.
module.exports.ytSearchWeb = ytSearchWeb;
