import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// One source of truth for the release number. Each deployment also gets
// its own build timestamp and Git commit identifier without a data migration.
export default defineConfig({
  plugins: [react()],
  define: {
    __WIMM_APP_VERSION__: JSON.stringify(pkg.version),
    __WIMM_BUILD_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local"),
    __WIMM_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
});
