const express = require('express');
const db = require('../db.cjs');
const { applyTranslations, translateSingle } = require('../db.cjs');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { lang } = req.query;
    const artists = db.prepare('SELECT * FROM artists ORDER BY listeners DESC').all();
    const parsed = artists.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') }));
    const translated = applyTranslations(parsed, lang, 'artist');
    res.json({ artists: translated });
  } catch (err) {
    console.error('[Artists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { lang } = req.query;
    let artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    let songs = db.prepare('SELECT * FROM songs WHERE artist_name = ? AND status = ?').all(artist.name, 'approved');
    let albums = db.prepare('SELECT * FROM albums WHERE artist_id = ?').all(artist.id);

    artist = { ...artist, genres: JSON.parse(artist.genres || '[]') };
    artist = translateSingle(artist, lang, 'artist');
    songs = applyTranslations(songs, lang, 'song');
    albums = applyTranslations(albums, lang, 'album');

    res.json({ artist, songs, albums });
  } catch (err) {
    console.error('[Artists]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
