import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the Kay Chart rebrand QA suite.
 *
 * Kept separate from the skeleton and celebration configs so each can be run and
 * tuned independently. All three expect the app to already be running:
 * `QA_BASE_URL` (default the Vite dev server) and `QA_API_URL`.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /brand-visual\.spec\.js/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
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