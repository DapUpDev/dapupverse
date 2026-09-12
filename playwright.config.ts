import { defineConfig, devices } from "@playwright/test";

// Load local Clerk development keys for the dev server and global setup.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent in clean environments; Clerk-backed tests will report the gap.
}

// A different port lets the suite run beside another dev server (E2E_PORT=3200).
const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /discovery\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
