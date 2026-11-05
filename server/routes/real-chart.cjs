/**
 * Real Chart Routes
 * Live, internet-sourced charts with measured ranking signals.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/validators.cjs');
const realChart = require('../providers/real-chart.cjs');
const { GoogleTrends } = require('../providers/google-trends.cjs');
const { YouTubeChart } = require('../providers/youtube-chart.cjs');

router.get('/', asyncHandler(async (req, res) => {
  const scope = req.query.scope === 'country' ? 'country' : 'global';
  const country = String(req.query.country || 'US').toUpperCase();
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const include = String(req.query.include || 'deezer,youtube,google')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => ['deezer', 'youtube', 'google'].includes(s));

  const chart = await realChart.build({ scope, country, limit, include });
  res.json(chart);
}));

router.get('/google-trends', asyncHandler(async (req, res) => {
  const country = String(req.query.country || 'US').toUpperCase();
  try {
    const terms = await GoogleTrends.getTrendingTerms(country);
    res.json({ country, count: terms.length, terms });
  } catch (e) {
    res.status(502).json({ country, count: 0, terms: [], error: e.message });
  }
}));

router.get('/sources', asyncHandler(async (req, res) => {
  const [yt, google] = await Promise.all([
    YouTubeChart.healthCheck().catch(e => ({ ok: false, detail: e.message })),
    GoogleTrends.healthCheck().catch(e => ({ ok: false, detail: e.message })),
  ]);
  res.json({
    sources: [
      { key: 'youtube', label: 'YouTube', ...YouTubeChart.getSourceMeta(), health: yt },
      { key: 'google-trends', label: 'Google Trends', ...GoogleTrends.getSourceMeta(), health: google },
    ],
  });
}));

module.exports = router;
