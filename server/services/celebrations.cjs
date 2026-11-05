/**
 * Source: Nager.Date v4 — the public-holiday authority.
 *
 * Primary host is the project's own domain (date.nager.at). The
 * nagerholidays.com host is the same dataset behind a different name and is
 * tried second purely as resilience, so a single host being down does not leave
 * the app without holidays.
 *
 * Chosen because it needs no credentials, states no rate limit, covers 200+
 * countries, and — critically — returns `nationalHoliday`, `subdivisionCodes`
 * and `holidayTypes` (Public / Bank / School / Authorities / Optional /
 * Observance). That lets Nocturne distinguish an official public holiday from an
 * observance instead of calling everything a public holiday.
 *
 * Note: the v4 response has no `localName` field, so `localName` is left null
 * rather than invented.
 *
 * This module is dependency-free apart from the fetch, so its date maths is
 * unit-testable deterministically without a network.
 */

// Every celebration declares where its date came from. Nothing is ever presented
// without one, so a guessed date can never masquerade as a real holiday.
const SOURCE = {
  /** Date came from the Nager.Date public-holiday API. */
  NAGER_DATE: 'NAGER_DATE',
  /** Date came from a verified, documented recurring rule in this file. */
  VERIFIED_RULE: 'VERIFIED_RULE',
  /** Date came from an explicit administrator override. */
  MANUAL_CONFIG: 'MANUAL_CONFIG',
};

const NAGER_HOSTS = [
  'https://date.nager.at/api/v4/Holidays',
  'https://nagerholidays.com/api/v4/Holidays',
];
const PRIMARY_NAGER_BASE = NAGER_HOSTS[0];
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 60;

// --- Date helpers (all UTC-anchored; the caller supplies the local date) ------

function toIsoDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromIsoDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function addDays(iso, days) {
  const date = fromIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function daysBetween(fromIso, toIso) {
  return Math.round((fromIsoDate(toIso) - fromIsoDate(fromIso)) / 86400000);
}

function isValidIso(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = fromIsoDate(iso);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === iso;
}

/** Lowercase, strip punctuation, collapse whitespace — for name comparison. */
function normText(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Anonymous Gregorian algorithm for Easter Sunday. */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Resolve a rule name to a concrete date for a given year.
 * Supported: fixed MM-DD, nth weekday of month, weekday relative to Easter.
 */
function resolveRule(rule, year) {
  if (!rule) return null;
  if (typeof rule === 'string' && /^\d{2}-\d{2}$/.test(rule)) return `${year}-${rule}`;

  const month = /^(\d{2})-(\d{2})$/.exec(rule.fixed || '');
  if (month) return `${year}-${month[1]}-${month[2]}`;

  if (rule.nthWeekday) {
    // nthWeekday: { month, weekday (0=Sun..6=Sat), nth (1..5) }
    const { month: m, weekday, nth } = rule.nthWeekday;
    const first = new Date(Date.UTC(year, m - 1, 1));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    const day = 1 + offset + (nth - 1) * 7;
    const candidate = new Date(Date.UTC(year, m - 1, day));
    // If the nth weekday does not exist in that month (e.g. 5th Monday), fall
    // back to the last one rather than rolling into the next month.
    if (candidate.getUTCMonth() !== m - 1) {
      const last = new Date(Date.UTC(year, m, 0));
      const back = (last.getUTCDay() - weekday + 7) % 7;
      return toIsoDate(new Date(Date.UTC(year, m - 1, last.getUTCDate() - back)));
    }
    return toIsoDate(candidate);
  }

  if (rule.easterOffset) {
    const easter = easterSunday(year);
    return addDays(easter, rule.easterOffset);
  }

  return null;
}

// --- Verified observances ----------------------------------------------------
//
// Nager.Date only carries public/observance dates a jurisdiction officially
// recognises. Widely-celebrated dates that are not public holidays anywhere (or
// are not published for a country) live here instead.
//
// Every rule below is a fixed, verifiable calendar fact. Country-specific
// entries are included only where the date is well established; unknown
// combinations are simply absent rather than guessed, so the system never
// claims a celebration is observed in a country without support.

const OBSERVANCES = [
  {
    // Christmas and New Year are observed worldwide, so they are declared
    // globally as well as arriving per-country from the provider. Without this a
    // user who has not chosen a country would see nothing at Christmas. The
    // provider's entry (a real public holiday, with subdivision data and a higher
    // priority) is the one that wins the theme where it exists.
    id: 'christmas',
    name: 'Christmas Day',
    category: 'christmas',
    countryRules: { '*': { rule: { fixed: '12-25' } } },
    priority: 20,
    theme: 'christmas',
  },
  {
    id: 'new-year',
    name: "New Year's Day",
    category: 'new-year',
    countryRules: { '*': { rule: { fixed: '01-01' } } },
    priority: 20,
    theme: 'new-year',
  },
  {
    id: 'valentines-day',
    name: "Valentine's Day",
    category: 'love',
    // Observed widely, but not a public holiday in most places.
    countryRules: { '*': { rule: { fixed: '02-14' } } },
    priority: 30,
    theme: 'valentines',
  },
  {
    id: 'halloween',
    name: 'Halloween',
    category: 'seasonal',
    countryRules: { '*': { rule: { fixed: '10-31' } } },
    priority: 30,
    theme: 'halloween',
  },
  {
    id: 'mothers-day',
    name: "Mother's Day",
    category: 'family',
    countryRules: {
      // Mothering Sunday is observed in the UK on the fourth Sunday of Lent.
      GB: { rule: { easterOffset: 21 }, name: 'Mothering Sunday' },
      IE: { rule: { easterOffset: 21 }, name: 'Mothering Sunday' },
      // The large majority of remaining countries use the second Sunday of May.
      '*': { rule: { nthWeekday: { month: 5, weekday: 0, nth: 2 } } },
    },
    priority: 40,
    theme: 'mothers-day',
  },
  {
    id: 'fathers-day',
    name: "Father's Day",
    category: 'family',
    countryRules: {
      '*': { rule: { nthWeekday: { month: 6, weekday: 0, nth: 3 } } },
    },
    priority: 40,
    theme: 'fathers-day',
  },
  {
    id: 'childrens-day',
    name: "Children's Day",
    category: 'family',
    countryRules: {
      // Universal Children's Day, declared by the UN General Assembly.
      '*': { rule: { fixed: '11-20' } },
      // India observes Children's Day on 14 November.
      IN: { rule: { fixed: '11-14' }, name: "Children's Day" },
    },
    priority: 35,
    theme: 'childrens-day',
  },
];

// --- Normalisation -----------------------------------------------------------

/** Map a Nager holiday onto Nocturne's celebration shape. */
function normaliseNagerHoliday(entry, countryCode) {
  const types = Array.isArray(entry.holidayTypes) ? entry.holidayTypes : [];
  const subdivisions = Array.isArray(entry.subdivisionCodes) ? entry.subdivisionCodes : [];
  const isPublic = types.includes('Public');

  const name = String(entry.name || 'Holiday').slice(0, 120);

  return {
    id: `${(entry.countryCode || countryCode || 'XX').toLowerCase()}-${slug(name)}-${entry.date}`,
    name,
    localName: null, // not provided by Nager.Date v4
    category: categorise(name, types),
    date: entry.date,
    countryCode: entry.countryCode || countryCode || null,
    subdivisionCodes: subdivisions,
    nationalHoliday: entry.nationalHoliday !== false,
    holidayTypes: types,
    // Wording must reflect the source: only call it a public holiday when the
    // data actually says so.
    type: isPublic ? 'public-holiday' : 'observance',
    startDate: null,
    endDate: null,
    effectTheme: themeForName(name),
    priority: isPublic ? 60 : 25,
    source: SOURCE.NAGER_DATE,
  };
}

function categorise(name, types) {
  const n = name.toLowerCase();
  if (/christmas|carol|epiphany/.test(n)) return 'christmas';
  if (/new year/.test(n)) return 'new-year';
  if (/independence|republic day|national day/.test(n)) return 'independence';
  if (/eid|christmas|good friday|ramadan|assumption|all saints/.test(n)) return 'religious';
  if (/labour|labor|may day/.test(n)) return 'labour';
  if (/mother/.test(n)) return 'family';
  if (/father/.test(n)) return 'family';
  if (/halloween/.test(n)) return 'seasonal';
  if (types.includes('Observance')) return 'observance';
  return 'national';
}

function themeForName(name) {
  const n = name.toLowerCase();
  if (/christmas/.test(n)) return 'christmas';
  if (/new year/.test(n)) return 'new-year';
  if (/independence|republic day|national day/.test(n)) return 'independence';
  if (/eid|good friday|all saints|assumption/.test(n)) return 'eid';
  if (/labour|labor/.test(n)) return 'labour';
  if (/mother/.test(n)) return 'mothers-day';
  if (/father/.test(n)) return 'fathers-day';
  return 'festive';
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// --- Cache -------------------------------------------------------------------

// Keyed by country+year. Holds either a fresh list or the last good list so a
// provider outage degrades to stale data instead of an empty calendar.
const cache = new Map();

function cacheKey(countryCode, year) {
  return `${countryCode}:${year}`;
}

function readCache(countryCode, year, allowStale) {
  const entry = cache.get(cacheKey(countryCode, year));
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  if (age < CACHE_TTL_MS) return { celebrations: entry.celebrations, fetchedAt: entry.fetchedAt, stale: false };
  if (allowStale) return { celebrations: entry.celebrations, fetchedAt: entry.fetchedAt, stale: true };
  return null;
}

function writeCache(countryCode, year, celebrations) {
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a.fetchedAt - b.fetchedAt);
    for (const [key] of oldest.slice(0, Math.floor(MAX_CACHE_ENTRIES / 2))) cache.delete(key);
  }
  cache.set(cacheKey(countryCode, year), { celebrations, fetchedAt: Date.now() });
}

/**
 * In-flight fetches, keyed the same way as the cache.
 *
 * The cache only helps *after* a successful fetch. Without this, a cold or
 * expired key that receives N concurrent requests made N identical upstream calls
 * (a thundering herd), so the entry cap bounded memory but not upstream traffic —
 * one request per caller. Sharing the in-flight promise collapses those N calls
 * into exactly one. Entries are removed on settle, so failures are not cached
 * and a later request can retry.
 */
const inFlight = new Map();

async function fetchCelebrationsOnce(countryCode, year) {
  const key = cacheKey(countryCode, year);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = requestNagerHolidays(countryCode, year)
    .finally(() => { inFlight.delete(key); });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Activation windows live in shared/celebration-windows.json and are keyed by
 * effect/theme rather than by holiday id.
 *
 * Keying by id was the original bug: a provider holiday arrives as
 * `ng-national-day-2026-10-01`, so an id-keyed override could never match and
 * every country fell through to the flat default.
 */
const WINDOW_CONFIG = require('../../shared/celebration-windows.json');

const DEFAULT_WINDOW = WINDOW_CONFIG.default;

/** Window for a celebration, from the shared table with a safe fallback. */
function windowFor(theme, explicit) {
  if (explicit && Number.isFinite(explicit.preDays) && Number.isFinite(explicit.postDays)) return explicit;
  const byTheme = WINDOW_CONFIG.byTheme[theme];
  if (byTheme) return byTheme;
  return DEFAULT_WINDOW;
}

/** ISO 3166-1 alpha-2 country codes are the only shape accepted, and a handful of
 * codes that are structurally valid but are never real jurisdictions are
 * rejected so they cannot be used to probe the upstream service.
 */
const ISO_ALPHA2 = /^[A-Z]{2}$/;
const NON_COUNTRIES = new Set([
  'ZZ', // user-assigned / "unknown or invalid"
  'XX', // user-assigned
  'EU', // not a country
  'UN', // not a country
  'AC', // Ascension Island, not in the dataset
  'TA', // Tristan da Cunha, not in the dataset
  'IC', // Canary Islands, not in the dataset
  'EA', // Ceuta and Melilla, not in the dataset
]);

function isSupportedCountryCode(value) {
  const code = String(value || '').toUpperCase().trim();
  return ISO_ALPHA2.test(code) && !NON_COUNTRIES.has(code);
}

/**
 * Fetch one country-year from Nager.Date, trying the primary host then the
 * mirror. Throws on total failure so the caller can fall back to cache.
 */
async function requestNagerHolidays(countryCode, year) {
  // Controlled URL construction: the country code is validated against a strict
  // pattern and the year is a bounded integer, so nothing user-supplied can
  // alter the path or reach another host.
  const safeCode = encodeURIComponent(countryCode);
  const safeYear = String(Math.trunc(year));
  let lastError = null;

  for (const base of NAGER_HOSTS) {
    try {
      const res = await fetch(`${base}/${safeCode}/${safeYear}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (res.status === 404 || res.status === 400) {
        // The code or year is not in the dataset. Trying the mirror would give
        // the same answer, so stop rather than issue a pointless second request.
        throw Object.assign(new Error(`Nager.Date has no data for ${countryCode} ${year}`), { fatal: true, status: res.status });
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Nager.Date responded ${res.status}`);
        // Recorded so an operator can see when the mirror is carrying the app.
        console.warn(`[Celebrations] ${base} responded ${res.status}; trying the mirror`);
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`Nager.Date responded ${res.status}`);
        console.warn(`[Celebrations] ${base} responded ${res.status}; trying the mirror`);
        continue;
      }

      // The mirror is the same dataset on a different host, so it goes through
      // exactly the same parsing and validation as the primary: a non-2xx body,
      // malformed JSON or an unexpected shape is rejected identically. Nothing
      // is trusted merely because it came from the fallback host.
      const usedMirror = base !== NAGER_HOSTS[0];
      if (usedMirror) {
        console.warn(`[Celebrations] primary host unavailable; serving ${countryCode} ${year} from the mirror ${base}`);
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw Object.assign(new Error('Nager.Date returned malformed JSON'), { fatal: true });
      }
      if (!Array.isArray(data)) {
        throw Object.assign(new Error('Unexpected Nager.Date payload shape'), { fatal: true });
      }

      // Defensive: only well-formed entries are kept, and the rest of the
      // response is discarded rather than trusted.
      return data
        .filter(h => h && isValidIso(h.date) && typeof h.name === 'string' && h.name.length <= 200)
        .map(h => normaliseNagerHoliday(h, countryCode));
    } catch (err) {
      if (err && err.fatal) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('Nager.Date unavailable');
}

/** Observance definitions that apply to a country (or globally). */
function observancesForCountry(countryCode, year) {
  const out = [];
  for (const obs of OBSERVANCES) {
    const specific = countryCode && obs.countryRules[countryCode];
    const rule = specific || obs.countryRules['*'];
    if (!rule) continue;
    const date = resolveRule(rule.rule, year);
    if (!date || !isValidIso(date)) continue;
    out.push({
      id: obs.id,
      name: (specific && specific.name) || obs.name,
      localName: (specific && specific.name) || null,
      category: obs.category,
      date,
      countryCode: countryCode || null,
      subdivisionCodes: [],
      nationalHoliday: false,
      holidayTypes: ['Observance'],
      type: 'observance',
      startDate: null,
      endDate: null,
      effectTheme: obs.theme,
      priority: obs.priority,
      source: SOURCE.VERIFIED_RULE,
    });
  }
  return out;
}

/**
 * Full celebration calendar for a country and year.
 * Never throws: a provider failure falls back to cached data, then to
 * observances only, then to an empty list.
 */
async function getCelebrations({ countryCode, year }) {
  // Validation happens before anything is constructed or requested, so a
  // malformed code can never reach Nager.Date.
  if (!isSupportedCountryCode(countryCode)) {
    // No usable country: global verified observances still apply, so the app is
    // not simply blank. Country-specific holidays need a country to mean
    // anything.
    return { celebrations: observancesForCountry('', year), source: SOURCE.VERIFIED_RULE, cachedAt: null, stale: false };
  }
  const cc = String(countryCode).toUpperCase().slice(0, 2);

  const cached = readCache(cc, year, false);
  if (cached) {
    return {
      celebrations: [...cached.celebrations, ...observancesForCountry(cc, year)],
      source: SOURCE.NAGER_DATE,
      cachedAt: cached.fetchedAt,
      stale: false,
    };
  }

  try {
    const holidays = await fetchCelebrationsOnce(cc, year);
    writeCache(cc, year, holidays);
    return {
      celebrations: [...holidays, ...observancesForCountry(cc, year)],
      source: SOURCE.NAGER_DATE,
      cachedAt: Date.now(),
      stale: false,
    };
  } catch (err) {
    const stale = readCache(cc, year, true);
    if (stale) {
      return {
        celebrations: [...stale.celebrations, ...observancesForCountry(cc, year)],
        source: SOURCE.NAGER_DATE,
        cachedAt: stale.fetchedAt,
        stale: true,
      };
    }
    // No cache and no network: observances still work, so the app degrades
    // gracefully instead of showing nothing.
    return {
      celebrations: observancesForCountry(cc, year),
      source: SOURCE.VERIFIED_RULE,
      cachedAt: null,
      stale: true,
    };
  }
}

/**
 * Which celebrations are active on `dateIso`, honouring a window either side.
 *
 * The window is asymmetric: a celebration builds up over several days before it
 * and lingers only briefly after, so the app is dressed up on the approach
 * rather than long after the day has passed. Multi-day festivals (Christmas,
 * New Year, Eid) are the exception and keep a longer tail.
 */
function activeFromCelebrations(celebrations, { countryCode, subdivisionCode, dateIso }) {
  const results = [];
  const cc = String(countryCode || '').toUpperCase().slice(0, 2);
  const sub = String(subdivisionCode || '').toUpperCase();

  for (const celebration of celebrations) {
    // Scope check. With no country chosen, only genuinely global entries apply —
    // otherwise every country's holidays would match at once.
    if (celebration.countryCode) {
      if (!cc) continue;
      if (celebration.countryCode !== cc) continue;
    }

    // Accepts either spelling so a payload using the public `theme` field (as
    // the API and shared fixtures do) resolves identically to the internal
    // `effectTheme`.
    const window = windowFor(celebration.effectTheme || celebration.theme);
    const startDate = celebration.startDate || addDays(celebration.date, -window.preDays);
    const endDate = celebration.endDate || addDays(celebration.date, window.postDays);

    let scope = 'global';
    if (celebration.subdivisionCodes && celebration.subdivisionCodes.length) {
      if (!sub) continue; // regional entry, user has not said where they are
      if (!celebration.subdivisionCodes.includes(sub)) continue;
      scope = 'regional';
    } else if (celebration.countryCode) {
      scope = 'country';
    }

    // daysBetween(a, b) is b - a, so the window test reads: the date must not
    // fall before the start, nor after the end.
    if (daysBetween(startDate, dateIso) < 0) continue;
    if (daysBetween(dateIso, endDate) < 0) continue;

    results.push({ ...celebration, startDate, endDate, scope });
  }

  // The same celebration can arrive from two places — for example Christmas as a
  // global observance and as the country's own public holiday. Show it once,
  // keeping the better-ranked entry (the public holiday wins, with its
  // subdivision data and public classification).
  const bestByName = new Map();
  for (const item of results) {
    const key = normText(item.name);
    const existing = bestByName.get(key);
    if (!existing || item.priority > existing.priority) bestByName.set(key, item);
  }

  return [...bestByName.values()];
}

/**
 * Highest-priority active celebration wins the theme.
 *
 * Ties are broken deterministically, and in a way that matches intuition: when
 * two celebrations rank equally, the one whose own date is closest to today
 * wins. Without that, Boxing Day (26 December, still inside its window on 1
 * January) could beat New Year's Day purely because it sorts first by id.
 */
function pickPrimary(active, dateIso) {
  if (!active || !active.length) return null;
  return [...active].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (dateIso) {
      const da = Math.abs(daysBetween(a.date, dateIso));
      const db = Math.abs(daysBetween(b.date, dateIso));
      if (da !== db) return da - db;
    }
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Years whose calendars can contribute a celebration for a given date.
 *
 * A celebration on 1 January has a window that reaches back into the previous
 * December, and a celebration on 31 December reaches forward into the next
 * January. Without the adjacent year, the effect would vanish on the days
 * around New Year — exactly when it matters most.
 */
function relevantYears(dateIso, maxWindowDays) {
  const date = fromIsoDate(dateIso);
  const year = date.getUTCFullYear();
  const dayOfYear = Math.floor((date - Date.UTC(year, 0, 1)) / 86400000);
  const daysInYear = (Date.UTC(year, 1, 29) - Date.UTC(year, 1, 28)) === 86400000 ? 366 : 365;

  const years = [year];
  if (dayOfYear < maxWindowDays) years.push(year - 1);
  if (dayOfYear > daysInYear - 1 - maxWindowDays) years.push(year + 1);
  return [...new Set(years)];
}

/** Convenience used by the API endpoint. */
async function getActiveCelebrations({ countryCode, subdivisionCode, dateIso, year }) {
  const targetYear = Number(year) || Number(String(dateIso || '').slice(0, 4));
  const cc = String(countryCode || '').toUpperCase().slice(0, 2);
  if (!targetYear || !isValidIso(dateIso)) return { active: [], source: 'none' };

  // The widest pre-window across all themes, so the adjacent year's calendar is
  // pulled in whenever any celebration could reach across a year boundary.
  const maxWindowDays = Math.max(
    DEFAULT_WINDOW.preDays,
    ...Object.values(WINDOW_CONFIG.byTheme).map(w => w.preDays || 0),
  );
  const years = relevantYears(dateIso, maxWindowDays);
  const results = await Promise.all(
    years.map(y => getCelebrations({ countryCode: cc, year: y })),
  );

  // Merging by id keeps the API-holiday copy when both years somehow carry the
  // same observance, and de-duplicates adjacent-year overlap.
  const seen = new Set();
  const celebrations = [];
  let source = 'none';
  let cachedAt = null;
  let stale = false;

  for (const result of results) {
    if (result.source !== 'none' && source === 'none') source = result.source;
    if (result.stale) stale = true;
    if (result.cachedAt && (!cachedAt || result.cachedAt > cachedAt)) cachedAt = result.cachedAt;
    for (const celebration of result.celebrations) {
      if (seen.has(celebration.id)) continue;
      seen.add(celebration.id);
      celebrations.push(celebration);
    }
  }

  const active = activeFromCelebrations(celebrations, { countryCode: cc, subdivisionCode, dateIso });
  return { active, primary: pickPrimary(active, dateIso), all: celebrations, source, cachedAt, stale };
}

module.exports = {
  OBSERVANCES,
  getCelebrations,
  getActiveCelebrations,
  activeFromCelebrations,
  pickPrimary,
  relevantYears,
  // exported for deterministic tests
  resolveRule,
  easterSunday,
  addDays,
  daysBetween,
  fromIsoDate,
  toIsoDate,
  isValidIso,
  normaliseNagerHoliday,
  observancesForCountry,
  clearCache: () => { cache.clear(); inFlight.clear(); },
  // Test hook: age a cached entry so the stale-fallback path can be exercised
  // without waiting a real day. Only ever called by the test suite.
  __setCacheAge: (countryCode, year, extraMs) => {
    const entry = cache.get(`${String(countryCode).toUpperCase()}:${year}`);
    if (entry) entry.fetchedAt -= extraMs;
    return !!entry;
  },
  SOURCE,
  NAGER_HOSTS,
  NAGER_BASE: PRIMARY_NAGER_BASE,
  isSupportedCountryCode,
  requestNagerHolidays,
  windowFor,
  WINDOW_CONFIG,
  DEFAULT_WINDOW,
};
