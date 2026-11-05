const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { authMiddleware: auth, adminOnly } = require('../middleware/auth.cjs');

// Record a play (authenticated)
router.post('/play/:songId', auth, (req, res) => {
  const songId = req.params.songId;
  // Skip external/provider tracks — only track local songs in analytics
  if (songId.includes('_')) return res.json({ totalPlays: 0, skipped: true });
  db.incrementPlayCount(songId);
  // Also add to play_history
  db.prepare('INSERT INTO play_history (user_id, song_id) VALUES (?, ?)').run(req.user.id, songId);
  const count = db.prepare('SELECT count FROM play_counts WHERE song_id = ?').get(songId);
  res.json({ totalPlays: count ? count.count : 1 });
});

// Get play counts for songs
router.get('/plays', (req, res) => {
  const { songIds } = req.query;
  if (!songIds) return res.json({});
  const ids = songIds.split(',');
  res.json(db.getPlayCounts(ids));
});

// Top songs globally (admin)
router.get('/top-songs', adminOnly, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const rows = db.prepare(`
    SELECT s.id, s.title, s.artist_name, s.cover, s.genre, s.mood,
           COALESCE(pc.count, 0) as play_count,
           (SELECT COUNT(*) FROM liked_songs ls WHERE ls.song_id = s.id) as like_count
    FROM songs s LEFT JOIN play_counts pc ON s.id = pc.song_id
    WHERE s.status = 'approved'
    ORDER BY pc.count DESC NULLS LAST LIMIT ?
  `).all(limit);
  res.json(rows);
});

