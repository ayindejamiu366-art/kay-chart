const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { inspectImage } = require('../utils/image-inspect.cjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');
const musicService = require('../providers/music-service.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { uploadLimiter, searchLimiter } = require('../middleware/rateLimit.cjs');
const {
  SETUP_STEPS,
  validateUsername,
  checkUsernameAvailable,
  normalizeCountry,
  readProfileState,
} = require('../profile.cjs');

const router = express.Router();

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIN_DIMENSION = 64;
const AVATAR_MAX_DIMENSION = 4096;
const MAX_GENRES = 12;
const MAX_ARTISTS = 20;

// Avatars are small, so they are buffered in memory and validated before
// anything touches the disk. A rejected file therefore never exists on the
// filesystem at all, and the stored name is generated from the *detected* type
// rather than anything the client sent.
//
// `fields` and `parts` are set because `fileSize`/`files` alone do not bound a
// multipart body: an attacker can send an unbounded number of small text fields,
// or many parts, and exhaust CPU/memory while parsing. Capping the part count is
// the mitigation for that class of denial of service.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_BYTES,
    files: 1,
    fields: 6,
    parts: 8,
  },
});

const IMAGE_TYPES = {
  'image/png': { ext: '.png' },
  'image/jpeg': { ext: '.jpg' },
  'image/gif': { ext: '.gif' },
  'image/webp': { ext: '.webp' },
};

/** Remove a previously uploaded avatar that we own, so orphans do not pile up. */
function removeOwnedAvatar(avatarPath) {
  if (!avatarPath || typeof avatarPath !== 'string') return;
  if (!avatarPath.startsWith('/uploads/avatars/')) return;
  const filename = path.basename(avatarPath);
  // basename() strips any traversal, but keep the check explicit.
  if (!/^[\w.-]+$/.test(filename)) return;
  const absolute = path.join(AVATAR_DIR, filename);
  if (path.dirname(absolute) !== path.normalize(AVATAR_DIR)) return;
  fs.promises.unlink(absolute).catch(() => {});
}

function sendValidationError(res, error) {
  return res.status(error.status || 400).json({ error: error.error });
}

function coerceStringArray(value, max) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map(v => String(v).trim())
    .filter(v => v.length > 0)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (cleaned.length > max) return null;
  return cleaned;
}

// --- Setup options ------------------------------------------------------------

// Real genres from the configured music providers. Cached in-process because
// this list is static for any practical length of time and the wizard asks for
// it on every visit.
let genreCache = null;
async function getRealGenres() {
  if (genreCache) return genreCache;
  const genres = await musicService.getGenres();
  genreCache = (Array.isArray(genres) ? genres : [])
    // The provider exposes an "All" pseudo-genre, which is not a real genre.
    .filter(g => g && g.name && String(g.name).toLowerCase() !== 'all')
    .map(g => ({ id: String(g.id), name: String(g.name) }));
  return genreCache;
}

router.get('/options/genres', searchLimiter, async (req, res) => {
  try {
    const genres = await getRealGenres();
    res.json({ genres });
  } catch (err) {
    res.status(500).json({ error: 'Could not load genres' });
  }
});

// Real artists already in the app's own catalogue, so the default list never
// invents anybody. Free-text search against the live providers is handled by the
// existing /api/music/search/artists endpoint.
router.get('/options/artists', authMiddleware, (req, res) => {
  try {
    const artists = db.prepare('SELECT id, name, photo FROM artists ORDER BY name').all();
    res.json({ artists });
  } catch (err) {
    res.status(500).json({ error: 'Could not load artists' });
  }
});

// --- Username ----------------------------------------------------------------

router.get('/username-available', authMiddleware, searchLimiter, (req, res) => {
  const me = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
  const result = checkUsernameAvailable(req.query.username, me ? me.username : null);

  if (!result.ok) {
    // Report availability as a normal answer so the client can show it inline,
    // but keep the machine-readable reason for reserved/invalid names.
    return res.status(200).json({
      available: false,
      reason: result.error === 'USERNAME_TAKEN' ? 'taken' : 'invalid',
      error: result.error,
    });
  }

  res.json({ available: true, username: result.username });
});

// --- Wizard state ------------------------------------------------------------

