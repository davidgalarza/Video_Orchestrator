import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    actionTimeout: 10000,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync(chrome) ? chrome : undefined),
    },
    trace: "retain-on-failure",
  },
  reporter: "list",
});
