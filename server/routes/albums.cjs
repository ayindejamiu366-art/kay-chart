const express = require('express');
const db = require('../db.cjs');
const { applyTranslations, translateSingle } = require('../db.cjs');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { lang } = req.query;
    let albums = db.prepare('SELECT * FROM albums ORDER BY year DESC').all();
    albums = applyTranslations(albums, lang, 'album');
    res.json({ albums });
  } catch (err) {
    console.error('[Albums]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { lang } = req.query;
    let album = db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    let songs = db.prepare(`
      SELECT s.* FROM songs s
      JOIN album_songs a ON s.id = a.song_id
      WHERE a.album_id = ?
      ORDER BY a.position
    `).all(req.params.id);

    album = translateSingle(album, lang, 'album');
    songs = applyTranslations(songs, lang, 'song');

    res.json({ album, songs });
  } catch (err) {
    console.error('[Albums]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
