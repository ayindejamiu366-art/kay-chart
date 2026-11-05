const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');
const { applyTranslations, translateSingle } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { validate, schemas } = require('../middleware/validate.cjs');

const router = express.Router();

function sendPlaylist(playlist, lang, res) {
  playlist = translateSingle(playlist, lang, 'playlist');
  let songs = db.prepare(`
    SELECT s.* FROM songs s
    JOIN playlist_songs ps ON s.id = ps.song_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.position
  `).all(playlist.id);
  songs = applyTranslations(songs, lang, 'song');
  res.json({ playlist, songs });
}

router.get('/', authMiddleware, (req, res) => {
  try {
    const { lang } = req.query;
    let playlists = db.prepare('SELECT * FROM playlists WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC').all(req.user.id);
    playlists = applyTranslations(playlists, lang, 'playlist');
    res.json({ playlists });
  } catch (err) {
    console.error('[Playlists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { lang } = req.query;
    let playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (!playlist.is_public) {
      const { authMiddleware: am } = require('../middleware/auth.cjs');
      return am(req, res, () => {
        if (req.user.id !== playlist.user_id) {
          return res.status(403).json({ error: 'This playlist is private' });
        }
        sendPlaylist(playlist, lang, res);
      });
    }

    sendPlaylist(playlist, lang, res);
  } catch (err) {
    console.error('[Playlists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, validate(schemas.playlistCreate), (req, res) => {
  try {
    const { title, description, cover, isPublic } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const id = 'pl_' + uuidv4().slice(0, 8);
    db.prepare('INSERT INTO playlists (id, user_id, title, description, cover, is_public) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, req.user.id, title, description || '', cover || '', isPublic !== false ? 1 : 0
    );

    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
    res.json({ playlist });
  } catch (err) {
    console.error('[Playlists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/songs', authMiddleware, (req, res) => {
  try {
    const { songIds } = req.body;
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found or not yours' });

    const maxPos = db.prepare('SELECT MAX(position) as m FROM playlist_songs WHERE playlist_id = ?').get(req.params.id);
    let pos = (maxPos.m || 0) + 1;

    const insert = db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)');
    for (const songId of (songIds || [])) {
      insert.run(req.params.id, songId, pos++);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Playlists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Playlists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
