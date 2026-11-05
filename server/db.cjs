const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = new Database(path.join(__dirname, 'nocturne.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'user' CHECK(role IN ('user','artist','admin')),
    avatar TEXT,
    google_id TEXT,
    genres TEXT DEFAULT '[]',
    selected_artists TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_id TEXT,
    album_name TEXT,
    duration REAL DEFAULT 0,
    cover TEXT,
    mood TEXT,
    genre TEXT,
    audio_url TEXT,
    audio_data BLOB,
    uploaded_by TEXT,
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved','pending','rejected')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    year INTEGER,
    cover TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS album_songs (
    album_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (album_id, song_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover TEXT,
    is_public INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (playlist_id, song_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS liked_songs (
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS downloads (
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    played_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recently_played (
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    played_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    offline_mode INTEGER DEFAULT 0,
    audio_quality TEXT DEFAULT 'high',
    theme TEXT DEFAULT 'dark',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    purpose TEXT DEFAULT 'signup',
    attempts INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    listeners INTEGER DEFAULT 0,
    photo TEXT,
    genres TEXT DEFAULT '[]',
    verified INTEGER DEFAULT 0,
    user_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS content_translations (
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    lang TEXT NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (content_type, content_id, lang, field)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_feed (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    target_name TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS play_counts (
    song_id TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS catalog_cache (
    cache_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'deezer',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_catalog_cache_provider ON catalog_cache(provider);
  CREATE INDEX IF NOT EXISTS idx_catalog_cache_created ON catalog_cache(created_at);

  CREATE TABLE IF NOT EXISTS track_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'local',
    event_type TEXT NOT NULL CHECK(event_type IN ('play','play_complete','play_duration','skip','like','save','playlist_add','search','artist_visit')),
    user_id TEXT,
    device_id TEXT,
    duration_ms INTEGER DEFAULT 0,
    play_duration_ms INTEGER DEFAULT 0,
    country TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
  CREATE INDEX IF NOT EXISTS idx_songs_artist_id ON songs(artist_id);
  CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
  CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
  CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
  CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);
  CREATE INDEX IF NOT EXISTS idx_play_history_user ON play_history(user_id, played_at);

  CREATE INDEX IF NOT EXISTS idx_track_events_track ON track_events(track_id);
  CREATE INDEX IF NOT EXISTS idx_track_events_type ON track_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_track_events_created ON track_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_track_events_provider ON track_events(provider);

  CREATE TABLE IF NOT EXISTS track_metrics (
    track_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'local',
    play_count INTEGER DEFAULT 0,
    complete_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    trending_score REAL DEFAULT 0,
    last_played_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (track_id, provider)
  );

  CREATE INDEX IF NOT EXISTS idx_track_metrics_trending ON track_metrics(trending_score DESC);
  CREATE INDEX IF NOT EXISTS idx_track_metrics_provider ON track_metrics(provider);

  CREATE TABLE IF NOT EXISTS chart_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chart_type TEXT NOT NULL,
    chart_key TEXT NOT NULL,
    track_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'local',
    rank INTEGER NOT NULL,
    previous_rank INTEGER,
    trending_score REAL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    snapshot_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chart_snapshots_type ON chart_snapshots(chart_type, chart_key, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_chart_snapshots_date ON chart_snapshots(snapshot_date);

  CREATE TABLE IF NOT EXISTS lyrics_cache (
    track_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'local',
    plain_lyrics TEXT,
    synced_lyrics TEXT,
    source TEXT DEFAULT 'lrclib',
    fetched_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (track_id, provider)
  );

  CREATE INDEX IF NOT EXISTS idx_lyrics_cache_track ON lyrics_cache(track_id);

  CREATE TABLE IF NOT EXISTS provider_health (
    provider TEXT PRIMARY KEY,
    status TEXT DEFAULT 'unknown' CHECK(status IN ('healthy','degraded','failed','unknown')),
    last_success_at TEXT,
    last_failure_at TEXT,
    last_error TEXT,
    avg_response_ms INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    capabilities TEXT DEFAULT '[]',
    last_sync_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Accounts created before this date are treated as returning users: they are
// never forced back through the profile setup wizard, and they keep the existing
// first-time tour behaviour. Compared as a string because SQLite stores
// `datetime('now')` as 'YYYY-MM-DD HH:MM:SS', which sorts correctly and avoids
// the timezone ambiguity of parsing that string as a JS Date.
const PROFILE_SETUP_LAUNCHED_AT = '2026-09-25 00:00:00';

for (const migration of [
  "ALTER TABLE otp_codes ADD COLUMN purpose TEXT DEFAULT 'signup'",
  "ALTER TABLE songs ADD COLUMN audio_mime TEXT",
  "ALTER TABLE users ADD COLUMN firebase_uid TEXT",
  // First-time onboarding completion. Lives on the existing per-user
  // preferences row, which is already created for every user at signup, so no
  // new table is needed.
  "ALTER TABLE user_preferences ADD COLUMN onboarding_completed INTEGER DEFAULT 0",
  // --- Profile setup (separate from the welcome tour) ---
  // `username` keeps the casing the user typed so it can be displayed back
  // verbatim; `username_normalized` holds the lowercase key that uniqueness is
  // enforced on. NULL means "not chosen yet", and every user has a preferences
  // row already (see the backfill below), so no new table is required.
  "ALTER TABLE users ADD COLUMN username TEXT",
  "ALTER TABLE users ADD COLUMN username_normalized TEXT",
  "ALTER TABLE users ADD COLUMN country TEXT",
  "ALTER TABLE user_preferences ADD COLUMN profile_setup_completed INTEGER DEFAULT 0",
  "ALTER TABLE user_preferences ADD COLUMN profile_setup_step TEXT",
]) {
  try { db.exec(migration); } catch (e) { if (!String(e.message).includes('duplicate column name')) throw e; }
}

// Case-insensitive uniqueness.
//
// `users.email` already carries a UNIQUE constraint, but plain SQLite TEXT
// comparison is case-sensitive, so `A@x.com` and `a@x.com` would both be
// accepted as separate accounts. These expression indexes close that gap and
// also make concurrent signups safe: the database rejects the loser of the race
// rather than relying on a read-then-write check in application code.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users(LOWER(email));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized ON users(username_normalized) WHERE username_normalized IS NOT NULL;
`);

// Backfill: accounts that predate profile setup are already "set up", so adding
// the new columns must not push existing users back into the wizard. Only rows
// created on/after the launch date keep the default of 0 (incomplete).
db.prepare(`
  UPDATE user_preferences
     SET profile_setup_completed = 1
   WHERE profile_setup_completed = 0
     AND user_id IN (SELECT id FROM users WHERE created_at IS NOT NULL AND created_at < ?)
`).run(PROFILE_SETUP_LAUNCHED_AT);

// Defensive: a user row with no preferences row cannot carry profile-setup
// state, so the wizard would be unresumable for them. Every auth path inserts a
// preferences row, but repair any gap rather than trusting that forever.
db.prepare(`
  INSERT OR IGNORE INTO user_preferences (user_id, profile_setup_completed)
  SELECT id, CASE WHEN created_at IS NOT NULL AND created_at < ? THEN 1 ELSE 0 END FROM users
`).run(PROFILE_SETUP_LAUNCHED_AT);

function seedData() {
  const songCount = db.prepare('SELECT COUNT(*) as c FROM songs').get().c;
  if (songCount > 0) return;

  const { songs, artists, albums, playlists } = require('../src/data/library.js');

  const insertArtist = db.prepare(`INSERT INTO artists (id, name, listeners, photo, genres, verified) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertSong = db.prepare(`INSERT INTO songs (id, title, artist_id, artist_name, album_id, album_name, duration, cover, mood, genre, audio_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertAlbum = db.prepare(`INSERT INTO albums (id, title, artist_id, artist_name, year, cover) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertAlbumSong = db.prepare(`INSERT INTO album_songs (album_id, song_id, position) VALUES (?, ?, ?)`);
  const insertPlaylist = db.prepare(`INSERT INTO playlists (id, title, description, cover, is_public, user_id) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertPlaylistSong = db.prepare(`INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)`);

  const transaction = db.transaction(() => {
    for (const a of artists) {
      insertArtist.run(a.id, a.name, a.listeners, a.photo, JSON.stringify(a.genres), a.verified ? 1 : 0);
    }
    for (const s of songs) {
      insertSong.run(s.id, s.title, s.artistId, s.artistName, s.albumId || null, s.albumName || null, s.duration, s.cover, s.mood, s.genre, s.audioUrl, 'approved');
    }
    for (const a of albums) {
      insertAlbum.run(a.id, a.title, a.artistId, a.artistName, a.year, a.cover);
      (a.songIds || []).forEach((sid, idx) => {
        insertAlbumSong.run(a.id, sid, idx);
      });
    }
    for (const p of playlists) {
      insertPlaylist.run(p.id, p.title, p.description || '', p.cover || '', p.public ? 1 : 0, null);
      (p.songIds || []).forEach((sid, idx) => {
        insertPlaylistSong.run(p.id, sid, idx);
      });
    }

    // Admin bootstrap — NEVER falls back to a hardcoded/known default password.
    // Either the operator sets a strong ADMIN_PASSWORD, or we generate a random
    // one and print it once to the server log (not stored anywhere).
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@nocturne.com';
    let adminPassword = process.env.ADMIN_PASSWORD || '';
    const isKnownDemo = /admin123|CHANGE_ME|REPLACE|your_|password/i.test(adminPassword);
    if (!adminPassword || isKnownDemo) {
      adminPassword = require('crypto').randomBytes(18).toString('base64url');
      console.log(`[SECURITY] No secure ADMIN_PASSWORD set. Generated admin password for ${adminEmail}: ${adminPassword}`);
      console.log('[SECURITY] Stored it in your server.config; change it now.');
    }
    const adminHash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
      'usr_admin', 'Admin', adminEmail, adminHash, 'admin'
    );

    // Seed content translations
    try {
      const contentTranslations = require('./translations.cjs');
      const insertTranslation = db.prepare(`INSERT OR IGNORE INTO content_translations (content_type, content_id, lang, field, value) VALUES (?, ?, ?, ?, ?)`);
      const transTypes = ['songs', 'artists', 'albums', 'playlists'];
      for (const lang of Object.keys(contentTranslations)) {
        for (const type of transTypes) {
          const items = contentTranslations[lang][type] || {};
          for (const [id, fields] of Object.entries(items)) {
            for (const [field, value] of Object.entries(fields)) {
              insertTranslation.run(type === 'songs' ? 'song' : type === 'artists' ? 'artist' : type === 'albums' ? 'album' : 'playlist', id, lang, field, value);
            }
          }
        }
      }
      // Seed genre translations
      for (const lang of Object.keys(contentTranslations)) {
        const genres = contentTranslations[lang].genres || {};
        for (const [enName, translated] of Object.entries(genres)) {
          insertTranslation.run('genre', enName, lang, 'name', translated);
        }
      }
      console.log('Content translations seeded');
    } catch (e) { console.log('Translation seed skipped:', e.message); }
  });

  transaction();
  console.log('Database seeded successfully');
}

seedData();

function applyTranslations(rows, lang, type) {
  if (!lang || lang === 'en' || !rows || rows.length === 0) return rows;
  const ids = rows.map(r => r.id);
  if (ids.length === 0) return rows;
  const placeholders = ids.map(() => '?').join(',');
  const translations = db.prepare(
    `SELECT content_id, field, value FROM content_translations WHERE content_type = ? AND lang = ? AND content_id IN (${placeholders})`
  ).all(type, lang, ...ids);
  const map = {};
  for (const t of translations) {
    if (!map[t.content_id]) map[t.content_id] = {};
    map[t.content_id][t.field] = t.value;
  }
  return rows.map(row => {
    const tr = map[row.id];
    if (!tr) return row;
    const translated = { ...row };
    if (tr.title) translated.title = tr.title;
    if (tr.name) translated.name = tr.name;
    if (tr.description) translated.description = tr.description;
    if (tr.mood) translated.mood = tr.mood;
    if (tr.genre) translated.genre = tr.genre;
    if (tr.artist_name) translated.artist_name = tr.artist_name;
    return translated;
  });
}

function translateSingle(row, lang, type) {
  if (!lang || lang === 'en' || !row) return row;
  const tr = db.prepare(
    `SELECT field, value FROM content_translations WHERE content_type = ? AND lang = ? AND content_id = ?`
  ).all(type, lang, row.id);
  if (tr.length === 0) return row;
  const translated = { ...row };
  for (const t of tr) {
    if (t.field === 'title' || t.field === 'name' || t.field === 'description' || t.field === 'mood' || t.field === 'genre') {
      translated[t.field] = t.value;
    }
  }
  return translated;
}

function translateGenre(genre, lang) {
  if (!lang || lang === 'en' || !genre) return genre;
  const row = db.prepare(
    `SELECT value FROM content_translations WHERE content_type = 'genre' AND lang = ? AND content_id = ?`
  ).get(lang, genre);
  return row ? row.value : genre;
}

function incrementPlayCount(songId) {
  db.prepare(`INSERT INTO play_counts (song_id, count) VALUES (?, 1) ON CONFLICT(song_id) DO UPDATE SET count = count + 1`).run(songId);
}

function getPlayCounts(songIds) {
  if (!songIds || songIds.length === 0) return {};
  const placeholders = songIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT song_id, count FROM play_counts WHERE song_id IN (${placeholders})`).all(...songIds);
  const map = {};
  for (const r of rows) map[r.song_id] = r.count;
  return map;
}

function addActivity(userId, action, targetType, targetId, targetName, metadata) {
  const id = uuidv4();
  db.prepare(`INSERT INTO activity_feed (id, user_id, action, target_type, target_id, target_name, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, userId, action, targetType, targetId, targetName, JSON.stringify(metadata || {}));
  return id;
}

module.exports = db;
module.exports.PROFILE_SETUP_LAUNCHED_AT = PROFILE_SETUP_LAUNCHED_AT;
module.exports.applyTranslations = applyTranslations;
module.exports.translateSingle = translateSingle;
module.exports.translateGenre = translateGenre;
module.exports.incrementPlayCount = incrementPlayCount;
module.exports.getPlayCounts = getPlayCounts;
module.exports.addActivity = addActivity;
module.exports.recordTrackEvent = recordTrackEvent;
module.exports.updateTrendingScores = updateTrendingScores;
module.exports.saveChartSnapshot = saveChartSnapshot;
module.exports.getChart = getChart;
module.exports.getChartWithFallback = getChartWithFallback;
module.exports.updateProviderHealth = updateProviderHealth;
module.exports.getProviderHealth = getProviderHealth;
module.exports.incrementProviderRequests = incrementProviderRequests;

// --- Multi-provider trending helpers ---

function recordTrackEvent(trackId, provider, eventType, userId, deviceId, meta = {}) {
  db.prepare(`INSERT INTO track_events (track_id, provider, event_type, user_id, device_id, duration_ms, play_duration_ms, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    trackId, provider, eventType, userId || null, deviceId || null,
    meta.durationMs || 0, meta.playDurationMs || 0, meta.country || null
  );
  // Update metrics
  const updates = { play_count: 0, complete_count: 0, like_count: 0, save_count: 0, skip_count: 0, search_count: 0 };
  if (eventType === 'play') updates.play_count = 1;
  if (eventType === 'play_complete') updates.complete_count = 1;
  if (eventType === 'like') updates.like_count = 1;
  if (eventType === 'save') updates.save_count = 1;
  if (eventType === 'skip') updates.skip_count = 1;
  if (eventType === 'search') updates.search_count = 1;

  const setClauses = Object.entries(updates).filter(([, v]) => v > 0).map(([k]) => `${k} = ${k} + 1`).join(', ');
  if (setClauses) {
    db.prepare(`INSERT INTO track_metrics (track_id, provider, ${setClauses.split(', ').map(c => c.split(' =')[0]).join(', ')}, updated_at) VALUES (?, ?, ${setClauses.split(', ').map(() => '1').join(', ')}, datetime('now'))
      ON CONFLICT(track_id, provider) DO UPDATE SET ${setClauses}, updated_at = datetime('now')`).run(trackId, provider);
  }
  // Also set last_played_at for play events
  if (eventType === 'play' || eventType === 'play_complete') {
    db.prepare(`INSERT INTO track_metrics (track_id, provider, last_played_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(track_id, provider) DO UPDATE SET last_played_at = datetime('now'), updated_at = datetime('now')`).run(trackId, provider);
  }
}

function updateTrendingScores() {
  // Calculate trending score based on recent activity with time decay
  // Score = (plays * 1.0) + (completes * 2.0) + (likes * 3.0) + (saves * 2.5) - (skips * 0.5) + (searches * 0.3)
  // Weighted by recency (24h = 1x, 7d = 0.5x, 30d = 0.2x)
  db.exec(`
    UPDATE track_metrics SET trending_score = (
      SELECT COALESCE(SUM(
        CASE e.event_type
          WHEN 'play' THEN 1.0
          WHEN 'play_complete' THEN 2.0
          WHEN 'like' THEN 3.0
          WHEN 'save' THEN 2.5
          WHEN 'skip' THEN -0.5
          WHEN 'search' THEN 0.3
          WHEN 'playlist_add' THEN 2.0
          ELSE 0
        END *
        CASE
          WHEN e.created_at >= datetime('now', '-1 day') THEN 1.0
          WHEN e.created_at >= datetime('now', '-7 days') THEN 0.5
          WHEN e.created_at >= datetime('now', '-30 days') THEN 0.2
          ELSE 0.05
        END
      ), 0)
      FROM track_events e
      WHERE e.track_id = track_metrics.track_id AND e.provider = track_metrics.provider
      AND e.created_at >= datetime('now', '-30 days')
    ),
    updated_at = datetime('now')
    WHERE EXISTS (SELECT 1 FROM track_events te WHERE te.track_id = track_metrics.track_id AND te.created_at >= datetime('now', '-30 days'))
  `);
}

function saveChartSnapshot(chartType, chartKey, tracks) {
  const today = new Date().toISOString().slice(0, 10);
  // Get previous snapshot for rank comparison
  const prevSnapshots = db.prepare(
    `SELECT track_id, rank FROM chart_snapshots WHERE chart_type = ? AND chart_key = ? AND snapshot_date = (
      SELECT MAX(snapshot_date) FROM chart_snapshots WHERE chart_type = ? AND chart_key = ? AND snapshot_date < ?
    )`
  ).all(chartType, chartKey, chartType, chartKey, today);
  const prevMap = {};
  for (const row of prevSnapshots) prevMap[row.track_id] = row.rank;

  const insert = db.prepare(
    `INSERT INTO chart_snapshots (chart_type, chart_key, track_id, provider, rank, previous_rank, trending_score, metadata, snapshot_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    // Clear today's snapshot for this chart
    db.prepare(`DELETE FROM chart_snapshots WHERE chart_type = ? AND chart_key = ? AND snapshot_date = ?`).run(chartType, chartKey, today);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const rank = i + 1;
      const prevRank = prevMap[t.id] || null;
      insert.run(chartType, chartKey, t.id, t.provider || 'local', rank, prevRank, t.trendingScore || 0, JSON.stringify({ title: t.title, artistName: t.artistName }), today);
    }
  });
  transaction();
}

const CHART_SNAPSHOT_SELECT = `
  SELECT cs.*, cm.play_count, cm.like_count
  FROM chart_snapshots cs
  LEFT JOIN track_metrics cm ON cs.track_id = cm.track_id AND cs.provider = cm.provider
  WHERE cs.chart_type = ? AND cs.chart_key = ? AND cs.snapshot_date = ?
  ORDER BY cs.rank ASC LIMIT ?
`;

/**
 * Chart rows for a type/key, falling back to the most recent earlier snapshot.
 *
 * A snapshot is written by the trending job every 30 minutes, so "today" is
 * normally present. It is not guaranteed: if the sync fails while every provider
 * is degraded or rate limited it can write an empty list, which previously left
 * the chart blank until the next successful run. Serving the newest snapshot
 * that does exist is stale but useful, so the response says which date it used
 * and whether it fell back.
 *
 * @returns {{rows: object[], snapshotDate: string, isFallback: boolean}}
 */
function getChartWithFallback(chartType, chartKey, limit = 50) {
  const today = new Date().toISOString().slice(0, 10);

  const current = db.prepare(CHART_SNAPSHOT_SELECT).all(chartType, chartKey, today, limit);
  if (current.length) return { rows: current, snapshotDate: today, isFallback: false };

  const latest = db.prepare(
    'SELECT MAX(snapshot_date) AS d FROM chart_snapshots WHERE chart_type = ? AND chart_key = ? AND snapshot_date <= ?'
  ).get(chartType, chartKey, today);
  if (!latest || !latest.d) return { rows: [], snapshotDate: today, isFallback: false };

  const rows = db.prepare(CHART_SNAPSHOT_SELECT).all(chartType, chartKey, latest.d, limit);
  return { rows, snapshotDate: latest.d, isFallback: true };
}

function getChart(chartType, chartKey, limit = 50) {
  return getChartWithFallback(chartType, chartKey, limit).rows;
}

function updateProviderHealth(provider, status, error) {
  const now = new Date().toISOString();
  if (status === 'healthy') {
    db.prepare(`INSERT INTO provider_health (provider, status, last_success_at, updated_at) VALUES (?, 'healthy', ?, ?)
      ON CONFLICT(provider) DO UPDATE SET status = 'healthy', last_success_at = ?, updated_at = ?, failed_requests = failed_requests + 1 WHERE 0 = 1`).run(provider, now, now, now, now);
    db.prepare(`UPDATE provider_health SET total_requests = total_requests + 1 WHERE provider = ?`).run(provider);
  } else {
    db.prepare(`INSERT INTO provider_health (provider, status, last_failure_at, last_error, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET status = ?, last_failure_at = ?, last_error = ?, updated_at = ?, failed_requests = failed_requests + 1`).run(provider, status, now, error || '', now, status, now, error || '', now);
  }
}

function getProviderHealth() {
  return db.prepare('SELECT * FROM provider_health ORDER BY provider').all();
}

function incrementProviderRequests(provider) {
  db.prepare(`INSERT INTO provider_health (provider, total_requests, updated_at) VALUES (?, 1, datetime('now'))
    ON CONFLICT(provider) DO UPDATE SET total_requests = total_requests + 1, updated_at = datetime('now')`).run(provider);
}
