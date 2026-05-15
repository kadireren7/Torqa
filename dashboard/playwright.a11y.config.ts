import { defineConfig, devices } from "@playwright/test";

/**
 * A11y gate: fresh `next start` (never reuse an old server on :3000).
 * - Default: `npm run build && npm run start` so `npm run test:a11y` is self-contained.
 * - CI: run `npm run build` first, then `PLAYWRIGHT_A11Y_BUILT=1 npm run test:a11y` to avoid a second build.
 */
const prebuilt = process.env.PLAYWRIGHT_A11Y_BUILT === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const parsedBaseUrl = new URL(baseURL);
const webServerCommand = `npm run start -- --hostname ${parsedBaseUrl.hostname} --port ${parsedBaseUrl.port || "3000"}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "a11y-axe.spec.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: prebuilt ? webServerCommand : `npm run build && ${webServerCommand}`,
    url: new URL("/api/health", baseURL).toString(),
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
