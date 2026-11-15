import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: { baseURL: "http://127.0.0.1:3101", trace: "off" },
  projects: [{ name: "local-backend", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: [
    {
      command: "../.venv/bin/python -m uvicorn backend.app.main:app --app-dir .. --host 127.0.0.1 --port 8101",
      url: "http://127.0.0.1:8101/api/health",
      reuseExistingServer: false,
      env: {
        BARTR_STORAGE: "memory", BARTR_ALLOW_LOCAL_STORAGE: "true", WEB_ORIGINS: "http://127.0.0.1:3101", COOKIE_SECURE: "false",
        GEMINI_API_KEY: "", AWS_REGION: "", BEDROCK_EMBEDDING_MODEL: "",
      },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BARTR_NEXT_DIST_DIR: ".next-backend", API_BASE_URL: "http://127.0.0.1:8101", NEXT_PUBLIC_USE_SEED_DATA: "false", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
