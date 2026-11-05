const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');
const { applyTranslations, translateGenre } = require('../db.cjs');
const { authMiddleware, artistOrAdmin } = require('../middleware/auth.cjs');
const { uploadLimiter, searchLimiter } = require('../middleware/rateLimit.cjs');
const { validate, schemas } = require('../middleware/validate.cjs');
const { inspectImage } = require('../utils/image-inspect.cjs');

const router = express.Router();

const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');
const COVER_DIR = path.join(__dirname, '..', 'uploads', 'covers');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(COVER_DIR, { recursive: true });

const COVER_MAX_BYTES = 2 * 1024 * 1024;

/** Read the first `bytes` of a file, for content sniffing. */
async function readHead(filePath, bytes) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.slice(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Delete a file we just wrote, ignoring failures. */
async function removeUploaded(filePath) {
  try { await fs.promises.unlink(filePath); } catch { /* best effort */ }
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, file.fieldname === 'audio' ? AUDIO_DIR : COVER_DIR);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.\w]/g, '');
      cb(null, `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 2,
    // The route reads title, albumName, duration, mood and genre. `fields` and
    // `parts` cap the multipart body so a client cannot send an unbounded number
    // of tiny text fields and exhaust CPU/memory while the body is parsed —
    // fileSize alone does not bound that.
    fields: 8,
    parts: 12,
  },
  fileFilter(req, file, cb) {
    if (file.fieldname === 'audio') {
      const ok = /\.(mp3|wav|m4a|aac|ogg|flac|webm|opus)$/i.test(file.originalname);
      return ok ? cb(null, true) : cb(new Error('Unsupported audio format'));
    }
    if (file.fieldname === 'cover') {
      const ok = /\.(png|jpe?g|gif|webp)$/i.test(file.originalname);
      return ok ? cb(null, true) : cb(new Error('Unsupported image format'));
    }
    cb(null, true);
  },
});

router.get('/', searchLimiter, (req, res) => {
  try {
    const { mood, genre, search, lang } = req.query;
    let query = 'SELECT * FROM songs WHERE status = ?';
    const params = ['approved'];

    if (mood) { query += ' AND mood = ?'; params.push(mood); }
    if (genre) {
      const translatedGenre = translateGenre(genre, lang) || genre;
      query += ' AND (genre = ? OR genre = ?)';
      params.push(genre, translatedGenre);
    }
    if (search) { query += ' AND (title LIKE ? OR artist_name LIKE ? OR genre LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    let songs = db.prepare(query).all(...params);
    songs = applyTranslations(songs, lang, 'song');
    res.json({ songs });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const songs = db.prepare('SELECT * FROM songs WHERE status = ? ORDER BY created_at DESC').all('pending');
    res.json({ songs });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/artist', authMiddleware, (req, res) => {
  try {
    const songs = db.prepare('SELECT * FROM songs WHERE uploaded_by = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ songs });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json({ song });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, artistOrAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), uploadLimiter, validate(schemas.songUpload), async (req, res) => {
  try {
    const { title, albumName, duration, mood, genre } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title and audio file are required' });

    const id = 's_' + Date.now();
    const status = req.user.role === 'admin' ? 'approved' : 'pending';

    const audioFile = req.files?.audio?.[0];
    const coverFile = req.files?.cover?.[0];
    if (!audioFile) return res.status(400).json({ error: 'Title and audio file are required' });

    // The cover is written to disk by the time we get here, and its stored
    // extension came from the client-supplied filename. Re-check the real bytes
    // before recording it, so a file named `cover.png` that is not an image is
    // never published into a directory served as images.
    if (coverFile) {
      const head = await readHead(coverFile.path, 64);
      const detected = inspectImage(head);
      if (!detected) {
        await removeUploaded(coverFile.path);
        return res.status(400).json({ error: 'Cover file is not a recognised image' });
      }
      // A cover is a still image; the 50MB audio ceiling is far too generous and
      // is the only per-file limit multer applies to this field.
      if (coverFile.size > COVER_MAX_BYTES) {
        await removeUploaded(coverFile.path);
        return res.status(413).json({ error: `Cover image must be under ${Math.round(COVER_MAX_BYTES / 1024 / 1024)}MB` });
      }
    }

    // Real uploaded audio is served from /uploads/audio/<file>. If no audio was
    // uploaded, audio_url stays null and the stream route will serve generated audio.
    const artistName = req.user.name;

    const audioUrl = audioFile ? `/uploads/audio/${audioFile.filename}` : null;
    const cover = coverFile ? `/uploads/covers/${coverFile.filename}` : null;

    db.prepare(`INSERT INTO songs (id, title, artist_id, artist_name, album_name, duration, cover, mood, genre, audio_url, uploaded_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, title.trim(), req.user.id, artistName, albumName || null, Number(duration) || 0, cover, mood || 'chill', genre || 'Pop', audioUrl, req.user.id, status
    );

    if (status === 'pending') {
      const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
      for (const admin of admins) {
        db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)').run(
          'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          admin.id,
          'New Upload',
          `${req.user.name} uploaded "${title}" for review`,
          'upload'
        );
      }
    }

    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
    res.json({ song, status });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/approve', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    db.prepare('UPDATE songs SET status = ? WHERE id = ?').run('approved', req.params.id);
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
    if (song && song.uploaded_by) {
      db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)').run(
        'n_' + Date.now(), song.uploaded_by, 'Upload Approved', `"${song.title}" is now live!`, 'upload'
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reject', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    db.prepare('UPDATE songs SET status = ? WHERE id = ?').run('rejected', req.params.id);
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
    if (song && song.uploaded_by) {
      db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)').run(
        'n_' + Date.now(), song.uploaded_by, 'Upload Rejected', `"${song.title}" was not approved.`, 'upload'
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Songs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
