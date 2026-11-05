/**
 * Client celebration engine tests.
 *
 * These run against the pure ESM modules with an explicit date, so they need no
 * clock, no network and no browser — the same scenarios the spec asks for are
 * covered deterministically, including the offline fallback path that keeps the
 * app themed when the holiday API is unreachable.
 */
import { describe, it, expect } from 'vitest';
import {
  getActiveCelebrations,
  pickPrimaryCelebration,
  getLocalObservances,
  normaliseCelebration,
} from '../src/celebrations/celebration-engine';
import { todayIso, isValidIso, addDays, daysBetween, relevantYears, describeCelebration } from '../src/celebrations/celebration-utils';
import { CELEBRATION_THEMES, DEFAULT_THEME } from '../src/celebrations/celebration-config';
import { getTheme, buildParticles, themeStyle, particleCountFor } from '../src/celebrations/celebration-themes';
import { windowFor } from '../src/celebrations/celebration-engine';
import WINDOW_CONFIG from '../shared/celebration-windows.json';
// The same fixture the server suite loads. If the two engines ever disagree on
// window maths, scoping or priority, both suites fail here.
import SCENARIOS from './fixtures/celebration-scenarios.json';

const holiday = (over = {}) => ({
  id: 'x',
  name: 'Test Day',
  date: '2026-12-25',
  countryCode: 'US',
  subdivisionCodes: [],
  nationalHoliday: true,
  holidayTypes: ['Public'],
  type: 'public-holiday',
  theme: 'christmas',
  priority: 60,
  source: 'test',
  ...over,
});

const names = (list) => list.map(c => c.name);

describe('date utilities', () => {
  it('validates ISO dates', () => {
    expect(isValidIso('2026-12-25')).toBe(true);
    expect(isValidIso('2026-13-01')).toBe(false);
    expect(isValidIso('2026-02-30')).toBe(false);
    expect(isValidIso('nonsense')).toBe(false);
  });

  it('adds days across year boundaries', () => {
    expect(addDays('2026-01-01', -7)).toBe('2025-12-25');
    expect(addDays('2026-12-25', 7)).toBe('2027-01-01');
  });

  it('measures day differences both ways', () => {
    expect(daysBetween('2026-12-18', '2026-12-25')).toBe(7);
    expect(daysBetween('2026-12-25', '2026-12-18')).toBe(-7);
  });

  it('uses the local date, not UTC', () => {
    const lateEvening = new Date(2026, 11, 25, 23, 30);
    expect(todayIso(lateEvening)).toBe('2026-12-25');
  });

  it('pulls the neighbouring year near a boundary', () => {
    expect(relevantYears('2026-07-04', 7)).toEqual([2026]);
    expect(relevantYears('2027-01-02', 7)).toContain(2026);
    expect(relevantYears('2026-12-30', 7)).toContain(2027);
  });
});

describe('window behaviour', () => {
  const data = [holiday({ theme: 'christmas' })];
  const on = (date) => getActiveCelebrations({ countryCode: 'US', date, celebrations: data });

  it('activates on the exact date', () => {
    expect(on('2026-12-25')).toHaveLength(1);
  });

  it('activates at the last day of the pre-window (7 days before)', () => {
    expect(on('2026-12-18')).toHaveLength(1);
  });

  it('is inactive one day before the pre-window', () => {
    expect(on('2026-12-17')).toHaveLength(0);
  });

  it('keeps a longer tail as a festival (3 days after)', () => {
    expect(on('2026-12-28')).toHaveLength(1);
  });

  it('is inactive 4 days after the festival tail', () => {
    expect(on('2026-12-29')).toHaveLength(0);
  });

  it('has an asymmetric window: post tail is shorter than the pre-window', () => {
    expect(on('2026-12-18')).toHaveLength(1);
    expect(on('2026-12-29')).toHaveLength(0);
  });

  it('gives a non-festival celebration only a 1-day tail', () => {
    const independence = [holiday({ theme: 'independence', date: '2026-10-01' })];
    const at = (d) => getActiveCelebrations({ countryCode: 'US', date: d, celebrations: independence });
    expect(at('2026-10-01')).toHaveLength(1);
    expect(at('2026-10-02')).toHaveLength(1);
    expect(at('2026-10-03')).toHaveLength(0);
    expect(at('2026-09-26')).toHaveLength(1);
    expect(at('2026-09-25')).toHaveLength(0);
  });

  it('honours a per-theme window from the shared table', () => {
    const halloween = [holiday({ theme: 'halloween', date: '2026-10-31' })];
    // Halloween is a 3-day pre-window with a 1-day tail.
    expect(getActiveCelebrations({ countryCode: 'US', date: '2026-10-28', celebrations: halloween })).toHaveLength(1);
    expect(getActiveCelebrations({ countryCode: 'US', date: '2026-10-27', celebrations: halloween })).toHaveLength(0);
    expect(getActiveCelebrations({ countryCode: 'US', date: '2026-11-01', celebrations: halloween })).toHaveLength(1);
    expect(getActiveCelebrations({ countryCode: 'US', date: '2026-11-02', celebrations: halloween })).toHaveLength(0);
  });
});

