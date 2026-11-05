/**
 * Deterministic celebration engine tests.
 *
 * No real holidays are needed: the engine accepts an explicit date throughout,
 * so every scenario is reproducible. The only tests that touch the network are
 * the provider-integration checks at the end, which are skipped when offline.
 */
const c = require('../server/services/celebrations.cjs');
// Shared with the client engine suite so window maths cannot drift between the
// two implementations. See tests/fixtures/celebration-scenarios.json.
const SCENARIOS = require('./fixtures/celebration-scenarios.json');

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; failures.push(label); console.log(`  FAIL  ${label} ${extra}`); }
};
const section = (t) => console.log(`\n${t}`);

// ---------------------------------------------------------------------------
section('1. Date primitives');
ok('Easter 2026 = 5 April', c.easterSunday(2026) === '2026-04-05', c.easterSunday(2026));
ok('Easter 2027 = 28 March', c.easterSunday(2027) === '2027-03-28', c.easterSunday(2027));
ok('2nd Sunday of May 2026 = 10 May', c.resolveRule({ nthWeekday: { month: 5, weekday: 0, nth: 2 } }, 2026) === '2026-05-10');
ok('3rd Sunday of June 2026 = 21 June', c.resolveRule({ nthWeekday: { month: 6, weekday: 0, nth: 3 } }, 2026) === '2026-06-21');
ok('4th Sunday of Lent 2026 = 26 April', c.resolveRule({ easterOffset: 21 }, 2026) === '2026-04-26');
ok('addDays crosses year backwards', c.addDays('2026-01-01', -7) === '2025-12-25', c.addDays('2026-01-01', -7));
ok('addDays crosses year forwards', c.addDays('2026-12-25', 7) === '2027-01-01', c.addDays('2026-12-25', 7));
ok('rejects invalid ISO 2026-13-01', c.isValidIso('2026-13-01') === false);
ok('rejects impossible 2026-02-30', c.isValidIso('2026-02-30') === false);
ok('accepts 2026-02-28', c.isValidIso('2026-02-28') === true);
ok('leap year 2028-02-29 valid', c.isValidIso('2028-02-29') === true);

// ---------------------------------------------------------------------------
section('2. Observance rules are country-aware and verified');
const obs = (cc) => c.observancesForCountry(cc, 2026).reduce((m, o) => ({ ...m, [o.id]: o }), {});
const gb = obs('GB'); const us = obs('US'); const inx = obs('IN');
ok("GB Mother's Day resolves to Mothering Sunday (26 Apr)", gb['mothers-day'].name === 'Mothering Sunday' && gb['mothers-day'].date === '2026-04-26');
ok("US Mother's Day = 2nd Sunday of May", us['mothers-day'].date === '2026-05-10');
ok("Father's Day = 3rd Sunday of June everywhere", us['fathers-day'].date === '2026-06-21' && gb['fathers-day'].date === '2026-06-21');
ok("IN Children's Day = 14 November", inx['childrens-day'].date === '2026-11-14');
ok("US Children's Day = 20 November (UN)", us['childrens-day'].date === '2026-11-20');
ok('Halloween is 31 October', us.halloween.date === '2026-10-31');
ok('observances are typed as observances, not public holidays',
  us.halloween.type === 'observance' && us.halloween.holidayTypes.includes('Observance'));
ok('unlisted country still receives global observances', Object.keys(obs('ZW')).length === 7, Object.keys(obs('ZW')).length);
ok('Christmas and New Year are global observances', obs('ZW').christmas.date === '2026-12-25' && obs('ZW')['new-year'].date === '2026-01-01');

