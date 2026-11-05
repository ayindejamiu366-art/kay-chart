const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { streamLimiter } = require('../middleware/rateLimit.cjs');

const PROVIDER_STREAMS = {
  audius: (trackId) => `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=NocturneMusic`,
  deezer: null,
  spotify: null,
  local: null,
  jamendo: (trackId) => null, // Jamendo audio URLs come from the track metadata, not a fixed URL pattern
};

function isExternalTrack(id) {
  return /^(audius|deezer|spotify|jamendo)_/.test(id);
}

function parseExternalId(id) {
  const match = id.match(/^(audius|deezer|spotify|jamendo)_(.+)$/);
  if (!match) return null;
  return { provider: match[1], providerTrackId: match[2] };
}

async function resolveSource(id) {
  if (isExternalTrack(id)) {
    const parsed = parseExternalId(id);
    if (!parsed) return null;

    // Jamendo: audio URL comes from track metadata, so the lookup is async.
    if (parsed.provider === 'jamendo') {
      try {
        const musicService = require('../providers/music-service.cjs');
        const track = await musicService.getTrack(id);
        if (track && track.streamUrl) {
          return { type: 'proxy', streamUrl: track.streamUrl, provider: 'jamendo', trackId: parsed.providerTrackId };
        }
      } catch (err) {
        console.error(`[Stream] Jamendo resolve failed for ${id}: ${err.message}`);
      }
      return null;
    }

    const streamUrlFactory = PROVIDER_STREAMS[parsed.provider];
    if (!streamUrlFactory) return null;
    const streamUrl = streamUrlFactory(parsed.providerTrackId);
    if (!streamUrl) return null;
    return { type: 'proxy', streamUrl, provider: parsed.provider, trackId: parsed.providerTrackId };
  }

  const song = db.prepare('SELECT id, title, audio_url, status FROM songs WHERE id = ?').get(id) || null;
  if (song && song.audio_url && song.audio_url.startsWith('/uploads/audio/')) {
    const filePath = path.join(__dirname, '..', song.audio_url);
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'audio');
    if (!resolved.startsWith(uploadsDir)) return null;
    if (fs.existsSync(resolved)) {
      const ext = path.extname(resolved).toLowerCase();
      const MIME_TYPES = {
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg',
        '.opus': 'audio/ogg; codecs=opus',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.webm': 'audio/webm',
      };
      const mime = MIME_TYPES[ext] || 'audio/mpeg';
      return { type: 'file', song, filePath: resolved, mime, size: fs.statSync(resolved).size };
    }
  }
  return null;
}

async function proxyStream(src, req, res) {
  const headers = { 'User-Agent': 'NocturneMusic/2.0' };
  const range = req.headers.range;
  if (range) headers['Range'] = range;

  let upstream;
  try {
    upstream = await fetch(src.streamUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });
  } catch (fetchErr) {
    console.error(`[Stream] Fetch failed for ${src.provider}: ${fetchErr.message}`);
    if (!res.headersSent) return res.status(502).json({ error: `Failed to reach ${src.provider} stream` });
    return;
  }
  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: `Upstream ${src.provider} returned ${upstream.status}` });
  }

  res.status(upstream.status === 206 ? 206 : 200);
  const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
  for (const h of passHeaders) {
    const val = upstream.headers.get(h);
    if (val) res.set(h, val);
  }
  if (!res.get('Content-Type')) res.set('Content-Type', 'audio/mpeg');
  if (!res.get('Cache-Control')) res.set('Cache-Control', 'public, max-age=3600');

  const reader = upstream.body.getReader();
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  };
  pump().catch(() => { try { res.end(); } catch {} });
}

function sendRangeFiles(src, req, res) {
  res.set('Accept-Ranges', 'bytes');
  res.set('Content-Type', src.mime);
  res.set('Cache-Control', 'public, max-age=86400');
  const range = req.headers.range;
  if (!range) {
    res.set('Content-Length', src.size);
    return fs.createReadStream(src.filePath).pipe(res);
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return res.status(416).set('Content-Range', `bytes */${src.size}`).end();
  let start = match[1] ? Number(match[1]) : Math.max(0, src.size - Number(match[2]));
  let end = match[2] ? Number(match[2]) : src.size - 1;
  if (start < 0 || start >= src.size || end < start) return res.status(416).set('Content-Range', `bytes */${src.size}`).end();
  end = Math.min(end, src.size - 1);
  res.status(206);
  res.set('Content-Range', `bytes ${start}-${end}/${src.size}`);
  res.set('Content-Length', end - start + 1);
  fs.createReadStream(src.filePath, { start, end }).pipe(res);
}

async function handle(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const src = await resolveSource(id);
  if (!src) return res.status(404).json({ error: 'Track not available for streaming' });
  if (src.type === 'proxy') return proxyStream(src, req, res);
  if (src.type === 'file') return sendRangeFiles(src, req, res);
  return res.status(404).json({ error: 'Track not available' });
}

router.get('/:id', streamLimiter, (req, res) => {
  handle(req, res).catch(err => {
    console.error('[Stream] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Audio unavailable' });
  });
});

module.exports = router;