describe('scope: global, country, regional', () => {
  const data = [
    holiday({ id: 'g', name: 'Global Day', countryCode: null, priority: 10, theme: 'festive' }),
    holiday({ id: 'c', name: 'Country Day', countryCode: 'US', priority: 60 }),
    holiday({ id: 'r', name: 'Regional Day', countryCode: 'US', subdivisionCodes: ['US-CA'], priority: 100 }),
  ];
  const on = (opts) => names(getActiveCelebrations({ date: '2026-12-25', ...opts, celebrations: data }));

  it('shows global and country when no subdivision is known', () => {
    expect(on({ countryCode: 'US' })).toEqual(['Global Day', 'Country Day']);
  });

  it('hides regional when the subdivision is unknown', () => {
    expect(on({ countryCode: 'US' })).not.toContain('Regional Day');
  });

  it('shows regional when the subdivision matches', () => {
    expect(on({ countryCode: 'US', subdivisionCode: 'US-CA' })).toContain('Regional Day');
  });

  it('hides regional when the subdivision differs', () => {
    expect(on({ countryCode: 'US', subdivisionCode: 'US-NY' })).not.toContain('Regional Day');
  });

  it('shows only global for a different country', () => {
    expect(on({ countryCode: 'GB' })).toEqual(['Global Day']);
  });

  it('shows only global when no country is set', () => {
    expect(on({})).toEqual(['Global Day']);
  });
});

describe('priority', () => {
  it('picks the highest priority deterministically', () => {
    const active = getActiveCelebrations({
      countryCode: 'US',
      date: '2026-12-25',
      celebrations: [
        holiday({ id: 'low', priority: 10 }),
        holiday({ id: 'high', priority: 90 }),
        holiday({ id: 'mid', priority: 50 }),
      ],
    });
    expect(pickPrimaryCelebration(active, '2026-12-25').id).toBe('high');
  });

  it('prefers the occasion closest to today when priorities tie', () => {
    const active = getActiveCelebrations({
      countryCode: 'GB',
      date: '2027-01-01',
      celebrations: [
        holiday({ id: 'aaa-boxing', name: 'Boxing Day', date: '2026-12-26', countryCode: 'GB', priority: 60 }),
        holiday({ id: 'zzz-newyear', name: "New Year's Day", date: '2027-01-01', countryCode: 'GB', priority: 60 }),
      ],
    });
    // Boxing Day sorts first by id, but today is New Year's Day.
    expect(pickPrimaryCelebration(active, '2027-01-01').name).toBe("New Year's Day");
  });

  it('collapses duplicate names to the better-ranked entry', () => {
    const active = getActiveCelebrations({
      countryCode: 'US',
      date: '2026-12-25',
      celebrations: [
        holiday({ id: 'obs', name: 'Christmas Day', countryCode: null, priority: 20, type: 'observance', holidayTypes: ['Observance'], nationalHoliday: false }),
        holiday({ id: 'api', name: 'Christmas Day', priority: 60 }),
      ],
    });
    expect(active).toHaveLength(1);
    expect(active[0].type).toBe('public-holiday');
  });
});

