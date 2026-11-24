import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  timeout: 90_000,
  retries: 1,
  use: { baseURL: process.env.PERF_BASE_URL ?? "http://localhost:5000", viewport: { width: 1280, height: 800 } },
});
