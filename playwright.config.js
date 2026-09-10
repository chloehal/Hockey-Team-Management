import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  use: {
    baseURL: "http://127.0.0.1:5182",
    browserName: "chromium",
    channel: "chromium",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5182 --strictPort",
    url: "http://127.0.0.1:5182",
    reuseExistingServer: !process.env.CI,
  },
});
