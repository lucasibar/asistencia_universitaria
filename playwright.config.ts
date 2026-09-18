import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 60000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true,
    viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort', url: 'http://127.0.0.1:5175', reuseExistingServer: false,
    env: { VITE_API_URL: 'http://127.0.0.1:3000', VITE_SUPABASE_URL: 'https://demo.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key' },
    timeout: 60000,
  },
});
