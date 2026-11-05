/**
 * Nager.Date integration and failure-mode tests.
 *
 * The upstream call is stubbed so every failure path — timeout, 404, 429, 500,
 * malformed JSON, wrong shape — is exercised deterministically and without a
 * network. Cache behaviour is verified by counting real invocations.
 */
const c = require('../server/services/celebrations.cjs');

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; failures.push(label); console.log(`  FAIL  ${label} ${extra}`); }
};
const section = (t) => console.log(`\n${t}`);

// --- Stub the network ------------------------------------------------------
const realFetch = global.fetch;
let calls = [];
let nextResponder = null;

global.fetch = async (url, opts) => {
  calls.push({ url: String(url) });
  if (!nextResponder) throw new Error('no responder configured');
  return nextResponder(String(url), opts);
};

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const nagerFixture = [
  { date: '2026-01-01', name: "New Year's Day", countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-05-27', name: "Children's Day", countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-10-01', name: 'National Day', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-12-25', name: 'Christmas Day', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  { date: '2026-12-26', name: 'Boxing Day', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
];

(async () => {
  // -----------------------------------------------------------------------
  section('1. Successful request');
  c.clearCache();
  calls = [];
  nextResponder = () => jsonResponse(200, nagerFixture);
  let res = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  ok('one upstream call made', calls.length === 1, String(calls.length));
  ok('requests the documented v4 path', /\/api\/v4\/Holidays\/NG\/2026$/.test(calls[0].url), calls[0].url);
  ok('primary host is date.nager.at', calls[0].url.startsWith('https://date.nager.at/'), calls[0].url);
  ok('source is NAGER_DATE', res.celebrations.find(x => x.name === 'National Day').source === c.SOURCE.NAGER_DATE);
  ok('observances merged alongside provider data', res.celebrations.some(x => x.source === c.SOURCE.VERIFIED_RULE));
  ok('every entry declares a source', res.celebrations.every(x => Object.values(c.SOURCE).includes(x.source)));

  // -----------------------------------------------------------------------
  section('2. Cache hit');
  calls = [];
  const started = Date.now();
  res = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  ok('no second upstream call', calls.length === 0, String(calls.length));
  ok('cache hit is fast', Date.now() - started < 50, `${Date.now() - started}ms`);
  ok('cache is keyed per country', res.celebrations.length > 0);

  // -----------------------------------------------------------------------
  section('3. Nigeria holiday is real and dated correctly');
  const natDay = res.celebrations.find(x => x.name === 'National Day');
  ok("Nigeria National Day is 2026-10-01", natDay && natDay.date === '2026-10-01', natDay && natDay.date);
  ok('Nigeria National Day is a public holiday', natDay && natDay.type === 'public-holiday');
  ok('Nigeria National Day is national', natDay && natDay.nationalHoliday === true);
  const childrens = res.celebrations.find(x => x.name === "Children's Day");
  ok("Nigeria Children's Day is 2026-05-27 from Nager", childrens && childrens.date === '2026-05-27', childrens && childrens.date);

  // -----------------------------------------------------------------------
  section('4. Another country');
  c.clearCache();
  calls = [];
  nextResponder = () => jsonResponse(200, [
    { date: '2026-07-04', name: 'Independence Day', countryCode: 'US', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
  ]);
  res = await c.getCelebrations({ countryCode: 'US', year: 2026 });
  ok('US request built for the US', /Holidays\/US\/2026$/.test(calls[0].url), calls[0].url);
  ok('US Independence Day present', res.celebrations.some(x => x.date === '2026-07-04'));

  // -----------------------------------------------------------------------
  section('5. Active / inactive and the activation window');
  // Re-seed the NG cache: section 4 switched the responder to US data, so without
  // this the NG assertions below would be reading US holidays.
  c.clearCache();
  nextResponder = () => jsonResponse(200, nagerFixture);
  const ngCal = (await c.getCelebrations({ countryCode: 'NG', year: 2026 })).celebrations;
  const usCal = res.celebrations;
  const on = (dateIso) => c.activeFromCelebrations(usCal, { countryCode: 'US', dateIso }).map(x => x.name);
  ok('1 Oct 2026 Nigeria National Day active (via service)', (await c.getActiveCelebrations({ countryCode: 'NG', dateIso: '2026-10-01' })).active.some(x => /National Day/.test(x.name)));
  ok('20 Sep 2026 inactive', (await c.getActiveCelebrations({ countryCode: 'NG', dateIso: '2026-09-20' })).active.every(x => !/National Day/.test(x.name)));
  const oct1 = c.activeFromCelebrations(ngCal, { countryCode: 'NG', dateIso: '2026-10-01' });
  const oct1Entry = oct1.find(x => x.name === 'National Day');
  ok('independence window is 5 days before / 1 day after', oct1Entry && oct1Entry.startDate === '2026-09-26' && oct1Entry.endDate === '2026-10-02', oct1Entry && oct1Entry.startDate + '..' + oct1Entry.endDate);
  ok('post tail is shorter than the pre-window', c.windowFor('independence').postDays < c.windowFor('independence').preDays);
  ok('window differs between celebration types', c.windowFor('christmas').postDays !== c.windowFor('independence').postDays);
  ok('US Independence Day active on 4 Jul', on('2026-07-04').some(n => /Independence/.test(n)));
  ok('US Independence Day active at the start of its 5-day pre-window', on('2026-06-29').some(n => /Independence/.test(n)));
  ok('US Independence Day inactive one day before the pre-window', on('2026-06-28').every(n => !/Independence/.test(n)));
  ok('US Independence Day inactive after the short tail', on('2026-07-06').every(n => !/Independence/.test(n)));

  // -----------------------------------------------------------------------
  section('6. Cache survives and is per country+year');
  c.clearCache();
  calls = [];
  nextResponder = () => jsonResponse(200, nagerFixture);
  await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  ok('same country+year served from cache', calls.length === 1, String(calls.length));
  await c.getCelebrations({ countryCode: 'NG', year: 2027 });
  ok('different year is a separate cache entry', calls.length === 2, String(calls.length));
  await c.getCelebrations({ countryCode: 'GH', year: 2026 });
  ok('different country is a separate cache entry', calls.length === 3, String(calls.length));

  // -----------------------------------------------------------------------
  section('7. Stale-cache fallback when upstream dies after a good fetch');
  c.clearCache();
  calls = [];
  nextResponder = () => jsonResponse(200, nagerFixture);
  await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  const fetchCountBefore = calls.length;
  // Age the entry beyond its TTL.
  c.__setCacheAge?.('NG', 2026, 48 * 60 * 60 * 1000);
  nextResponder = () => { throw new Error('ECONNREFUSED'); };
  res = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  ok('stale cache served when upstream fails', res.stale === true, `stale=${res.stale}`);
  ok('stale data still contains the real holiday', res.celebrations.some(x => x.name === 'National Day'));
  ok('upstream was retried', calls.length > fetchCountBefore);

  // -----------------------------------------------------------------------
  section('8. Failure modes never throw');
  const failureCases = [
    ['timeout', () => { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; }, 'timeout'],
    ['HTTP 500', () => jsonResponse(500, 'boom'), '500'],
    ['HTTP 429', () => jsonResponse(429, 'slow down'), '429'],
    ['HTTP 403', () => jsonResponse(403, 'nope'), '403'],
    ['malformed JSON', () => jsonResponse(200, '{not json'), 'malformed'],
    ['wrong shape (object)', () => jsonResponse(200, { holidays: [] }), 'shape'],
    ['empty array', () => jsonResponse(200, []), 'empty'],
    ['null body', () => jsonResponse(200, null), 'null'],
  ];

  for (const [label, responder, tag] of failureCases) {
    c.clearCache();
    nextResponder = responder;
    let threw = false;
    let out = null;
    try {
      out = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
    } catch {
      threw = true;
    }
    ok(`${label} does not throw`, !threw);
    if (out) {
      ok(`${label} still returns a usable list`, Array.isArray(out.celebrations));
      ok(`${label} still includes verified observances`, out.celebrations.some(x => x.source === c.SOURCE.VERIFIED_RULE));
    }
  }

  // -----------------------------------------------------------------------
  section('9. Invalid country codes are rejected before any upstream call');
  c.clearCache();
  calls = [];
  nextResponder = () => jsonResponse(200, nagerFixture);
  for (const bad of ['ZZ', 'XX', 'EU', 'AC', 'not-a-country', 'N', '../../etc', '']) {
    calls = [];
    const out = await c.getCelebrations({ countryCode: bad, year: 2026 });
    ok(`"${bad}" makes no upstream request`, calls.length === 0, `made ${calls.length}`);
    ok(`"${bad}" returns observances only`, out.celebrations.every(x => x.source === c.SOURCE.VERIFIED_RULE));
  }
  ok('isSupportedCountryCode accepts NG', c.isSupportedCountryCode('NG') === true);
  ok('isSupportedCountryCode accepts lowercase ng', c.isSupportedCountryCode('ng') === true);
  ok('isSupportedCountryCode rejects ZZ', c.isSupportedCountryCode('ZZ') === false);
  ok('isSupportedCountryCode rejects path traversal', c.isSupportedCountryCode('../../secret') === false);

  // -----------------------------------------------------------------------
  section('10. 404 for an unknown country does not fall through to the mirror');
  c.clearCache();
  calls = [];
  nextResponder = () => jsonResponse(404, { title: 'Unknown country code' });
  const notFound = await c.getCelebrations({ countryCode: 'BR', year: 2026 });
  ok('single request for a definitive 404', calls.length === 1, String(calls.length));
  ok('404 does not throw', Array.isArray(notFound.celebrations));

  section('11. 5xx falls through to the mirror host');
  c.clearCache();
  calls = [];
  nextResponder = (url) => (url.startsWith('https://date.nager.at') ? jsonResponse(500, 'down') : jsonResponse(200, nagerFixture));
  const viaMirror = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  ok('tried both hosts', calls.length === 2, String(calls.length));
  ok('mirror data was used', viaMirror.celebrations.some(x => x.name === 'National Day'));

  // -----------------------------------------------------------------------
  section('12. Malformed entries are dropped, not trusted');
  c.clearCache();
  nextResponder = () => jsonResponse(200, [
    { date: '2026-10-01', name: 'National Day', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    { date: 'garbage-date', name: 'Bad Date', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    { date: '2026-13-45', name: 'Impossible Date', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    { date: '2026-02-30', name: 'Not A Real Date', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    { name: 'No Date At All', countryCode: 'NG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    null,
  ]);
  const cleaned = await c.getCelebrations({ countryCode: 'NG', year: 2026 });
  ok('only the well-formed entry survives', cleaned.celebrations.filter(x => x.source === c.SOURCE.NAGER_DATE).length === 1, String(cleaned.celebrations.filter(x => x.source === c.SOURCE.NAGER_DATE).length));
  ok('the real holiday is the survivor', cleaned.celebrations.some(x => x.name === 'National Day'));

  // -----------------------------------------------------------------------
  section('13. No duplicate celebrations');
  c.clearCache();
  nextResponder = () => jsonResponse(200, nagerFixture);
  const dup = await c.getActiveCelebrations({ countryCode: 'NG', dateIso: '2026-12-25' });
  const xmasNames = dup.active.filter(x => /christmas/i.test(x.name));
  ok('Christmas appears once even though two sources supply it', xmasNames.length === 1, `${xmasNames.length}`);
  ok('the public holiday is the one kept', xmasNames[0].type === 'public-holiday', xmasNames[0].type);
  const ids = dup.active.map(x => x.id);
  ok('no duplicate ids', new Set(ids).size === ids.length);

  // -----------------------------------------------------------------------
  section('14. Multiple simultaneous celebrations are all returned');
  c.clearCache();
  nextResponder = () => jsonResponse(200, nagerFixture);
  const multi = await c.getActiveCelebrations({ countryCode: 'NG', dateIso: '2026-12-26' });
  ok('Christmas and Boxing Day both active', multi.active.length >= 2, String(multi.active.length));
  ok('exactly one primary is chosen', !!multi.primary);
  ok('primary is one of the active entries', multi.active.some(x => x.id === multi.primary.id));
  ok('primary is deterministic across calls',
    (await c.getActiveCelebrations({ countryCode: 'NG', dateIso: '2026-12-26' })).primary.id === multi.primary.id);

  global.fetch = realFetch;
  c.clearCache();
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) console.log('failed:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
})();
