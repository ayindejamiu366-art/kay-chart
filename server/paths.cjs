// Single source of truth for where the server keeps its data.
//
// By default (local dev) everything stays where it always was:
//   server/nocturne.db   and   server/uploads/
//
// In production on Render the app's own filesystem is wiped on every deploy and
// restart, so point DATA_DIR at a persistent disk mount (e.g. /var/data) and the
// database and all uploads live there instead:
//   $DATA_DIR/nocturne.db   and   $DATA_DIR/uploads/
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname);

const DB_PATH = path.join(DATA_DIR, 'nocturne.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const COVER_DIR = path.join(UPLOADS_DIR, 'covers');
const AVATAR_DIR = path.join(UPLOADS_DIR, 'avatars');

for (const dir of [DATA_DIR, UPLOADS_DIR, AUDIO_DIR, COVER_DIR, AVATAR_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = { DATA_DIR, DB_PATH, UPLOADS_DIR, AUDIO_DIR, COVER_DIR, AVATAR_DIR };
