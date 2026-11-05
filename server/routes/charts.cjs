/**
 * Charts Routes
 *  Trending charts, snapshots, and internal rising tracks.
 *
 * Row resolution is delegated to `chart-resolver`, which applies a per-provider
 * timeout, caps concurrency, serves last-known-good metadata for anything that
 * times out, and returns whatever it managed to assemble. A degraded provider
 * therefore shortens the chart rather than stretching the response to 45s; see
 * that module for the reasoning.
 */

const express = require('express');
const db = require('../db.cjs');
const musicService = require('../providers/music-service.cjs');
const { asyncHandler } = require('../utils/validators.cjs');
const { resolveRows } = require('../utils/chart-resolver.cjs');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const type = req.query.type || 'global';
  const key = req.query.key || 'top50';
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const { rows: chart, snapshotDate, isFallback } = db.getChartWithFallback(type, key, limit);

  const { items, stats } = await resolveRows(chart, {
    trackIdOf: (row) => row.track_id,
    fetchTrack: (id) => musicService.getTrack(id),
    shape: (row, track) => ({
      ...track,
      chartRank: row.rank,
      previousRank: row.previous_rank,
      trendingScore: row.trending_score,
      playCount: row.play_count,
      likeCount: row.like_count,
    }),
  });

  res.json({
    chart_type: type,
    chart_key: key,
    data: items,
    // Which snapshot was served. `stale` means today's run produced no usable
    // snapshot, so an older one is being shown rather than an empty chart.
    snapshot_date: snapshotDate,
    stale: isFallback,
    meta: stats,
  });
}));

router.get('/internal/rising', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const rising = db.prepare(`
    SELECT track_id as id, provider, trending_score as trendingScore, play_count, like_count, save_count
    FROM track_metrics WHERE trending_score > 0
    ORDER BY trending_score DESC LIMIT ?
  `).all(limit);

  const { items, stats } = await resolveRows(rising, {
    trackIdOf: (row) => row.id,
    fetchTrack: (id) => musicService.getTrack(id),
    shape: (row, track) => ({
      ...track,
      trendingScore: row.trendingScore,
      playCount: row.play_count,
      likeCount: row.like_count,
      saveCount: row.save_count,
    }),
  });

  res.json({ data: items, meta: stats });
}));

router.get('/countries', asyncHandler(async (req, res) => {
  const countries = db.prepare("SELECT DISTINCT chart_key FROM chart_snapshots WHERE chart_type = 'country'").all();
  res.json({ data: countries.map(c => c.chart_key) });
}));

module.exports = router;