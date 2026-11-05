/**
 * Trending Engine
 * Syncs provider data, calculates internal trending scores, and maintains chart snapshots.
 */

const db = require('../db.cjs');
const musicService = require('./music-service.cjs');

const SYNC_INTERVAL = (parseInt(process.env.TRENDING_SYNC_INTERVAL) || 30) * 60 * 1000;
let syncTimer = null;

async function syncProviderData() {
  console.log('[Trending] Starting provider sync...');
  const providers = musicService.activeProviders;

  for (const providerInfo of providers) {
    try {
      const provider = require(`./${providerInfo.name}.cjs`);
      const ProviderClass = Object.values(provider).find(v => typeof v === 'function' && v.prototype?.getTrendingTracks);
      if (!ProviderClass) continue;

      const instance = new ProviderClass();
      const start = Date.now();

      // Fetch trending tracks
      const trendingTracks = await instance.getTrendingTracks(50);
      const responseMs = Date.now() - start;

      // Store in metrics
      for (let i = 0; i < trendingTracks.length; i++) {
        const track = trendingTracks[i];
        db.prepare(`INSERT INTO track_metrics (track_id, provider, trending_score, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(track_id, provider) DO UPDATE SET trending_score = ?, updated_at = datetime('now')
        `).run(track.id, track.provider, (50 - i) * 1.0, (50 - i) * 1.0);
      }

      // Update provider health
      db.updateProviderHealth(providerInfo.name, 'healthy');
      db.prepare(`UPDATE provider_health SET last_sync_at = datetime('now'), avg_response_ms = ? WHERE provider = ?`).run(responseMs, providerInfo.name);

      console.log(`[Trending] Synced ${providerInfo.name}: ${trendingTracks.length} tracks (${responseMs}ms)`);
    } catch (e) {
      console.error(`[Trending] Sync failed for ${providerInfo.name}:`, e.message);
      db.updateProviderHealth(providerInfo.name, 'failed', e.message);
    }
  }

  // Update internal trending scores
  try {
    db.updateTrendingScores();
    console.log('[Trending] Updated trending scores');
  } catch (e) {
    console.error('[Trending] Score update failed:', e.message);
  }

  // Generate chart snapshots
  try {
    await generateChartSnapshots();
    console.log('[Trending] Generated chart snapshots');
  } catch (e) {
    console.error('[Trending] Chart snapshot failed:', e.message);
  }

  console.log('[Trending] Sync complete');
}

async function generateChartSnapshots() {
  // Global Top 50
  const globalTop = await musicService.getTrendingTracks(50);
  db.saveChartSnapshot('global', 'top50', globalTop.map((t, i) => ({
    ...t, trendingScore: (50 - i) * 1.0,
  })));

  // Internal trending from DB
  const internalTrending = db.prepare(`
    SELECT track_id as id, provider, trending_score as trendingScore
    FROM track_metrics WHERE trending_score > 0
    ORDER BY trending_score DESC LIMIT 50
  `).all();
  if (internalTrending.length > 0) {
    db.saveChartSnapshot('internal', 'rising', internalTrending);
  }

  // Country charts for top countries
  const countries = ['NG', 'US', 'GB', 'ZA', 'KE'];
  for (const country of countries) {
    try {
      const tracks = await musicService.getTracksByCountry(country, 50);
      db.saveChartSnapshot('country', country, tracks.map((t, i) => ({
        ...t, trendingScore: (50 - i) * 1.0,
      })));
    } catch (e) {
      console.error(`[Trending] Country chart ${country} failed:`, e.message);
    }
  }
}

function recordEvent(trackId, provider, eventType, userId, deviceId, meta = {}) {
  db.recordTrackEvent(trackId, provider, eventType, userId, deviceId, meta);
}

function startAutoSync() {
  if (syncTimer) return;
  console.log(`[Trending] Auto-sync started (interval: ${SYNC_INTERVAL / 1000}s)`);
  // Run initial sync after 5 seconds
  setTimeout(() => syncProviderData().catch(console.error), 5000);
  syncTimer = setInterval(() => syncProviderData().catch(console.error), SYNC_INTERVAL);
}

function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[Trending] Auto-sync stopped');
  }
}

function getCacheSize() {
  try {
    const count = db.prepare("SELECT COUNT(*) as c FROM catalog_cache").get();
    return count ? count.c : 0;
  } catch { return 0; }
}

module.exports = {
  syncProviderData,
  generateChartSnapshots,
  recordEvent,
  startAutoSync,
  stopAutoSync,
  getCacheSize,
};
