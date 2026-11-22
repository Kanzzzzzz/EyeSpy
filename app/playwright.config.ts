import { defineConfig, devices } from '@playwright/test';

/**
 * Screenshots every screen at phone size, so UI changes are reviewed as
 * pictures. Run with `pnpm screenshots`; images land in app/screenshots/.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:5174',
    colorScheme: 'dark',
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
