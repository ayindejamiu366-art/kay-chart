import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the celebration visual QA suite only.
 *
 * Kept separate from any future e2e config so this run cannot disturb the
 * existing vitest suite, and so the webServer entry starts the app the QA needs.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /celebration-visual\.spec\.js/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
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