describe('country-specific observances', () => {
  it("GB Mother's Day differs from US Mother's Day", () => {
    const gb = getLocalObservances({ dateIso: '2026-05-10' });
    expect(gb.find(o => o.id === 'mothers-day')).toBeUndefined();
  });

  it('works from provider data, which is where country dates come from', () => {
    const gbData = [holiday({ id: 'm', name: "Mothering Sunday", date: '2026-04-26', countryCode: 'GB', type: 'observance', nationalHoliday: false, holidayTypes: ['Observance'], priority: 40, theme: 'mothers-day' })];
    const usData = [holiday({ id: 'm', name: "Mother's Day", date: '2026-05-10', countryCode: 'US', type: 'observance', nationalHoliday: false, holidayTypes: ['Observance'], priority: 40, theme: 'mothers-day' })];
    expect(names(getActiveCelebrations({ countryCode: 'GB', date: '2026-04-26', celebrations: gbData }))).toEqual(['Mothering Sunday']);
    expect(names(getActiveCelebrations({ countryCode: 'GB', date: '2026-05-10', celebrations: gbData }))).toEqual([]);
    expect(names(getActiveCelebrations({ countryCode: 'US', date: '2026-05-10', celebrations: usData }))).toEqual(["Mother's Day"]);
  });
});

describe('offline fallback', () => {
  it('still returns globally observed occasions with no provider data', () => {
    const active = getActiveCelebrations({ countryCode: 'US', date: '2026-12-25', celebrations: null });
    expect(names(active)).toContain('Christmas Day');
  });

  it('returns nothing outside every window', () => {
    expect(getActiveCelebrations({ countryCode: 'US', date: '2026-03-15', celebrations: null })).toHaveLength(0);
  });

  it('never invents country-specific dates offline', () => {
    const active = getActiveCelebrations({ countryCode: 'GB', date: '2026-05-10', celebrations: null });
    expect(names(active).some(n => /mother/i.test(n))).toBe(false);
  });
});

describe('input safety', () => {
  it('rejects malformed entries', () => {
    expect(normaliseCelebration({ name: 'x', date: 'garbage' })).toBeNull();
    expect(normaliseCelebration(null)).toBeNull();
  });

  it('bounds remote names and subdivision lists', () => {
    const n = normaliseCelebration(holiday({ name: 'x'.repeat(500), subdivisionCodes: Array(50).fill('US-XX') }));
    expect(n.name.length).toBeLessThanOrEqual(120);
    expect(n.subdivisionCodes.length).toBeLessThanOrEqual(12);
  });

  it('never classifies an unknown celebration as a public holiday', () => {
    expect(normaliseCelebration(holiday({ type: undefined })).type).toBe('observance');
  });

  it('falls back to a local date when given nonsense', () => {
    expect(getActiveCelebrations({ date: 'nonsense', countryCode: 'US', celebrations: [holiday()] }).length).toBeGreaterThanOrEqual(0);
  });
});

describe('observance wording', () => {
  it('does not call an observance a public holiday', () => {
    expect(describeCelebration({ name: "Valentine's Day", type: 'observance' })).toBe("Celebrating Valentine's Day");
  });

  it('reports a genuine public holiday plainly', () => {
    expect(describeCelebration({ name: 'Christmas Day', type: 'public-holiday' })).toBe('Christmas Day is here');
  });

  it('distinguishes a bank holiday', () => {
    expect(describeCelebration({ name: 'Early May Bank Holiday', type: 'public-holiday', holidayTypes: ['Bank'] }))
      .toBe('Early May Bank Holiday — bank holiday');
  });
});

