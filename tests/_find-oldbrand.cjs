/**
 * Report exactly which visible text on a page still contains the old brand.
 *
 * The rebrand QA asserts "no Nocturne anywhere visible", but a bare assertion
 * only says *that* something matched. This walks the rendered tree, skips
 * script/style/hidden nodes and asset paths, and prints the offending strings
 * with enough of their surrounding context to identify the source.
 */
const { chromium } = require('@playwright/test');

const BASE = process.env.QA_BASE_URL || 'http://localhost:5173';
const PATHS = process.argv.slice(2);

async function seed(page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      user: {
        id: 'usr_brand', name: 'Brand QA', email: 'brand@nocturne.test', role: 'user',
        avatar: null, genres: ['Pop'], selectedArtists: ['The Weeknd'], country: 'NG',
        createdAt: '2026-01-01', onboardingCompleted: true, onboardingEligible: true,
        profileSetupCompleted: true, profileSetupStep: 'summary',
      },
    }),
  }));
  await page.addInitScript(() => {
    try { localStorage.setItem('nocturne_token', 'qa-token'); } catch {}
    try { localStorage.setItem('nocturne_onboarding_usr_brand', 'done'); } catch {}
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await seed(page);

  for (const p of PATHS) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const hits = await page.evaluate(() => {
      const out = [];
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent.trim();
          if (t && /Nocturne|NOCTURNE/.test(t)) {
            const el = node.parentElement;
            out.push({
              text: t.slice(0, 120),
              tag: el ? el.tagName.toLowerCase() : '?',
              cls: el && el.getAttribute('class') ? el.getAttribute('class').slice(0, 70) : '',
            });
          }
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
      const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        for (const c of node.childNodes) walk(c);
      };
      walk(document.body);
      return out;
    });

    console.log(`\n=== ${p} : ${hits.length} visible old-brand node(s) ===`);
    hits.forEach((h) => console.log(`  <${h.tag} class="${h.cls}">  "${h.text}"`));

    const title = await page.title();
    if (/Nocturne/i.test(title)) console.log(`  <title> = "${title}"`);
  }

  await browser.close();
})();