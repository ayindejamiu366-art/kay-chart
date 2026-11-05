const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const helmet = require('helmet');
const { generalLimiter } = require('./middleware/rateLimit.cjs');
const app = express();
const PORT = process.env.PORT || 3001;

// Global error handlers — prevent uncaught crashes
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection:', reason?.message || reason);
});

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3001,capacitor://localhost,http://localhost')
  .split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
app.use(generalLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Initialize Database (auto) ---
let dbReady = false;
try {
  const db = require('./db.cjs');
  db.prepare('SELECT 1').get();
  dbReady = true;
  console.log('[Database] SQLite initialized');
} catch (e) {
  console.error('[Database] Init failed:', e.message);
}

// --- Load Routes (gracefully skip broken ones) ---
const routeModules = [
  ['/api/auth', './routes/auth.cjs'],
  ['/api/celebrations', './routes/celebrations.cjs'],
  ['/api/profile', './routes/profile.cjs'],
  ['/api/songs', './routes/songs.cjs'],
  ['/api/playlists', './routes/playlists.cjs'],
  ['/api/library', './routes/library.cjs'],
  ['/api/albums', './routes/albums.cjs'],
  ['/api/artists', './routes/artists.cjs'],
  ['/api/social', './routes/social.cjs'],
  ['/api/analytics', './routes/analytics.cjs'],
  ['/api/spotify', './routes/spotify.cjs'],
  ['/api/audius', './routes/audius.cjs'],
  ['/api/deezer', './routes/deezer.cjs'],
  ['/api/youtube', './routes/youtube.cjs'],
  ['/api/stream', './routes/stream.cjs'],
  ['/api/translate', './routes/translate.cjs'],
  ['/api/music', './routes/music.cjs'],
  ['/api/charts', './routes/charts.cjs'],
  ['/api/real-chart', './routes/real-chart.cjs'],
  ['/api/events', './routes/events.cjs'],
  ['/api/lyrics', './routes/lyrics.cjs'],
];

for (const [mountPath, modulePath] of routeModules) {
  try {
    app.use(mountPath, require(modulePath));
  } catch (e) {
    console.error(`[Routes] Failed to load ${mountPath}: ${e.message}`);
  }
}

// --- Health Endpoint ---
app.get('/api/health', async (req, res) => {
  const db = require('./db.cjs');
  const musicService = require('./providers/music-service.cjs');
  const health = {
    status: 'ok',
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: { status: dbReady ? 'ok' : 'error' },
    music: { providers: [], activeCount: 0, totalCount: 0 },
    cache: { entries: 0 },
  };

  if (!dbReady) {
    health.status = 'degraded';
    health.database.error = 'Database failed to initialize';
  }

  try {
    health.database.path = db.name || 'better-sqlite3';
  } catch {}

  try {
    const providers = musicService.activeProviders || [];
    for (const p of providers) {
      health.music.providers.push({
        name: p.name,
        healthy: p.healthy !== false,
        supportsFullTracks: p.supportsFullTracks,
        supportsPreview: p.supportsPreview,
        lastError: p.lastError || null,
      });
    }
    health.music.activeCount = providers.filter(p => p.healthy !== false).length;
    health.music.totalCount = providers.length;
  } catch (e) {
    health.music.error = e.message;
    health.status = 'degraded';
  }

  try {
    const trending = require('./providers/trending.cjs');
    health.cache.entries = trending.getCacheSize ? trending.getCacheSize() : 0;
  } catch {}

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// --- Provider Capabilities Dashboard ---
app.get('/api/providers', (req, res) => {
  const musicService = require('./providers/music-service.cjs');
  const providers = musicService.activeProviders || [];

  const capabilities = providers.map(p => {
    const caps = Array.isArray(p.capabilities) ? p.capabilities : [];
    return {
      name: p.name,
      healthy: p.healthy !== false,
      capabilities: {
        catalog: true,
        search: caps.includes('search') || typeof p.searchTracks === 'function',
        charts: caps.includes('charts') || typeof p.getCharts === 'function',
        fullPlayback: p.supportsFullTracks || false,
        preview: p.supportsPreview !== false,
        external: caps.includes('external_playback') || false,
      },
      playbackType: p.supportsFullTracks ? 'full' : (p.supportsPreview ? 'preview' : 'external'),
      lastError: p.lastError || null,
      lastChecked: new Date().toISOString(),
    };
  });

  res.json({
    providers: capabilities,
    summary: {
      total: capabilities.length,
      healthy: capabilities.filter(p => p.healthy).length,
      fullPlayback: capabilities.filter(p => p.capabilities.fullPlayback).length,
      previewOnly: capabilities.filter(p => !p.capabilities.fullPlayback && p.capabilities.preview).length,
    },
  });
});

// --- Production static serving ---
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Graceful Shutdown ---
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  Kay Chart Server');
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  if (fs.existsSync(DIST_DIR)) console.log('  Frontend: serving from dist/');
  console.log('========================================');

  // Start trending auto-sync
  try {
    const trending = require('./providers/trending.cjs');
    trending.startAutoSync();
  } catch (e) {
    console.error('[Trending] Failed to start auto-sync:', e.message);
  }
});
