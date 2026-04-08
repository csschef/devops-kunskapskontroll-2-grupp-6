import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(fileName) {
  const absolutePath = path.resolve(process.cwd(), fileName);
  if (!existsSync(absolutePath)) return;

  const fileContent = readFileSync(absolutePath, "utf8");
  for (const line of fileContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const quotedValue = rawValue.replace(/^['\"]|['\"]$/g, "");

    if (!key) continue;
    if (typeof process.env[key] !== "undefined") continue;

    process.env[key] = quotedValue;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173",
  },
});