// Top artists by plays (admin)
router.get('/top-artists', adminOnly, (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const rows = db.prepare(`
    SELECT a.id, a.name, a.photo, a.verified,
           COALESCE(SUM(pc.count), 0) as total_plays,
           (SELECT COUNT(*) FROM follows f WHERE f.following_id = a.user_id OR f.following_id = a.id) as followers
    FROM artists a
    LEFT JOIN songs s ON s.artist_id = a.id
    LEFT JOIN play_counts pc ON pc.song_id = s.id
    GROUP BY a.id ORDER BY total_plays DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

// Platform-wide stats (admin)
router.get('/platform', adminOnly, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalSongs = db.prepare('SELECT COUNT(*) as c FROM songs').get().c;
  const totalAlbums = db.prepare('SELECT COUNT(*) as c FROM albums').get().c;
  const totalPlaylists = db.prepare('SELECT COUNT(*) as c FROM playlists').get().c;
  const totalPlays = db.prepare('SELECT COALESCE(SUM(count), 0) as c FROM play_counts').get().c;
  const totalLikes = db.prepare('SELECT COUNT(*) as c FROM liked_songs').get().c;
  const pendingSongs = db.prepare("SELECT COUNT(*) as c FROM songs WHERE status = 'pending'").get().c;
  const totalArtists = db.prepare('SELECT COUNT(*) as c FROM artists').get().c;
  const totalFollows = db.prepare('SELECT COUNT(*) as c FROM follows').get().c;
  const usersByDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count FROM users
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all();
  const playsByDay = db.prepare(`
    SELECT date(played_at) as day, COUNT(*) as count FROM play_history
    WHERE played_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all();
  const topGenres = db.prepare(`
    SELECT genre, COUNT(*) as count FROM songs WHERE status = 'approved' AND genre IS NOT NULL
    GROUP BY genre ORDER BY count DESC LIMIT 10
  `).all();
  const topMoods = db.prepare(`
    SELECT mood, COUNT(*) as count FROM songs WHERE status = 'approved' AND mood IS NOT NULL
    GROUP BY mood ORDER BY count DESC LIMIT 10
  `).all();
  res.json({ totalUsers, totalSongs, totalAlbums, totalPlaylists, totalPlays, totalLikes, pendingSongs, totalArtists, totalFollows, usersByDay, playsByDay, topGenres, topMoods });
});

// Artist stats (authenticated artist only)
router.get('/artist', auth, (req, res) => {
  const artist = db.prepare('SELECT * FROM artists WHERE user_id = ?').get(req.user.id);
  if (!artist) return res.status(404).json({ error: 'Artist profile not found' });

  const totalSongs = db.prepare("SELECT COUNT(*) as c FROM songs WHERE artist_id = ? AND status = 'approved'").get(artist.id).c;
  const pendingSongs = db.prepare("SELECT COUNT(*) as c FROM songs WHERE artist_id = ? AND status = 'pending'").get(artist.id).c;
  const totalPlays = db.prepare(`
    SELECT COALESCE(SUM(pc.count), 0) as c
    FROM songs s LEFT JOIN play_counts pc ON s.id = pc.song_id
    WHERE s.artist_id = ?
  `).get(artist.id).c;
  const totalLikes = db.prepare(`
    SELECT COUNT(*) as c FROM liked_songs ls
    JOIN songs s ON ls.song_id = s.id WHERE s.artist_id = ?
  `).get(artist.id).c;
  const followers = db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(artist.id).c;

  const topSongs = db.prepare(`
    SELECT s.id, s.title, s.cover, s.genre,
           COALESCE(pc.count, 0) as play_count,
           (SELECT COUNT(*) FROM liked_songs ls WHERE ls.song_id = s.id) as like_count
    FROM songs s LEFT JOIN play_counts pc ON s.id = pc.song_id
    WHERE s.artist_id = ? AND s.status = 'approved'
    ORDER BY pc.count DESC NULLS LAST LIMIT 5
  `).all(artist.id);

  const playsByDay = db.prepare(`
    SELECT date(played_at) as day, COUNT(*) as count
    FROM play_history ph JOIN songs s ON ph.song_id = s.id
    WHERE s.artist_id = ? AND played_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all(artist.id);

  const likesByDay = db.prepare(`
    SELECT date(ls.liked_at) as day, COUNT(*) as count
    FROM liked_songs ls JOIN songs s ON ls.song_id = s.id
    WHERE s.artist_id = ? AND ls.liked_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all(artist.id);

  const totalAlbums = db.prepare("SELECT COUNT(DISTINCT album_name) as c FROM songs WHERE artist_id = ? AND status = 'approved' AND album_name IS NOT NULL AND album_name != 'Single'").get(artist.id).c;

  res.json({
    totalSongs, pendingSongs, totalPlays, totalLikes, followers,
    totalAlbums, topSongs, playsByDay, likesByDay,
    verified: artist.verified, name: artist.name, photo: artist.photo,
  });
});

// User stats (authenticated - own stats)
router.get('/user', auth, (req, res) => {
  const totalPlays = db.prepare('SELECT COUNT(*) as c FROM play_history WHERE user_id = ?').get(req.user.id).c;
  const totalLikes = db.prepare('SELECT COUNT(*) as c FROM liked_songs WHERE user_id = ?').get(req.user.id).c;
  const totalDownloads = db.prepare('SELECT COUNT(*) as c FROM downloads WHERE user_id = ?').get(req.user.id).c;
  const followers = db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(req.user.id).c;
  const following = db.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').get(req.user.id).c;
  const topGenres = db.prepare(`
    SELECT s.genre, COUNT(*) as count
    FROM play_history ph JOIN songs s ON ph.song_id = s.id
    WHERE ph.user_id = ? AND s.genre IS NOT NULL
    GROUP BY s.genre ORDER BY count DESC LIMIT 5
  `).all(req.user.id);
  const recentPlays = db.prepare(`
    SELECT s.id, s.title, s.artist_name, s.cover, ph.played_at
    FROM play_history ph JOIN songs s ON ph.song_id = s.id
    WHERE ph.user_id = ? ORDER BY ph.played_at DESC LIMIT 10
  `).all(req.user.id);
  res.json({ totalPlays, totalLikes, totalDownloads, followers, following, topGenres, recentPlays });
});

// Genre distribution (admin)
router.get('/genres', adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT genre, COUNT(*) as song_count,
           COALESCE(SUM(pc.count), 0) as total_plays
    FROM songs s LEFT JOIN play_counts pc ON s.id = pc.song_id
    WHERE s.status = 'approved' AND genre IS NOT NULL
    GROUP BY genre ORDER BY total_plays DESC
  `).all();
  res.json(rows);
});

module.exports = router;
