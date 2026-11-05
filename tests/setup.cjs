const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!';
}
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  let dbReady = false;
  try {
    const db = require('../server/db.cjs');
    db.prepare('SELECT 1').get();
    dbReady = true;
  } catch (e) {
    console.error('[Test] DB init failed:', e.message);
  }

  const routeModules = [
    ['/api/auth', '../server/routes/auth.cjs'],
    ['/api/songs', '../server/routes/songs.cjs'],
    ['/api/playlists', '../server/routes/playlists.cjs'],
    ['/api/library', '../server/routes/library.cjs'],
    ['/api/albums', '../server/routes/albums.cjs'],
    ['/api/artists', '../server/routes/artists.cjs'],
    ['/api/social', '../server/routes/social.cjs'],
    ['/api/analytics', '../server/routes/analytics.cjs'],
    ['/api/spotify', '../server/routes/spotify.cjs'],
    ['/api/audius', '../server/routes/audius.cjs'],
    ['/api/deezer', '../server/routes/deezer.cjs'],
    ['/api/youtube', '../server/routes/youtube.cjs'],
    ['/api/stream', '../server/routes/stream.cjs'],
    ['/api/translate', '../server/routes/translate.cjs'],
    ['/api/music', '../server/routes/music.cjs'],
    ['/api/charts', '../server/routes/charts.cjs'],
    ['/api/events', '../server/routes/events.cjs'],
  ];

  for (const [mountPath, modulePath] of routeModules) {
    try {
      app.use(mountPath, require(modulePath));
    } catch (e) {
      console.error(`[Test] Failed to load ${mountPath}: ${e.message}`);
    }
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', test: true });
  });

  return { app, dbReady };
}

module.exports = { createApp };
