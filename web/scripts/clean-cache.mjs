import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const dirsToRemove = [
  ".next",
  "node_modules/.cache",
  "dist",
  "build",
  ".tailwindcache",
  ".postcss-cache"
];

for (const rel of dirsToRemove) {
  const target = resolve(cwd, rel);
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  console.log(`[clean:cache] removed directory: ${rel}`);
}

for (const entry of readdirSync(cwd)) {
  if (!entry.endsWith(".tsbuildinfo")) continue;
  rmSync(resolve(cwd, entry), { force: true });
  console.log(`[clean:cache] removed file: ${entry}`);
}

console.log("[clean:cache] cache cleanup script finished.");
