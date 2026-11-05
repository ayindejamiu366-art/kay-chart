/**
 * Events Routes
 * Track user interactions (play, skip, like, save) to feed the internal trending engine.
 */

const express = require('express');
const db = require('../db.cjs');
const { recordEvent } = require('../providers/trending.cjs');
const { asyncHandler } = require('../utils/validators.cjs');

const router = express.Router();

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth.cjs');
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      if (decoded.id && decoded.email) {
        const user = db.prepare('SELECT id, email, role FROM users WHERE id = ? AND email = ?').get(decoded.id, decoded.email);
        if (user) req.user = user;
      }
    } catch (_) {}
  }
  next();
}

router.post('/play', optionalAuth, asyncHandler(async (req, res) => {
  const { trackId, provider, deviceId } = req.body || {};
  const userId = req.user?.id || null;
  if (!trackId || !provider) return res.status(400).json({ error: 'trackId and provider required' });
  recordEvent(trackId, provider, 'play', userId, deviceId);
  res.json({ ok: true });
}));

router.post('/complete', optionalAuth, asyncHandler(async (req, res) => {
  const { trackId, provider, deviceId } = req.body || {};
  const userId = req.user?.id || null;
  if (!trackId || !provider) return res.status(400).json({ error: 'trackId and provider required' });
  recordEvent(trackId, provider, 'play_complete', userId, deviceId);
  res.json({ ok: true });
}));

router.post('/skip', optionalAuth, asyncHandler(async (req, res) => {
  const { trackId, provider, deviceId } = req.body || {};
  const userId = req.user?.id || null;
  if (!trackId || !provider) return res.status(400).json({ error: 'trackId and provider required' });
  recordEvent(trackId, provider, 'skip', userId, deviceId);
  res.json({ ok: true });
}));

router.post('/like', optionalAuth, asyncHandler(async (req, res) => {
  const { trackId, provider, deviceId } = req.body || {};
  const userId = req.user?.id || null;
  if (!trackId || !provider) return res.status(400).json({ error: 'trackId and provider required' });
  recordEvent(trackId, provider, 'like', userId, deviceId);
  res.json({ ok: true });
}));

router.post('/save', optionalAuth, asyncHandler(async (req, res) => {
  const { trackId, provider, deviceId } = req.body || {};
  const userId = req.user?.id || null;
  if (!trackId || !provider) return res.status(400).json({ error: 'trackId and provider required' });
  recordEvent(trackId, provider, 'save', userId, deviceId);
  res.json({ ok: true });
}));

module.exports = router;