router.get('/setup', authMiddleware, (req, res) => {
  try {
    res.json({ ...readProfileState(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load your profile setup' });
  }
});

/**
 * Persist partial progress so the wizard can be resumed. Every field is
 * optional: the client sends whichever step the user just completed.
 */
router.post('/setup', authMiddleware, (req, res) => {
  try {
    const updates = [];
    const params = [];

    if (req.body.username !== undefined) {
      // Compare against the caller's current username so re-saving it, or
      // changing only its casing, is not treated as a conflict with itself.
      const me = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
      const result = checkUsernameAvailable(req.body.username, me ? me.username : null);
      if (!result.ok) return sendValidationError(res, result);
      updates.push('username = ?', 'username_normalized = ?');
      params.push(result.username, result.normalized);
    }

    if (req.body.genres !== undefined) {
      const genres = coerceStringArray(req.body.genres, MAX_GENRES);
      if (!genres) return res.status(400).json({ error: `Choose up to ${MAX_GENRES} genres` });
      updates.push('genres = ?');
      params.push(JSON.stringify(genres));
    }

    if (req.body.selectedArtists !== undefined) {
      const artists = coerceStringArray(req.body.selectedArtists, MAX_ARTISTS);
      if (!artists) return res.status(400).json({ error: `Choose up to ${MAX_ARTISTS} artists` });
      updates.push('selected_artists = ?');
      params.push(JSON.stringify(artists));
    }

    if (req.body.country !== undefined) {
      const result = normalizeCountry(req.body.country);
      if (!result.ok) return sendValidationError(res, result);
      updates.push('country = ?');
      params.push(result.country);
    }

    if (req.body.step !== undefined) {
      if (!SETUP_STEPS.includes(req.body.step)) {
        return res.status(400).json({ error: 'Unknown setup step' });
      }
      const setStep = db.prepare('UPDATE user_preferences SET profile_setup_step = ? WHERE user_id = ?');
      const result = setStep.run(req.body.step, req.user.id);
      if (!result.changes) {
        db.prepare('INSERT OR IGNORE INTO user_preferences (user_id, profile_setup_step) VALUES (?, ?)')
          .run(req.user.id, req.body.step);
      }
    }

    if (updates.length) {
      params.push(req.user.id);
      const result = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      if (!result.changes) return res.status(404).json({ error: 'User not found' });
    }

    res.json({ ...readProfileState(req.user.id) });
  } catch (err) {
    // The unique index is the real guard against two browsers claiming the same
    // username at the same moment; the read-then-write above is only a fast path.
    if (String(err.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'USERNAME_TAKEN' });
    }
    res.status(500).json({ error: 'Could not save your profile setup' });
  }
});

/** Finalise setup. Everything required must already be persisted. */
router.post('/setup/complete', authMiddleware, (req, res) => {
  try {
    const state = readProfileState(req.user.id);

    if (!state.username) return res.status(400).json({ error: 'Choose a username to finish setup' });
    if (state.genres.length === 0) return res.status(400).json({ error: 'Choose at least one genre to finish setup' });
    if (state.selectedArtists.length === 0) return res.status(400).json({ error: 'Choose at least one artist to finish setup' });
    if (!state.country) return res.status(400).json({ error: 'Choose your country to finish setup' });

    const update = db.prepare(`
      UPDATE user_preferences
         SET profile_setup_completed = 1, profile_setup_step = 'summary'
       WHERE user_id = ?
    `).run(req.user.id);
    if (!update.changes) {
      db.prepare(`
        INSERT OR IGNORE INTO user_preferences (user_id, profile_setup_completed, profile_setup_step)
        VALUES (?, 1, 'summary')
      `).run(req.user.id);
    }

    res.json({ ...readProfileState(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: 'Could not finish your profile setup' });
  }
});

// --- Avatar ------------------------------------------------------------------

router.post('/avatar', authMiddleware, uploadLimiter, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Profile photos must be smaller than 5MB'
        : 'Could not upload that profile photo';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose a profile photo to upload' });

    const detected = inspectImage(req.file.buffer);
    if (!detected) {
      return res.status(400).json({ error: 'Profile photos must be a PNG, JPEG, GIF or WebP image' });
    }
    if (!IMAGE_TYPES[detected.mime]) {
      return res.status(400).json({ error: 'Profile photos must be a PNG, JPEG, GIF or WebP image' });
    }
    if (detected.width < AVATAR_MIN_DIMENSION || detected.height < AVATAR_MIN_DIMENSION) {
      return res.status(400).json({ error: `Profile photos must be at least ${AVATAR_MIN_DIMENSION}x${AVATAR_MIN_DIMENSION} pixels` });
    }
    if (detected.width > AVATAR_MAX_DIMENSION || detected.height > AVATAR_MAX_DIMENSION) {
      return res.status(400).json({ error: `Profile photos must be smaller than ${AVATAR_MAX_DIMENSION}x${AVATAR_MAX_DIMENSION} pixels` });
    }

    const previous = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    const filename = `${req.user.id}_${uuidv4().slice(0, 8)}${IMAGE_TYPES[detected.mime].ext}`;

    try {
      fs.writeFileSync(path.join(AVATAR_DIR, filename), req.file.buffer);
    } catch (writeErr) {
      return res.status(500).json({ error: 'Could not save that profile photo' });
    }

    // Only ever hand back a public URL, never a filesystem path.
    const avatar = `/uploads/avatars/${filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
    if (previous && previous.avatar !== avatar) removeOwnedAvatar(previous.avatar);

    res.json({ avatar, ...readProfileState(req.user.id) });
  });
});

/** Explicitly clear a custom avatar and fall back to the generated one. */
router.post('/avatar/remove', authMiddleware, (req, res) => {
  try {
    const previous = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(req.user.id);
    if (previous) removeOwnedAvatar(previous.avatar);
    res.json({ avatar: null, ...readProfileState(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: 'Could not remove that profile photo' });
  }
});

module.exports = router;
