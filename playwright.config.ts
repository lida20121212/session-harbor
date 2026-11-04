import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:1420', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } } }],
  webServer: {
    command: 'pnpm dev', url: 'http://127.0.0.1:1420', reuseExistingServer: !process.env.CI,
  },
});
