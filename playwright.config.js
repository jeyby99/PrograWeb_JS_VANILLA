// Configuración de Playwright para probar pagina2.html
//
// Uso normal:        npm test
//   -> levanta un servidor estático en http://localhost:4173 que sirve src/main/resources/static
//      (no necesita Spring Boot ni PostgreSQL: la página 2 solo usa la API de Rick and Morty).
//
// Contra tu app Spring Boot ya iniciada:
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
