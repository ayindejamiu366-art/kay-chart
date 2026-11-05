const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { authMiddleware: auth } = require('../middleware/auth.cjs');
const { v4: uuidv4 } = require('uuid');

// Follow/unfollow a user
router.post('/follow/:userId', auth, (req, res) => {
  const { userId } = req.params;
  const followerId = req.user.id;
  if (followerId === userId) return res.status(400).json({ error: 'Cannot follow yourself' });
  const existing = db.prepare('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?').get(followerId, userId);
  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(followerId, userId);
    return res.json({ following: false });
  }
  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(followerId, userId);
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
  if (user) db.addActivity(followerId, 'follow', 'user', userId, user.name, {});
  const follower = db.prepare('SELECT name FROM users WHERE id = ?').get(followerId);
  if (follower) {
    db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)').run(
      'n_' + Date.now(), userId, 'New Follower', `${follower.name} started following you`, 'follow'
    );
  }
  res.json({ following: true });
});

// Check follow status for multiple users
router.post('/follow/check', auth, (req, res) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds)) return res.json({});
  const placeholders = userIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})`).all(req.user.id, ...userIds);
  const set = new Set(rows.map(r => r.following_id));
  const result = {};
  for (const id of userIds) result[id] = set.has(id);
  res.json(result);
});

// Get followers of a user
router.get('/followers/:userId', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.avatar, f.created_at as followed_at
    FROM follows f JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = ? ORDER BY f.created_at DESC
  `).all(req.params.userId);
  res.json(rows);
});

// Get who a user is following
router.get('/following/:userId', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.avatar, f.created_at as followed_at
    FROM follows f JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ? ORDER BY f.created_at DESC
  `).all(req.params.userId);
  res.json(rows);
});

// Get follower/following counts
router.get('/counts/:userId', (req, res) => {
  const followers = db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(req.params.userId).c;
  const following = db.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').get(req.params.userId).c;
  res.json({ followers, following });
});

// Activity feed (public - all recent activity)
router.get('/feed', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const offset = parseInt(req.query.offset) || 0;
  const rows = db.prepare(`
    SELECT a.*, u.name as user_name, u.avatar as user_avatar
    FROM activity_feed a JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json(rows);
});

// Get a user's activity
router.get('/feed/:userId', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const rows = db.prepare(`
    SELECT a.*, u.name as user_name, u.avatar as user_avatar
    FROM activity_feed a JOIN users u ON a.user_id = u.id
    WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT ?
  `).all(req.params.userId, limit);
  res.json(rows);
});

// Search users (for follow suggestions)
router.get('/users/search', auth, (req, res) => {
  const q = req.query.q || '';
  if (q.length < 1) return res.json([]);
  const escapedQ = (q || '').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const rows = db.prepare(`
    SELECT id, name, avatar, role FROM users
    WHERE name LIKE ? ESCAPE '\\' AND id != ? LIMIT 20
  `).all(`%${escapedQ}%`, req.user.id);
  res.json(rows);
});

// Suggested users to follow (users with most songs or popular)
router.get('/suggestions', auth, (req, res) => {
  const alreadyFollowing = db.prepare('SELECT following_id FROM follows WHERE follower_id = ?').all(req.user.id).map(r => r.following_id);
  alreadyFollowing.push(req.user.id);
  const placeholders = alreadyFollowing.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT id, name, avatar, role FROM users
    WHERE id NOT IN (${placeholders}) LIMIT 10
  `).all(...alreadyFollowing);
  res.json(rows);
});

module.exports = router;
