const express = require('express');
const router = express.Router();
const db = require('../db.cjs');

const LRCLIB_BASE = 'https://lrclib.net/api';

function getCachedLyrics(trackId, provider) {
  return db.prepare('SELECT * FROM lyrics_cache WHERE track_id = ? AND provider = ?').get(trackId, provider);
}

function cacheLyrics(trackId, provider, plain, synced, source) {
  db.prepare(`INSERT INTO lyrics_cache (track_id, provider, plain_lyrics, synced_lyrics, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(track_id, provider) DO UPDATE SET plain_lyrics = ?, synced_lyrics = ?, source = ?, fetched_at = datetime('now')`
  ).run(trackId, provider, plain, synced, source, plain, synced, source);
}

async function fetchFromLrclib(title, artist, album, duration) {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (album) params.set('album_name', album);
  if (duration) params.set('duration', String(Math.round(duration)));

  const res = await fetch(`${LRCLIB_BASE}/get?${params}`, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'NocturneMusic/1.0 (https://github.com/nocturne)' },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib ${res.status}`);

  const data = await res.json();
  return {
    plainLyrics: data.plainLyrics || null,
    syncedLyrics: data.syncedLyrics || null,
    source: 'lrclib',
  };
}

async function searchLrclib(title, artist) {
  const res = await fetch(`${LRCLIB_BASE}/search?q=${encodeURIComponent(`${title} ${artist}`)}`, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'NocturneMusic/1.0 (https://github.com/nocturne)' },
  });

  if (!res.ok) throw new Error(`lrclib search ${res.status}`);
  const data = await res.json();
  if (!data || data.length === 0) return null;

  const best = data[0];
  return {
    plainLyrics: best.plainLyrics || null,
    syncedLyrics: best.syncedLyrics || null,
    source: 'lrclib',
  };
}

function parseSyncedLyrics(lrcText) {
  if (!lrcText) return null;
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lines) {
    const times = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10);
      times.push(min * 60 + sec + ms / 1000);
    }
    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    if (times.length > 0 && text) {
      for (const time of times) {
        result.push({ time, text });
      }
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result.length > 0 ? result : null;
}

function generateSummary(lines, themes, sentiment, title, artist) {
  const parts = [];
  parts.push(`"${title}" by ${artist}`);
  if (themes.length > 0) parts.push(`explores themes of ${themes.join(' and ')}`);
  const moodWords = {
    romantic: 'a romantic and emotional tone',
    melancholic: 'a melancholic and introspective mood',
    energetic: 'an energetic and upbeat vibe',
    uplifting: 'an empowering and uplifting spirit',
    reflective: 'a reflective and thoughtful perspective',
    neutral: 'a balanced emotional tone',
  };
  parts.push(`with ${moodWords[sentiment] || moodWords.neutral}`);
  if (lines.length < 8) parts.push('in a concise, focused structure');
  else if (lines.length > 20) parts.push('with a rich, expansive narrative');
  return parts.join(', ') + '.';
}

// POST /api/lyrics/explain — MUST be before /:trackId
router.post('/explain', async (req, res) => {
  try {
    const { lyrics, title, artist } = req.body;
    if (!lyrics) {
      return res.status(400).json({ error: 'Lyrics text is required' });
    }

    const text = typeof lyrics === 'string' ? lyrics : (Array.isArray(lyrics) ? lyrics.map(l => l.text).join('\n') : '');
    const lines = text.split('\n').filter(l => l.trim());
    const wordCount = text.split(/\s+/).length;
    const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;
    const hasRepetition = lines.length > 2 && lines.some((line, i) => lines.indexOf(line) !== i);

    const themes = [];
    const lowerText = text.toLowerCase();
    const themeKeywords = {
      love: ['love', 'heart', 'kiss', 'baby', 'darling', 'sweet', 'romance', 'together'],
      sadness: ['sad', 'cry', 'tears', 'lonely', 'miss', 'broken', 'pain', 'hurt'],
      freedom: ['free', 'fly', 'run', 'escape', 'road', 'sky', 'wind', 'wild'],
      party: ['dance', 'party', 'night', 'club', 'fun', 'jump', 'turn up', 'vibe'],
      struggle: ['fight', 'struggle', 'hard', 'rise', 'grind', 'hustle', 'survive'],
      nature: ['rain', 'sun', 'moon', 'stars', 'ocean', 'fire', 'earth', 'sky'],
      nostalgia: ['remember', 'used to', 'back then', 'memory', 'yesterday', 'once'],
      empowerment: ['strong', 'power', 'unstoppable', 'queen', 'king', 'rise', 'shine'],
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(kw => lowerText.includes(kw))) themes.push(theme);
    }

    const sentiment = themes.includes('sadness') ? 'melancholic'
      : themes.includes('love') ? 'romantic'
      : themes.includes('party') ? 'energetic'
      : themes.includes('empowerment') || themes.includes('freedom') ? 'uplifting'
      : themes.includes('struggle') ? 'reflective'
      : 'neutral';

    const explanation = {
      title: title || 'Unknown',
      artist: artist || 'Unknown',
      stats: { lineCount: lines.length, wordCount, uniqueWords, vocabularyRichness: uniqueWords / Math.max(wordCount, 1) },
      themes,
      sentiment,
      hasRepetition,
      structure: {
        hasIntro: lowerText.includes('[intro') || lowerText.includes('(intro'),
        hasChorus: lowerText.includes('[chorus') || lowerText.includes('(chorus'),
        hasBridge: lowerText.includes('[bridge') || lowerText.includes('(bridge'),
        hasOutro: lowerText.includes('[outro') || lowerText.includes('(outro'),
      },
      summary: generateSummary(lines, themes, sentiment, title, artist),
    };

    res.json({ explanation });
  } catch (err) {
    console.error('[Lyrics Explain]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lyrics/:trackId
router.get('/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const { title, artist, album, duration, provider } = req.query;

    const trackProvider = provider || 'local';
    const cached = getCachedLyrics(trackId, trackProvider);

    if (cached) {
      const synced = cached.synced_lyrics ? JSON.parse(cached.synced_lyrics) : null;
      return res.json({
        trackId,
        provider: trackProvider,
        plainLyrics: cached.plain_lyrics,
        syncedLyrics: synced,
        source: cached.source,
        cached: true,
      });
    }

    if (!title || !artist) {
      return res.json({ trackId, provider: trackProvider, plainLyrics: null, syncedLyrics: null, source: null, cached: false });
    }

    let lyricsData = null;

    try {
      lyricsData = await fetchFromLrclib(title, artist, album, duration);
    } catch (e) {
      console.error('[Lyrics] lrclib get failed:', e.message);
    }

    if (!lyricsData) {
      try {
        lyricsData = await searchLrclib(title, artist);
      } catch (e) {
        console.error('[Lyrics] lrclib search failed:', e.message);
      }
    }

    if (!lyricsData || (!lyricsData.plainLyrics && !lyricsData.syncedLyrics)) {
      return res.json({ trackId, provider: trackProvider, plainLyrics: null, syncedLyrics: null, source: null, cached: false });
    }

    const syncedParsed = lyricsData.syncedLyrics ? parseSyncedLyrics(lyricsData.syncedLyrics) : null;
    const syncedJson = syncedParsed ? JSON.stringify(syncedParsed) : null;

    cacheLyrics(trackId, trackProvider, lyricsData.plainLyrics, syncedJson, lyricsData.source);

    res.json({
      trackId,
      provider: trackProvider,
      plainLyrics: lyricsData.plainLyrics,
      syncedLyrics: syncedParsed,
      source: lyricsData.source,
      cached: false,
    });
  } catch (err) {
    console.error('[Lyrics]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
