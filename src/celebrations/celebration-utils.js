/**
 * Celebration date utilities.
 *
 * Kept pure and dependency-free so the same logic can be unit tested with an
 * explicit date, with no dependency on the clock or the network.
 */

const pad = (n) => String(n).padStart(2, '0');

/** The caller's local calendar date as YYYY-MM-DD. Never UTC. */
export function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidIso(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

/** Parse YYYY-MM-DD as a *local* date. Using UTC here would shift the day. */
export function parseIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso, days) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso, toIso) {
  const msPerDay = 86400000;
  return Math.round((parseIso(toIso) - parseIso(fromIso)) / msPerDay);
}

export function normText(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Which years can contribute a celebration for a date.
 *
 * New Year's Day has a window reaching back into the previous December, so
 * without the neighbouring year the celebration would blink out exactly when it
 * matters.
 */
export function relevantYears(dateIso, maxWindowDays) {
  const date = parseIso(dateIso);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);
  const dayOfYear = Math.round((date - startOfYear) / 86400000);
  const daysInYear = Math.round((endOfYear - startOfYear) / 86400000);

  const years = [year];
  if (dayOfYear < maxWindowDays) years.push(year - 1);
  if (dayOfYear > daysInYear - maxWindowDays) years.push(year + 1);
  return [...new Set(years)];
}

/**
 * Wording that follows the source data rather than assuming a public holiday.
 *
 * The more specific classifications are checked first: a Bank or School holiday
 * is a real holiday, but describing it as a generic "is here" would overstate it
 * exactly as calling an observance a public holiday would.
 */
export function describeCelebration(celebration) {
  if (!celebration) return '';
  const name = celebration.name || 'this occasion';
  const types = celebration.holidayTypes || [];
  if (types.includes('Bank')) return `${name} — bank holiday`;
  if (types.includes('School')) return `${name} — school holiday`;
  if (types.includes('Authorities')) return `${name} — authorities holiday`;
  if (celebration.type === 'public-holiday') return `${name} is here`;
  return `Celebrating ${name}`;
}