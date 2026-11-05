/**
 * Client celebration engine.
 *
 * Answers "what is being celebrated right now?" from data only, so it works
 * offline and before the network responds. The date defaults to the browser's
 * local calendar day, which is what actually decides whether a listener should
 * see a celebration — the server's clock can be a whole timezone away.
 *
 * Server-side data (from /api/celebrations/active) is preferred when present;
 * the local fallback below is what keeps the app looking right with no network.
 */

import {
  CELEBRATION_PRIORITY,
  DEFAULT_THEME,
  PRIORITY,
} from './celebration-config';
import WINDOW_CONFIG from '../../shared/celebration-windows.json';
import { todayIso, isValidIso, addDays, daysBetween, normText, relevantYears } from './celebration-utils';

/**
 * Activation windows come from shared/celebration-windows.json — the same file
 * the server service reads. Keyed by theme, not by id, because provider holidays
 * get generated ids like `ng-national-day-2026-10-01`.
 *
 * The window is asymmetric on purpose: a celebration builds up before the day
 * and tails off quickly afterwards, so Nocturne is dressed up on the approach
 * rather than the week after. Multi-day festivals keep a longer tail.
 */
export function windowFor(theme) {
  return WINDOW_CONFIG.byTheme[theme] || WINDOW_CONFIG.default;
}

/**
 * Local fallback observances.
 *
 * These mirror the verified rules in server/services/celebrations.cjs and exist
 * so the app still shows something when the holiday API is unreachable. They
 * are deliberately limited to dates that are unambiguous calendar facts — no
 * invented country-specific dates.
 */
const LOCAL_OBSERVANCES = [
  { id: 'christmas', name: 'Christmas Day', date: { fixed: '12-25' }, windowDays: 7, priority: PRIORITY.globalObservance, theme: 'christmas' },
  { id: 'new-year', name: "New Year's Day", date: { fixed: '01-01' }, windowDays: 5, priority: PRIORITY.globalObservance, theme: 'new-year' },
  { id: 'valentines-day', name: "Valentine's Day", date: { fixed: '02-14' }, windowDays: 3, priority: PRIORITY.observance, theme: 'valentines' },
  { id: 'halloween', name: 'Halloween', date: { fixed: '10-31' }, windowDays: 3, priority: PRIORITY.observance, theme: 'halloween' },
  { id: 'childrens-day', name: "Children's Day", date: { fixed: '11-20' }, windowDays: 2, priority: PRIORITY.observance, theme: 'childrens-day' },
];

function resolveFixedDate(rule, year) {
  const match = /^(\d{2})-(\d{2})$/.exec(rule || '');
  return match ? `${year}-${match[1]}-${match[2]}` : null;
}

/**
 * Observances that apply on a given date, without any network.
 *
 * Every entry here is global. Country-specific dates are never guessed locally —
 * they come from the provider, so an offline listener gets the universally
 * observed occasions and nothing that might be wrong for where they live.
 */
export function getLocalObservances({ dateIso } = {}) {
  const year = Number(String(dateIso).slice(0, 4));
  if (!year) return [];
  return LOCAL_OBSERVANCES
    .map(o => ({ ...o, date: resolveFixedDate(o.date.fixed, year) }))
    .filter(o => o.date && isValidIso(o.date))
    .map(o => ({
      id: o.id,
      name: o.name,
      localName: null,
      category: o.id,
      date: o.date,
      countryCode: null,
      subdivisionCodes: [],
      nationalHoliday: false,
      holidayTypes: ['Observance'],
      type: 'observance',
      startDate: addDays(o.date, -o.windowDays),
      endDate: addDays(o.date, o.windowDays),
      effectTheme: o.theme,
      priority: o.priority,
      scope: 'global',
      source: 'nocturne-observance',
      windowDays: o.windowDays,
    }));
}

/**
 * Normalise anything from the API or the local fallback into the shape the UI
 * expects, filling in windows and priorities from config.
 */
