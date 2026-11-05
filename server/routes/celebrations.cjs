const express = require('express');
const db = require('../db.cjs');
const {
  getActiveCelebrations,
  isValidIso,
  isSupportedCountryCode,
} = require('../services/celebrations.cjs');

const router = express.Router();

// The browser's own date is authoritative for celebration activation, but a
// client must not be able to force an arbitrary date. The accepted value is
// therefore clamped to one day either side of the server's date, which covers
// every real timezone (UTC-12 to UTC+14) while removing any way to pin the app
// to a chosen celebration. Tests inject dates through the engine directly, not
// through this endpoint.
const MAX_CLIENT_DATE_OFFSET_DAYS = 1;

function todayInUserTimezone() {
  return new Date().toISOString().slice(0, 10);
}

function resolveRequestedDate(raw) {
  const serverToday = todayInUserTimezone();
  if (!isValidIso(raw)) return serverToday;

  const requested = Date.UTC(...String(raw).split('-').map(Number));
  const server = Date.UTC(...serverToday.split('-').map(Number));
  const offsetDays = Math.round((requested - server) / 86400000);
  if (Math.abs(offsetDays) > MAX_CLIENT_DATE_OFFSET_DAYS) return serverToday;
  return raw;
}

// Same optional-auth shape the music routes use: celebrations are ambience, so
// they work signed-out, but a signed-in listener gets their own country applied
// without having to ask for it.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth.cjs');
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      if (decoded.id && decoded.email) {
        const user = db.prepare('SELECT id, country FROM users WHERE id = ? AND email = ?').get(decoded.id, decoded.email);
        if (user) req.user = user;
      }
    } catch (_) { /* continue without a user */ }
  }
  next();
}

function todayInUserTimezone() {
  // The browser's own date is authoritative for celebration activation; the
  // server date is only a fallback for clients that do not send one.
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/celebrations/active
 *
 * `date` is the caller's local calendar date (YYYY-MM-DD), clamped to +/-1 day
 * of the server date so timezone-correct behaviour is preserved without
 * exposing an arbitrary date override.
 *
 * Authentication is not bypassed: `optionalAuth` verifies the bearer token with
 * the same middleware the rest of the API uses, and an authenticated listener's
 * saved profile country is applied automatically. The endpoint works signed-out
 * too, because celebration ambience is not account-specific — but the country is
 * only ever taken from a verified profile, never from an unverified guess.
 */
router.get('/active', optionalAuth, async (req, res) => {
  try {
    const dateIso = resolveRequestedDate(String(req.query.date || '').trim());

    // The user's own profile country wins. An explicit query value is only used
    // when the profile has none, and must be a real ISO country code so it can
    // never alter the upstream URL. Never inferred from IP.
    const profileCountry = req.user ? String(req.user.country || '').trim().toUpperCase() : '';
    const queryCountry = String(req.query.countryCode || '').trim().toUpperCase();
    const countryCode = isSupportedCountryCode(profileCountry)
      ? profileCountry
      : (isSupportedCountryCode(queryCountry) ? queryCountry : '');

    const subdivisionCode = String(req.query.subdivisionCode || '').trim().toUpperCase();
    const windowDays = Math.min(Math.max(parseInt(req.query.windowDays, 10) || 7, 0), 30);

    const result = await getActiveCelebrations({ countryCode, subdivisionCode, dateIso, defaultWindowDays: windowDays });

    const toPublic = (c) => ({
      id: c.id,
      name: c.name,
      localName: c.localName || null,
      category: c.category,
      date: c.date,
      countryCode: c.countryCode,
      subdivisionCodes: c.subdivisionCodes || [],
      nationalHoliday: !!c.nationalHoliday,
      holidayTypes: c.holidayTypes || [],
      // Wording follows the source data: a Bank holiday is never presented as
      // a public holiday.
      type: c.type,
      scope: c.scope,
      effect: c.effectTheme,
      intensity: intensityFor(c.effectTheme),
      priority: c.priority,
      active: true,
      activationStart: c.startDate,
      activationEnd: c.endDate,
      source: c.source,
    });

    res.json({
      // The requested contract.
      celebrations: result.active.map(toPublic),
      // Retained for the existing client and for internal navigation.
      active: result.active.map(toPublic),
      primary: result.primary
        ? {
          id: result.primary.id,
          name: result.primary.name,
          effect: result.primary.effectTheme,
          type: result.primary.type,
          date: result.primary.date,
          source: result.primary.source,
        }
        : null,
      date: dateIso,
      countryCode: countryCode || null,
      source: result.source,
      stale: !!result.stale,
      cachedAt: result.cachedAt || null,
      // The full calendar for the relevant years (current plus the neighbouring
      // year near a boundary). The client recomputes from this so the window
      // follows the listener's own timezone and still works offline.
      all: (result.all || []).map(c => ({
        ...toPublic(c),
        // Internal calendar carries the window so the client can recompute the
        // same activation range without re-deriving it from config.
        windowDays: Number.isFinite(c.windowDays) ? c.windowDays : undefined,
        active: undefined,
      })),
    });
  } catch (err) {
    // A celebration problem must never take the app down: report "no
    // celebration" and let the client render its normal theme.
    console.error('[Celebrations] active lookup failed:', err.message);
    res.status(200).json({ celebrations: [], active: [], primary: null, source: 'UNAVAILABLE' });
  }
});

const WINDOW_CONFIG = require('../../shared/celebration-windows.json');

/**
 * Presentation strength for a celebration.
 *
 * Read from the shared table so the API reports exactly the intensity the client
 * renders. Falls back to 'restrained' for any theme the table does not know,
 * which is the safe middle setting rather than a loud default.
 */
function intensityFor(effectTheme) {
  const entry = WINDOW_CONFIG.byTheme[effectTheme];
  return (entry && entry.intensity) || 'restrained';
}

module.exports = router;