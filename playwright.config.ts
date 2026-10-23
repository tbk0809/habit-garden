import { defineConfig, devices } from "@playwright/test";

// Authenticated pages/cookies must never be copied into failure artifacts.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  preserveOutput: "never",
  use: {
    baseURL: "http://localhost:3108",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.platform === "win32" ? { channel: "msedge" } : {}),
      },
    },
  ],
});
