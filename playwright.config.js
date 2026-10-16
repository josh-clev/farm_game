const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results',
  expect: { timeout: 1000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'webkit',
    headless: true,
    screenshot: 'off',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
