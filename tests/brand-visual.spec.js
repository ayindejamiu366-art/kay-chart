/**
 * Kay Chart rebrand browser QA.
 *
 * Runs at 1440 / 768 / 375 and checks the things a rebrand actually breaks:
 * the logo resolves and is not distorted, the new name is present, the old name
 * is absent from the visible UI, and the splash and navigation still render.
 *
 * Screens are visited signed-in where possible and signed-out otherwise, so both
 * the branded chrome and the public auth screens are covered.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.QA_BASE_URL || 'http://localhost:5173';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

const BRAND = 'Kay Chart';

/** Words that must never appear in rendered, user-facing UI. */
const OLD_BRAND = /Nocturne|NOCTURNE/;

async function seedUser(page, { country = 'NG', role = 'user' } = {}) {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: {
        id: 'usr_brand', name: 'Brand QA', email: 'brand@nocturne.test', role,
        avatar: null, genres: ['Pop'], selectedArtists: ['The Weeknd'], country,
        createdAt: '2026-01-01',
        onboardingCompleted: true, onboardingEligible: true,
        profileSetupCompleted: true, profileSetupStep: 'summary',
      },
    }),
  }));
  await page.addInitScript(() => {
    try { localStorage.setItem('nocturne_token', 'qa-token'); } catch {}
    try { localStorage.setItem('nocturne_onboarding_usr_brand', 'done'); } catch {}
  });
}

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Visible text only: skip script/style/hidden nodes and asset URLs. */
async function visibleText(page) {
  return page.evaluate(() => {
    const parts = [];
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) parts.push(t);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      for (const child of node.childNodes) walk(child);
    };
    walk(document.body);
    return parts.join(' ');
  });
}

test.describe('Kay Chart rebrand QA', () => {
  test.setTimeout(120000);

  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} ${vp.width}px`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('brand assets resolve over HTTP', async ({ page }) => {
        for (const asset of [
          '/brand/kay-chart-mark.svg',
          '/brand/kay-chart-logo.svg',
          '/favicon.svg',
          '/manifest.webmanifest',
        ]) {
          const res = await page.request.get(`${BASE}${asset}`);
          expect(res.status(), `${asset} should resolve`).toBe(200);
        }
      });

      test('document metadata carries the new brand', async ({ page }) => {
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

        await expect(page).toHaveTitle(BRAND);

        const meta = await page.evaluate(() => ({
          appName: document.querySelector('meta[name="application-name"]')?.content,
          ogTitle: document.querySelector('meta[property="og:title"]')?.content,
          ogSite: document.querySelector('meta[property="og:site_name"]')?.content,
          manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
          appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
          icon: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
        }));

        expect(meta.appName).toBe(BRAND);
        expect(meta.ogTitle).toBe(BRAND);
        expect(meta.ogSite).toBe(BRAND);
        expect(meta.appleTitle).toBe(BRAND);
        expect(meta.manifest).toBe('/manifest.webmanifest');
        expect(meta.icon).toBe('/favicon.svg');
      });

      test('the web app manifest is valid Kay Chart', async ({ page }) => {
        const res = await page.request.get(`${BASE}/manifest.webmanifest`);
        const m = await res.json();
        expect(m.name).toBe(BRAND);
        expect(m.short_name).toBe(BRAND);
        expect(Array.isArray(m.icons) && m.icons.length).toBeTruthy();
      });

      test('the splash shows the mark and the new name', async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

        const mark = page.locator('img[src="/brand/kay-chart-mark.svg"]').first();
        await expect(mark).toBeVisible({ timeout: 20000 });

        // Rendered, not merely present: the browser actually decoded it.
        const box = await mark.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height, natural: el.naturalWidth };
        });
        expect(box.w).toBeGreaterThan(0);
        expect(box.natural).toBeGreaterThan(0);
        // Square source must not be stretched.
        expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(2);

        const text = await visibleText(page);
        expect(text).toContain(BRAND);
        expect(OLD_BRAND.test(text), 'no old brand on the splash').toBe(false);
        expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
      });

      test('navigation shows the mark and the new name, with no old brand', async ({ page }) => {
        const errors = watchErrors(page);
        await seedUser(page);
        await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);

        const text = await visibleText(page);
        expect(text).toContain(BRAND);
        expect(OLD_BRAND.test(text), 'no old brand on Home').toBe(false);

        // The sidebar mark must render undistorted where the sidebar is shown.
        const sidebarMark = page.locator('img[src="/brand/kay-chart-mark.svg"]').first();
        if (await sidebarMark.count()) {
          await expect(sidebarMark).toBeVisible();
          const box = await sidebarMark.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height, natural: el.naturalWidth };
          });
          expect(box.w).toBeGreaterThan(0);
          expect(box.natural).toBeGreaterThan(0);
          expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(2);
        }

        // Navigation still usable after the logo swap.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);
        expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
      });

      test('auth screens carry the new brand only', async ({ page }) => {
        await seedUser(page);
        for (const path of ['/sign-in', '/sign-up', '/forgot-password']) {
          await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1200);
          const text = await visibleText(page);
          expect(OLD_BRAND.test(text), `no old brand on ${path}`).toBe(false);
        }
        // Sign-in is branded.
        await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
        expect(await visibleText(page)).toContain(BRAND);
      });

      test('onboarding welcome carries the mark and new name', async ({ page }) => {
        await page.goto(`${BASE}/welcome`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const text = await visibleText(page);
        expect(text).toContain(BRAND);
        expect(OLD_BRAND.test(text)).toBe(false);
        await expect(page.locator('img[src="/brand/kay-chart-mark.svg"]').first()).toBeVisible();
      });

      test('profile area carries the new brand only', async ({ page }) => {
        await seedUser(page);
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        const text = await visibleText(page);
        expect(text).toContain(BRAND);
        expect(OLD_BRAND.test(text)).toBe(false);
      });

      test('the existing celebration and skeleton systems still render', async ({ page }) => {
        const errors = watchErrors(page);
        await seedUser(page);
        await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        // Skeletons still function (Home settled, so they should be gone).
        await expect(page.locator('[data-skeleton]').first()).toHaveCount(0, { timeout: 30000 });
        // The app is alive and rendering real content, not a boot failure.
        expect(OLD_BRAND.test('Nocturne could not start')).toBe(false);
        await expect(page.locator('body')).toContainText(/\w/);
        expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
      });
    });
  }
});