// Playwright configuration to test pagina2.html
//
// Default usage:     npm test
//   -> starts a static server on http://localhost:4173 serving src/main/resources/static
//      (no Spring Boot or PostgreSQL needed: page 2 only uses the Rick and Morty API).
//
// Against an already running Spring Boot app:
//   Windows (cmd):         set BASE_URL=http://localhost:8080 && npm test
//   Windows (PowerShell):  $env:BASE_URL="http://localhost:8080"; npm test
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node e2e/serve-static.js',
        url: 'http://localhost:4173/pagina2.html',
        reuseExistingServer: true,
        timeout: 15_000,
      },
});