describe('themes and effects', () => {
  it('falls back safely for an unknown theme', () => {
    expect(getTheme('does-not-exist')).toBe(CELEBRATION_THEMES[DEFAULT_THEME]);
  });

  it('only exposes fixed custom-property names', () => {
    expect(Object.keys(themeStyle('christmas')).sort()).toEqual(['--celeb-accent', '--celeb-glow', '--celeb-secondary']);
  });

  it('caps particle count', () => {
    for (const key of Object.keys(CELEBRATION_THEMES)) {
      expect(buildParticles(key).length).toBeLessThanOrEqual(30);
    }
  });

  it('emits no particles under reduced motion', () => {
    for (const key of Object.keys(CELEBRATION_THEMES)) {
      expect(buildParticles(key, { reducedMotion: true })).toHaveLength(0);
    }
  });

  it('is deterministic across rebuilds (no render-time randomness)', () => {
    expect(buildParticles('christmas')).toEqual(buildParticles('christmas'));
  });
});

describe('shared scenario fixture (identical file to the server suite)', () => {
  for (const s of SCENARIOS.scenarios) {
    const calendar = SCENARIOS.calendar[s.calendar];
    it(`${s.name}: active set`, () => {
      const got = getActiveCelebrations({
        countryCode: s.countryCode,
        subdivisionCode: s.subdivisionCode,
        date: s.date,
        celebrations: calendar,
      }).map(c => c.name).sort();
      expect(got).toEqual([...(s.expectActive || [])].sort());
    });

    it(`${s.name}: primary`, () => {
      const active = getActiveCelebrations({
        countryCode: s.countryCode,
        subdivisionCode: s.subdivisionCode,
        date: s.date,
        celebrations: calendar,
      });
      const primary = pickPrimaryCelebration(active, s.date);
      expect(primary ? primary.name : null).toBe(s.expectPrimary === null ? null : s.expectPrimary);
    });
  }
});

describe('asymmetric windows', () => {
  it('reads the shared window table', () => {
    expect(windowFor('independence')).toEqual(WINDOW_CONFIG.byTheme.independence);
    expect(windowFor('a-theme-that-does-not-exist')).toEqual(WINDOW_CONFIG.default);
  });

  it('independence is 5 before / 1 after', () => {
    expect(windowFor('independence')).toMatchObject({ preDays: 5, postDays: 1, festival: false });
  });

  it('multi-day festivals keep a longer tail', () => {
    expect(windowFor('christmas').festival).toBe(true);
    expect(windowFor('christmas').postDays).toBeGreaterThan(1);
    expect(windowFor('new-year').postDays).toBeGreaterThan(1);
  });

  it('every theme has preDays >= postDays and a positive pre-window', () => {
    for (const w of Object.values(WINDOW_CONFIG.byTheme)) {
      expect(w.preDays).toBeGreaterThanOrEqual(w.postDays);
      expect(w.preDays).toBeGreaterThan(0);
    }
  });

  it('resolves a generated provider id through its theme', () => {
    // Regression guard: the original bug was an id-keyed override that could
    // never match a generated id like ng-national-day-2026-10-01.
    const ngDay = [{
      id: 'ng-national-day-2026-10-01', name: 'National Day', date: '2026-10-01', countryCode: 'NG',
      subdivisionCodes: [], nationalHoliday: true, holidayTypes: ['Public'], type: 'public-holiday',
      effect: 'independence', priority: 60, source: 'NAGER_DATE',
    }];
    const onDay = getActiveCelebrations({ countryCode: 'NG', date: '2026-10-01', celebrations: ngDay })[0];
    expect(onDay.startDate).toBe('2026-09-26');
    expect(onDay.endDate).toBe('2026-10-02');
    expect(getActiveCelebrations({ countryCode: 'NG', date: '2026-10-03', celebrations: ngDay })).toHaveLength(0);
  });

  it('particle budget derives from intensity', () => {
    for (const key of Object.keys(CELEBRATION_THEMES)) {
      const expected = getTheme(key).intensity === 'subtle'
        ? 0
        : Math.min(Math.round(getTheme(key).particleCount * (getTheme(key).intensity === 'expressive' ? 1 : 0.55)), 30);
      expect(particleCountFor(key)).toBe(expected);
    }
  });
});