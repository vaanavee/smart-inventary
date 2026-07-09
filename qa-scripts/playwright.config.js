import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173', // Vite default port used in the client

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Ensure it runs in headed mode so you can see Chrome open */
    headless: false,
    
    /* Use the installed Google Chrome browser */
    channel: 'chrome',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
