// Browser tests: `npm run test:e2e` (first time: `npm install && npx playwright install chromium firefox`;
// add webkit and run with WEBKIT=1 to include Safari/iPhone, which CI always runs)
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4183;   // not 4173: EgyptianCalculator's tests use that

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 1100 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1100 } } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 1100 } } },
    // WebKit is Safari's engine, and every iPhone browser uses it: Desktop Safari plus an iPhone
    // (touch, phone screen). Only in CI or with WEBKIT=1, since WebKit needs system libraries
    // that not every dev machine has.
    ...(process.env.CI || process.env.WEBKIT ? [
      { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 1100 } } },
      { name: 'iphone', use: { ...devices['iPhone 13'] } },
    ] : []),
  ],
  webServer: {
    command: `node tests/e2e/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
