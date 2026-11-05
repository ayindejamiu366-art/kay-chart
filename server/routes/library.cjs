const express = require('express');
const db = require('../db.cjs');
const { applyTranslations } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');

const router = express.Router();

router.get('/liked', authMiddleware, (req, res) => {
  try {
    const lang = req.query.lang;
    let songs = db.prepare(`
      SELECT s.* FROM songs s
      JOIN liked_songs ls ON s.id = ls.song_id
      WHERE ls.user_id = ?
      ORDER BY ls.created_at DESC
    `).all(req.user.id);
    songs = applyTranslations(songs, lang, 'song');
    res.json({ songs });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/liked/:songId', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM liked_songs WHERE user_id = ? AND song_id = ?').get(req.user.id, req.params.songId);
    if (existing) {
      db.prepare('DELETE FROM liked_songs WHERE user_id = ? AND song_id = ?').run(req.user.id, req.params.songId);
      res.json({ liked: false });
    } else {
      db.prepare('INSERT INTO liked_songs (user_id, song_id) VALUES (?, ?)').run(req.user.id, req.params.songId);
      res.json({ liked: true });
    }
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/liked/check', authMiddleware, (req, res) => {
  try {
    const liked = db.prepare('SELECT song_id FROM liked_songs WHERE user_id = ?').all(req.user.id).map(r => r.song_id);
    res.json({ liked });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/downloads', authMiddleware, (req, res) => {
  try {
    const lang = req.query.lang;
    let songs = db.prepare(`
      SELECT s.* FROM songs s
      JOIN downloads d ON s.id = d.song_id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(req.user.id);
    songs = applyTranslations(songs, lang, 'song');
    res.json({ songs });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/downloads/:songId', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM downloads WHERE user_id = ? AND song_id = ?').get(req.user.id, req.params.songId);
    if (existing) {
      db.prepare('DELETE FROM downloads WHERE user_id = ? AND song_id = ?').run(req.user.id, req.params.songId);
      res.json({ downloaded: false });
    } else {
      db.prepare('INSERT INTO downloads (user_id, song_id) VALUES (?, ?)').run(req.user.id, req.params.songId);
      res.json({ downloaded: true });
    }
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', authMiddleware, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT s.*, ph.played_at FROM songs s
      JOIN play_history ph ON s.id = ph.song_id
      WHERE ph.user_id = ?
      ORDER BY ph.played_at DESC
      LIMIT 200
    `).all(req.user.id);
    res.json({ history });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/history/:songId', authMiddleware, (req, res) => {
  try {
    const songId = req.params.songId;
    // Skip external/provider tracks — only track local songs in history
    if (songId.includes('_')) return res.json({ success: true, skipped: true });

    db.prepare('INSERT INTO play_history (user_id, song_id) VALUES (?, ?)').run(req.user.id, songId);

    db.prepare('DELETE FROM recently_played WHERE user_id = ? AND song_id = ?').run(req.user.id, songId);
    db.prepare('INSERT INTO recently_played (user_id, song_id) VALUES (?, ?)').run(req.user.id, songId);

    const count = db.prepare('SELECT COUNT(*) as c FROM recently_played WHERE user_id = ?').get(req.user.id);
    if (count.c > 20) {
      db.prepare(`DELETE FROM recently_played WHERE user_id = ? AND song_id NOT IN (SELECT song_id FROM recently_played WHERE user_id = ? ORDER BY played_at DESC LIMIT 20)`).run(req.user.id, req.user.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent', authMiddleware, (req, res) => {
  try {
    const lang = req.query.lang;
    let songs = db.prepare(`
      SELECT s.* FROM songs s
      JOIN recently_played rp ON s.id = rp.song_id
      WHERE rp.user_id = ?
      ORDER BY rp.played_at DESC
    `).all(req.user.id);
    songs = applyTranslations(songs, lang, 'song');
    res.json({ songs });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recommendations', authMiddleware, (req, res) => {
  try {
    const lang = req.query.lang;
    const history = db.prepare('SELECT song_id FROM play_history WHERE user_id = ? ORDER BY played_at DESC LIMIT 50').all(req.user.id).map(r => r.song_id);
    const recentSet = new Set(history);

    const allSongs = db.prepare("SELECT * FROM songs WHERE status = 'approved'").all();

    const genreScores = {};
    const artistScores = {};
    for (const sid of history) {
      const s = allSongs.find(x => x.id === sid);
      if (s) { genreScores[s.genre] = (genreScores[s.genre] || 0) + 1; artistScores[s.artist_name] = (artistScores[s.artist_name] || 0) + 1; }
    }

    const scored = allSongs.map(s => {
      let score = 0;
      score += (genreScores[s.genre] || 0) * 3;
      score += (artistScores[s.artist_name] || 0) * 1;
      if (recentSet.has(s.id)) score -= 2;
      return { ...s, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const songs = applyTranslations(scored.slice(0, 20), lang, 'song');
    res.json({ songs });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', authMiddleware, (req, res) => {
  try {
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json({ notifications });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications/:id/read', authMiddleware, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications/read-all', authMiddleware, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', authMiddleware, (req, res) => {
  try {
    const liked = db.prepare('SELECT COUNT(*) as c FROM liked_songs WHERE user_id = ?').get(req.user.id).c;
    const downloads = db.prepare('SELECT COUNT(*) as c FROM downloads WHERE user_id = ?').get(req.user.id).c;
    const playlists = db.prepare('SELECT COUNT(*) as c FROM playlists WHERE user_id = ?').get(req.user.id).c;
    const plays = db.prepare('SELECT COUNT(*) as c FROM play_history WHERE user_id = ?').get(req.user.id).c;
    res.json({ liked, downloads, playlists, plays });
  } catch (err) {
    console.error('[Library]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