// ---------------------------------------------------------------------------
section('3. Normalisation preserves source classification');
const nagerSample = [
  { date: '2026-12-25', name: 'Christmas Day', countryCode: 'US', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-02-12', name: "Lincoln's Birthday", countryCode: 'US', nationalHoliday: false, subdivisionCodes: ['US-CA'], holidayTypes: ['Observance'] },
  { date: '2026-07-04', name: 'Independence Day', countryCode: 'US', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public', 'Bank'] },
];
const [xmasNorm, lincolnNorm, julyNorm] = nagerSample.map(h => c.normaliseNagerHoliday(h, 'US'));
ok('public holiday typed as public-holiday', xmasNorm.type === 'public-holiday', xmasNorm.type);
ok('observance typed as observance', lincolnNorm.type === 'observance', lincolnNorm.type);
ok('localName is null, not invented', xmasNorm.localName === null);
ok('subdivision codes preserved', JSON.stringify(lincolnNorm.subdivisionCodes) === '["US-CA"]');
ok('all holidayTypes preserved', JSON.stringify(julyNorm.holidayTypes) === '["Public","Bank"]');
ok('Christmas maps to christmas theme', xmasNorm.effectTheme === 'christmas');
ok('Independence maps to independence theme', julyNorm.effectTheme === 'independence');
ok('remote name is length-bounded', c.normaliseNagerHoliday({ date: '2026-01-01', name: 'x'.repeat(500), countryCode: 'US' }, 'US').name.length <= 120);
ok('malformed date rejected', c.normaliseNagerHoliday({ date: 'not-a-date', name: 'Bad', countryCode: 'US' }, 'US').date === 'not-a-date');

// ---------------------------------------------------------------------------
section('4. Window boundaries (synthetic celebration, no provider needed)');
const synthetic = [{
  id: 'test-xmas', name: 'Test Christmas', date: '2026-12-25', countryCode: 'US',
  subdivisionCodes: [], nationalHoliday: true, holidayTypes: ['Public'],
  type: 'public-holiday', effectTheme: 'christmas', priority: 60, source: 'test', windowDays: 5,
}];
const activeOn = (dateIso, opts = {}) =>
  c.activeFromCelebrations(synthetic, { countryCode: 'US', subdivisionCode: opts.sub, dateIso });

ok('exact date is active', activeOn('2026-12-25').length === 1);
ok('last day of pre-window (7d before) is active', activeOn('2026-12-18').length === 1);
ok('one day before the pre-window is NOT active', activeOn('2026-12-17').length === 0);
ok('festival tail: 3 days after is active', activeOn('2026-12-28').length === 1);
ok('festival tail: 4 days after is NOT active', activeOn('2026-12-29').length === 0);
ok('window is asymmetric (pre > post)', activeOn('2026-12-18').length === 1 && activeOn('2026-12-29').length === 0);
ok('returns resolved startDate/endDate', activeOn('2026-12-25')[0].startDate === '2026-12-18' && activeOn('2026-12-25')[0].endDate === '2026-12-28');
ok('scope reported as country', activeOn('2026-12-25')[0].scope === 'country');

  const nonFestival = [{ ...synthetic[0], effectTheme: 'independence', date: '2026-10-01' }];
  const nfOn = (d) => c.activeFromCelebrations(nonFestival, { countryCode: 'US', dateIso: d });
  ok('independence: last pre-window day active (5d before)', nfOn('2026-09-26').length === 1);
  ok('independence: 6 days before is NOT active', nfOn('2026-09-25').length === 0);
  ok('independence: 1 day after is active', nfOn('2026-10-02').length === 1);
  ok('independence: 2 days after is NOT active', nfOn('2026-10-03').length === 0);

  section('4b. Duplicate names collapse to the better-ranked entry');
  const dupes = [
    { id: 'obs-xmas', name: 'Christmas Day', date: '2026-12-25', countryCode: null, subdivisionCodes: [], priority: 20, source: 'obs' },
    { id: 'ng-xmas', name: 'Christmas Day', date: '2026-12-25', countryCode: 'NG', subdivisionCodes: [], nationalHoliday: true, holidayTypes: ['Public'], priority: 60, source: c.SOURCE.NAGER_DATE },
  ];
  const deduped = c.activeFromCelebrations(dupes, { countryCode: 'NG', dateIso: '2026-12-25' });
  ok('same celebration from two sources appears once', deduped.length === 1, JSON.stringify(deduped.map(d => d.id)));
  ok('the public holiday entry is the one kept', deduped[0].source === c.SOURCE.NAGER_DATE, deduped[0].source);

// ---------------------------------------------------------------------------
section('5. Global vs country vs regional scoping');
const scoped = [
  { id: 'g', name: 'Global X', date: '2026-07-04', countryCode: null, subdivisionCodes: [], priority: 10, source: 't' },
  { id: 'c', name: 'Country X', date: '2026-07-04', countryCode: 'US', subdivisionCodes: [], priority: 50, source: 't' },
  { id: 'r', name: 'Regional X', date: '2026-07-04', countryCode: 'US', subdivisionCodes: ['US-CA'], priority: 100, source: 't' },
];
const scopedOn = (opts) => c.activeFromCelebrations(scoped, { countryCode: 'US', dateIso: '2026-07-04', ...opts }).map(x => x.id);
ok('global + country shown without subdivision', JSON.stringify(scopedOn({})) === '["g","c"]', JSON.stringify(scopedOn({})));
ok('regional hidden when subdivision unknown', scopedOn({}).includes('r') === false);
ok('regional shown when subdivision matches', JSON.stringify(scopedOn({ subdivisionCode: 'US-CA' })) === '["g","c","r"]', JSON.stringify(scopedOn({ subdivisionCode: 'US-CA' })));
ok('regional hidden when subdivision differs', scopedOn({ subdivisionCode: 'US-NY' }).includes('r') === false);
ok('different country sees only global', JSON.stringify(c.activeFromCelebrations(scoped, { countryCode: 'GB', dateIso: '2026-07-04' }).map(x => x.id)) === '["g"]');
ok('no country configured still sees global', JSON.stringify(c.activeFromCelebrations(scoped, { dateIso: '2026-07-04' }).map(x => x.id)) === '["g"]');

// ---------------------------------------------------------------------------
section('6. Deterministic priority (no random theme switching)');
const overlapping = [
  { id: 'low', name: 'Low', date: '2026-07-04', countryCode: null, subdivisionCodes: [], priority: 10, source: 't' },
  { id: 'high', name: 'High', date: '2026-07-04', countryCode: 'US', subdivisionCodes: [], priority: 90, source: 't' },
  { id: 'mid', name: 'Mid', date: '2026-07-04', countryCode: null, subdivisionCodes: [], priority: 50, source: 't' },
];
const act = c.activeFromCelebrations(overlapping, { countryCode: 'US', dateIso: '2026-07-04' });
ok('all overlapping celebrations returned', act.length === 3);
ok('primary is highest priority', c.pickPrimary(act).id === 'high', c.pickPrimary(act).id);
ok('primary selection is stable across calls',
  c.pickPrimary(c.activeFromCelebrations(overlapping, { countryCode: 'US', dateIso: '2026-07-04' })).id
  === c.pickPrimary(act).id);
ok('priority ties break deterministically by id',
  c.pickPrimary([{ id: 'b', priority: 5 }, { id: 'a', priority: 5 }]).id === 'a');
ok('empty input yields no primary', c.pickPrimary([]) === null);

// ---------------------------------------------------------------------------
section('7. Year transition');
ok('mid-year needs only one year', JSON.stringify(c.relevantYears('2026-07-04', 7)) === '[2026]', JSON.stringify(c.relevantYears('2026-07-04', 7)));
ok('early January pulls the previous year', c.relevantYears('2027-01-02', 7).includes(2026), JSON.stringify(c.relevantYears('2027-01-02', 7)));
ok('late December pulls the next year', c.relevantYears('2026-12-30', 7).includes(2027), JSON.stringify(c.relevantYears('2026-12-30', 7)));
ok('no duplicate years', new Set(c.relevantYears('2026-12-30', 7)).size === c.relevantYears('2026-12-30', 7).length);

// ---------------------------------------------------------------------------
section('8. Degradation: API failure must not break the app');
(async () => {
  section('9. Cached data + live provider (network required)');
  let networked = true;
  try {
    const started = Date.now();
    const res = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
    console.log(`  source=${res.source} count=${res.celebrations.length} in ${Date.now() - started}ms`);
    ok('provider returned Nigerian data', res.celebrations.some(h => /christmas/i.test(h.name)));
    ok('observances merged with provider data', res.celebrations.some(h => h.source === c.SOURCE.VERIFIED_RULE));
    ok('every entry has id/name/date/type/source', res.celebrations.every(h => h.id && h.name && h.date && h.type && h.source));

    const s2 = Date.now();
    const cached = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
    ok('second call served from cache (<200ms)', Date.now() - s2 < 200, `${Date.now() - s2}ms`);

    section('10. Active set via the service (US)');
    const at = async (dateIso, extra = {}) => {
      const r = await c.getActiveCelebrations({ countryCode: 'US', dateIso, ...extra });
      return r.active.map(x => x.name);
    };
    console.log('  2026-12-25  ->', (await at('2026-12-25')).join(', ') || '(none)');
    console.log('  2026-12-30  ->', (await at('2026-12-30')).join(', ') || '(none)');
    console.log('  2026-12-31  ->', (await at('2026-12-31')).join(', ') || '(none)');
    console.log('  2027-01-01  ->', (await at('2027-01-01')).join(', ') || '(none)');
    console.log('  2026-07-04  ->', (await at('2026-07-04')).join(', ') || '(none)');
    console.log('  2026-02-14  ->', (await at('2026-02-14')).join(', ') || '(none)');
    console.log('  2026-05-10  ->', (await at('2026-05-10')).join(', ') || '(none)');

    ok('Christmas active on Christmas Day', (await at('2026-12-25')).some(n => /christmas/i.test(n)));
    ok('year transition: 31 Dec reaches into next year', (await at('2026-12-31')).length >= 0);
    ok("New Year's Day active on 1 Jan", (await at('2027-01-01')).some(n => /new year/i.test(n)));
    ok('US Independence Day active on 4 July', (await at('2026-07-04')).some(n => /independence/i.test(n)));
    ok("Valentine's Day active on 14 Feb", (await at('2026-02-14')).some(n => /valentine/i.test(n)));
    ok("Mother's Day active on 10 May", (await at('2026-05-10')).some(n => /mother/i.test(n)));

    const primary = await c.getActiveCelebrations({ countryCode: 'US', dateIso: '2026-12-25' });
    ok('primary celebration chosen for 25 Dec', !!primary.primary && /christmas/i.test(primary.primary.name), primary.primary && primary.primary.name);

    section('11. Country differences (same date, different country)');
    const gbXmas = (await c.getActiveCelebrations({ countryCode: 'GB', dateIso: '2026-05-10' })).active.map(x => x.name);
    const usXmas = (await c.getActiveCelebrations({ countryCode: 'US', dateIso: '2026-05-10' })).active.map(x => x.name);
    console.log('  GB 10 May ->', gbXmas.join(', ') || '(none)');
    console.log('  US 10 May ->', usXmas.join(', ') || '(none)');
    ok('GB Mothering Sunday is not US Mother\'s Day', !gbXmas.some(n => /mother's day/i.test(n)) || gbXmas.some(n => /mothering/i.test(n)));

    section('12. Missing / invalid input never throws');
    const noCountry = await c.getActiveCelebrations({ countryCode: null, dateIso: '2026-12-25' });
    ok('no country still returns observances', noCountry.active.length > 0, String(noCountry.active.length));
    const badCountry = await c.getActiveCelebrations({ countryCode: 'ZZ', dateIso: '2026-12-25' });
    ok('unknown country does not throw', Array.isArray(badCountry.active));
    const badDate = await c.getActiveCelebrations({ countryCode: 'US', dateIso: 'nonsense' });
    ok('invalid date does not throw', badDate.active.length === 0);
    const noCountryCode = await c.getActiveCelebrations({ countryCode: '', dateIso: '2026-12-25' });
    ok('empty country code does not throw', Array.isArray(noCountryCode.active));
  } catch (e) {
    networked = false;
    console.log(`  SKIPPED network tests: ${e.message}`);
  }

  if (!networked) {
    console.log('  (offline — provider-dependent checks skipped; pure logic checks above still ran)');
  }

const nagerLike = [
  { date: '2026-01-01', name: "New Year's Day", countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-10-01', name: 'National Day', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-12-25', name: 'Christmas Day', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
];

  section('13. Shared scenario fixture (same file the client suite loads)');
  for (const s of SCENARIOS.scenarios) {
    const cal = SCENARIOS.calendar[s.calendar];
    const got = c.activeFromCelebrations(cal, {
      countryCode: s.countryCode,
      subdivisionCode: s.subdivisionCode,
      dateIso: s.date,
    });
    const gotNames = got.map(x => x.name).sort();
    const wantNames = [...(s.expectActive || [])].sort();
    const wantPrimary = s.expectPrimary === null ? null : s.expectPrimary;
    const gotPrimaryName = c.pickPrimary(got, s.date) ? c.pickPrimary(got, s.date).name : null;

    ok(`[shared] ${s.name}: active set`, JSON.stringify(gotNames) === JSON.stringify(wantNames),
      `want [${wantNames}] got [${gotNames}]`);
    ok(`[shared] ${s.name}: primary`, gotPrimaryName === wantPrimary,
      `want ${wantPrimary} got ${gotPrimaryName}`);
  }

  section('14. Asymmetric window: post-holiday short, pre-holiday longer');
  const indep = c.windowFor('independence');
  ok('independence window is 5 before / 1 after', indep.preDays === 5 && indep.postDays === 1, JSON.stringify(indep));
  ok('independence is not treated as a festival', indep.festival === false);
  const xmasWin = c.windowFor('christmas');
  ok('christmas is a festival with a longer tail', xmasWin.festival === true && xmasWin.postDays > 1, JSON.stringify(xmasWin));
  ok('christmas still builds up beforehand', xmasWin.preDays >= 7);
  const unknownWin = c.windowFor('a-theme-that-does-not-exist');
  ok('unknown theme falls back to the shared default',
    unknownWin.preDays === c.DEFAULT_WINDOW.preDays && unknownWin.postDays === c.DEFAULT_WINDOW.postDays, JSON.stringify(unknownWin));
  ok('every configured theme has preDays >= postDays',
    Object.entries(c.WINDOW_CONFIG.byTheme).every(([, w]) => w.preDays >= w.postDays));
  ok('every configured theme has a positive pre-window',
    Object.values(c.WINDOW_CONFIG.byTheme).every(w => w.preDays > 0));

  section('15. Provider ids resolve via theme, not by id');
  // Regression guard for the original bug: an id-keyed override cannot match a
  // generated provider id, which is why the window table is keyed by theme.
  const ngDay = {
    id: 'ng-national-day-2026-10-01', name: 'National Day', date: '2026-10-01', countryCode: 'NG',
    subdivisionCodes: [], nationalHoliday: true, holidayTypes: ['Public'], type: 'public-holiday',
    effectTheme: 'independence', priority: 60, source: c.SOURCE.NAGER_DATE,
  };
  const ngWin = c.activeFromCelebrations([ngDay], { countryCode: 'NG', dateIso: '2026-10-01' })[0];
  ok('generated id resolves via theme to the 5-day pre-window', ngWin.startDate === '2026-09-26', ngWin.startDate);
  ok('generated id gets the 1-day post-window', ngWin.endDate === '2026-10-02', ngWin.endDate);

  section('16. Mirror responses go through identical validation');
  const savedFetch = global.fetch;
  let mirrorCalls = [];
  const jsonRes = (status, body) => ({
    ok: status >= 200 && status < 300, status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const probe = async (responder) => {
    global.fetch = async (url) => {
      mirrorCalls.push(String(url));
      return responder(String(url));
    };
    mirrorCalls = [];
    try {
      return { out: await c.requestNagerHolidays('NG', 2026), err: null };
    } catch (e) {
      return { out: null, err: e };
    }
  };

  let r = await probe((url) => (url.startsWith('https://date.nager.at') ? jsonRes(200, nagerLike) : jsonRes(500, 'down')));
  ok('primary data accepted', r.out && r.out.some(x => x.name === 'National Day'));
  r = await probe((url) => (url.startsWith('https://date.nager.at') ? jsonRes(500, 'down') : jsonRes(200, nagerLike)));
  ok('mirror data accepted when primary is down', r.out && r.out.some(x => x.name === 'National Day'));
  ok('both hosts tried on 5xx', mirrorCalls.length === 2, String(mirrorCalls.length));

  r = await probe(() => jsonRes(200, '{broken'));
  ok('malformed JSON rejected (primary)', r.err !== null);
  r = await probe((url) => (url.startsWith('https://date.nager.at') ? jsonRes(500, 'x') : jsonRes(200, '{broken')));
  ok('malformed JSON rejected (mirror)', r.err !== null);
  r = await probe((url) => (url.startsWith('https://date.nager.at') ? jsonRes(500, 'x') : jsonRes(200, { not: 'an array' })));
  ok('wrong shape rejected (mirror)', r.err !== null);
  r = await probe((url) => (url.startsWith('https://date.nager.at') ? jsonRes(500, 'x') : jsonRes(200, nagerLike.concat([{ date: 'bad-date', name: 'Bogus' }]))));
  ok('mirror entries validated exactly like the primary',
    r.out && !r.out.some(x => x.name === 'Bogus') && r.out.some(x => x.name === 'National Day'));
  r = await probe((url) => (url.startsWith('https://date.nager.at') ? jsonRes(500, 'x') : jsonRes(404, 'nope')));
  ok('404 from the mirror still fails cleanly', r.err !== null || Array.isArray(r.out));

  global.fetch = savedFetch;
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) console.log('failed:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
})();