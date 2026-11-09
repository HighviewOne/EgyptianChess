// Screenshots for a visual look-over: `npm run shots` → shots/<desktop|tablet|phone>/*.png
// Chromium only, kept out of `npm run test:e2e` and CI.
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4184;   // beside the e2e suite (4183) and EgyptianCalculator (4173)

module.exports = defineConfig({
  testDir: 'tests/shots',
  timeout: 60_000,
  workers: 2,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `node tests/e2e/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: true,
  },
});
