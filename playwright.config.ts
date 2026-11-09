import { defineConfig } from "@playwright/test";

// Read-only / non-destructive smoke suite — see tests/auth.spec.ts for why
// these tests avoid mutating animal/account data in production.
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  // Each assertion may wait on a real round-trip to Supabase, which this
  // environment sees take noticeably longer than Playwright's 5s default.
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1600, height: 900 },
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
