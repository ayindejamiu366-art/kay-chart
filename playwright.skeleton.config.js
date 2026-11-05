import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the skeleton browser QA suite.
 *
 * Separate from the celebration visual config so the two can be run and tuned
 * independently. Both expect the app to already be running: `QA_BASE_URL`
 * (default the Vite dev server) and `QA_API_URL` (default the backend).
 *
 * Requests are deliberately slow, because holding the app's own API responses is
 * how the suite observes a loading state honestly rather than faking one.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /skeleton-visual\.spec\.js/,
  // The per-test timeout is set inside the spec: these tests wait on held
  // requests, so the global value only acts as a backstop.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  // Serial, single worker. The suite holds network requests open, and running
  // screens in parallel would interleave those holds unpredictably.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://localhost:5173',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
