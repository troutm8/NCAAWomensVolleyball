// Captures screenshots of the main pages for a quick visual check. Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
fs.mkdirSync(out, { recursive: true });
let browser;
try {
  browser = await chromium.launch();
} catch {
  // The container ships a Chromium that may not match this Playwright version.
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
}
for (const [name, path, width] of [
  ["home", "/", 1280],
  ["home-mobile", "/", 390],
  ["team", "/teams/stanford", 1280],
  ["scores", "/scores?date=2026-10-09", 1280],
  ["rankings", "/rankings", 1280],
  ["standings", "/standings?conf=acc", 1280],
  ["match", "/matches/6626343", 1280],
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await page.close();
  console.log("saved", name);
}
await browser.close();