export function normaliseCelebration(raw = {}) {
  if (!raw || !isValidIso(raw.date)) return null;

  const id = String(raw.id || raw.name || 'celebration');
  const theme = raw.effect || raw.theme || raw.effectTheme || DEFAULT_THEME;
  const window = windowFor(theme);

  const priority = Number.isFinite(raw.priority) ? raw.priority
    : (Number.isFinite(CELEBRATION_PRIORITY[id]) ? CELEBRATION_PRIORITY[id] : PRIORITY.global);

  const startDate = raw.activationStart || raw.startDate || addDays(raw.date, -window.preDays);
  const endDate = raw.activationEnd || raw.endDate || addDays(raw.date, window.postDays);

  return {
    id,
    name: String(raw.name || 'Celebration').slice(0, 120),
    localName: raw.localName ? String(raw.localName).slice(0, 120) : null,
    category: raw.category || 'celebration',
    date: raw.date,
    startDate,
    endDate,
    countryCode: raw.countryCode || null,
    subdivisionCodes: Array.isArray(raw.subdivisionCodes) ? raw.subdivisionCodes.slice(0, 12) : [],
    nationalHoliday: !!raw.nationalHoliday,
    holidayTypes: Array.isArray(raw.holidayTypes) ? raw.holidayTypes.slice(0, 6) : [],
    type: raw.type === 'public-holiday' ? 'public-holiday' : 'observance',
    scope: raw.scope || 'global',
    theme,
    priority,
    windowDays: window.postDays,
    preWindowDays: window.preDays,
    postWindowDays: window.postDays,
    isFestival: !!window.festival,
    source: raw.source || 'unknown',
  };
}

/**
 * Core selection logic.
 *
 * @param {object} options
 * @param {string} options.countryCode   User's own selected country.
 * @param {string} [options.subdivisionCode]
 * @param {string} [options.date]        Local calendar date, YYYY-MM-DD.
 * @param {Array}  [options.celebrations] Provider data; local rules are used when absent.
 */
export function getActiveCelebrations({
  countryCode = '',
  subdivisionCode = '',
  date = todayIso(),
  celebrations = null,
} = {}) {
  if (!isValidIso(date)) date = todayIso();

  const cc = String(countryCode || '').toUpperCase().slice(0, 2);
  const sub = String(subdivisionCode || '').toUpperCase();

  // Provider data when we have it, otherwise the local fallback so an offline
  // or slow first load still shows the right atmosphere.
  const source = Array.isArray(celebrations) && celebrations.length
    ? celebrations
    : getLocalObservances({ dateIso: date });

  const results = [];

  for (const raw of source) {
    const celebration = normaliseCelebration(raw);
    if (!celebration) continue;

    // Scope. With no country chosen only global entries apply, otherwise every
    // country's holidays would match at once.
    if (celebration.countryCode) {
      if (!cc || celebration.countryCode !== cc) continue;
    }

    let scope = 'global';
    if (celebration.subdivisionCodes.length) {
      // Regional entries only apply when the listener has told us where they are.
      if (!sub || !celebration.subdivisionCodes.includes(sub)) continue;
      scope = 'regional';
    } else if (celebration.countryCode) {
      scope = 'country';
    }

    if (daysBetween(celebration.startDate, date) < 0) continue;
    if (daysBetween(date, celebration.endDate) < 0) continue;

    results.push({ ...celebration, scope });
  }

  // Collapse duplicates of the same occasion, keeping the better-ranked entry
  // (the public holiday beats the generic observance).
  const best = new Map();
  for (const item of results) {
    const key = normText(item.name);
    const existing = best.get(key);
    if (!existing || item.priority > existing.priority) best.set(key, item);
  }

  return [...best.values()];
}

/**
 * Deterministic primary pick.
 *
 * Priority first; then the celebration whose own date is closest to today, so an
 * older occasion still inside its window (Boxing Day on 1 January) cannot beat
 * the day actually being marked. Ties then fall back to id, so the result never
 * depends on ordering luck.
 */
export function pickPrimaryCelebration(active, date) {
  if (!active || !active.length) return null;
  const today = isValidIso(date) ? date : todayIso();
  return [...active].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const da = Math.abs(daysBetween(a.date, today));
    const db = Math.abs(daysBetween(b.date, today));
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  })[0];
}

/** Convenience: active set plus the primary theme in one call. */
export function resolveCelebrationState(options) {
  const active = getActiveCelebrations(options);
  const date = isValidIso(options?.date) ? options.date : todayIso();
  return { active, primary: pickPrimaryCelebration(active, date) };
}

export { relevantYears };