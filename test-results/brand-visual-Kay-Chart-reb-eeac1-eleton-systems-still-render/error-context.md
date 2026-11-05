# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: brand-visual.spec.js >> Kay Chart rebrand QA >> desktop 1440px >> the existing celebration and skeleton systems still render
- Location: tests\brand-visual.spec.js:209:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Kay Chart could not start" [level=1] [ref=e5]
  - paragraph [ref=e6]: "Uncaught ReferenceError: useState is not defined"
  - button "Retry" [ref=e7] [cursor=pointer]
```

# Test source

```ts
  118 |         const m = await res.json();
  119 |         expect(m.name).toBe(BRAND);
  120 |         expect(m.short_name).toBe(BRAND);
  121 |         expect(Array.isArray(m.icons) && m.icons.length).toBeTruthy();
  122 |       });
  123 | 
  124 |       test('the splash shows the mark and the new name', async ({ page }) => {
  125 |         const errors = watchErrors(page);
  126 |         await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  127 | 
  128 |         const mark = page.locator('img[src="/brand/kay-chart-mark.svg"]').first();
  129 |         await expect(mark).toBeVisible({ timeout: 20000 });
  130 | 
  131 |         // Rendered, not merely present: the browser actually decoded it.
  132 |         const box = await mark.evaluate((el) => {
  133 |           const r = el.getBoundingClientRect();
  134 |           return { w: r.width, h: r.height, natural: el.naturalWidth };
  135 |         });
  136 |         expect(box.w).toBeGreaterThan(0);
  137 |         expect(box.natural).toBeGreaterThan(0);
  138 |         // Square source must not be stretched.
  139 |         expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(2);
  140 | 
  141 |         const text = await visibleText(page);
  142 |         expect(text).toContain(BRAND);
  143 |         expect(OLD_BRAND.test(text), 'no old brand on the splash').toBe(false);
  144 |         expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  145 |       });
  146 | 
  147 |       test('navigation shows the mark and the new name, with no old brand', async ({ page }) => {
  148 |         const errors = watchErrors(page);
  149 |         await seedUser(page);
  150 |         await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
  151 |         await page.waitForTimeout(4000);
  152 | 
  153 |         const text = await visibleText(page);
  154 |         expect(text).toContain(BRAND);
  155 |         expect(OLD_BRAND.test(text), 'no old brand on Home').toBe(false);
  156 | 
  157 |         // The sidebar mark must render undistorted where the sidebar is shown.
  158 |         const sidebarMark = page.locator('img[src="/brand/kay-chart-mark.svg"]').first();
  159 |         if (await sidebarMark.count()) {
  160 |           await expect(sidebarMark).toBeVisible();
  161 |           const box = await sidebarMark.evaluate((el) => {
  162 |             const r = el.getBoundingClientRect();
  163 |             return { w: r.width, h: r.height, natural: el.naturalWidth };
  164 |           });
  165 |           expect(box.w).toBeGreaterThan(0);
  166 |           expect(box.natural).toBeGreaterThan(0);
  167 |           expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(2);
  168 |         }
  169 | 
  170 |         // Navigation still usable after the logo swap.
  171 |         const overflow = await page.evaluate(
  172 |           () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  173 |         );
  174 |         expect(overflow).toBeLessThanOrEqual(1);
  175 |         expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  176 |       });
  177 | 
  178 |       test('auth screens carry the new brand only', async ({ page }) => {
  179 |         await seedUser(page);
  180 |         for (const path of ['/sign-in', '/sign-up', '/forgot-password']) {
  181 |           await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  182 |           await page.waitForTimeout(1200);
  183 |           const text = await visibleText(page);
  184 |           expect(OLD_BRAND.test(text), `no old brand on ${path}`).toBe(false);
  185 |         }
  186 |         // Sign-in is branded.
  187 |         await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
  188 |         expect(await visibleText(page)).toContain(BRAND);
  189 |       });
  190 | 
  191 |       test('onboarding welcome carries the mark and new name', async ({ page }) => {
  192 |         await page.goto(`${BASE}/welcome`, { waitUntil: 'domcontentloaded' });
  193 |         await page.waitForTimeout(1500);
  194 |         const text = await visibleText(page);
  195 |         expect(text).toContain(BRAND);
  196 |         expect(OLD_BRAND.test(text)).toBe(false);
  197 |         await expect(page.locator('img[src="/brand/kay-chart-mark.svg"]').first()).toBeVisible();
  198 |       });
  199 | 
  200 |       test('profile area carries the new brand only', async ({ page }) => {
  201 |         await seedUser(page);
  202 |         await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  203 |         await page.waitForTimeout(3000);
  204 |         const text = await visibleText(page);
  205 |         expect(text).toContain(BRAND);
  206 |         expect(OLD_BRAND.test(text)).toBe(false);
  207 |       });
  208 | 
  209 |       test('the existing celebration and skeleton systems still render', async ({ page }) => {
  210 |         const errors = watchErrors(page);
  211 |         await seedUser(page);
  212 |         await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
  213 |         await page.waitForTimeout(5000);
  214 | 
  215 |         // Skeletons still function (Home settled, so they should be gone).
  216 |         await expect(page.locator('[data-skeleton]').first()).toHaveCount(0, { timeout: 30000 });
  217 |         // The app is alive and rendering real content, not a boot failure.
> 218 |         expect(OLD_BRAND.test('Nocturne could not start')).toBe(false);
      |                                                            ^ Error: expect(received).toBe(expected) // Object.is equality
  219 |         await expect(page.locator('body')).toContainText(/\w/);
  220 |         expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  221 |       });
  222 |     });
  223 |   }
  224 | });
```