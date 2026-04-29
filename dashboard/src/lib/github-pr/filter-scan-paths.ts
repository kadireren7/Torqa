const NOISE_JSON = new Set(
  [
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ].map((s) => s.toLowerCase())
);

function pathHasNoisePrefix(lowerPath: string): boolean {
  const prefixes = ["node_modules/", ".next/", "dist/", "build/", ".git/", "coverage/", "__pycache__/"];
  for (const p of prefixes) {
    if (lowerPath.startsWith(p) || lowerPath.includes(`/${p}`)) return true;
  }
  return false;
}

/**
 * Paths to scan for Torqa heuristics: `.tq`, `.json` (excluding obvious lock/build noise).
 */
export function filterScanPaths(filenames: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of filenames) {
    const p = raw.trim().replace(/\\/g, "/");
    if (!p || seen.has(p)) continue;
    const lower = p.toLowerCase();
    if (pathHasNoisePrefix(lower)) continue;
    if (p.endsWith(".tq")) {
      seen.add(p);
      out.push(p);
      continue;
    }
    if (p.endsWith(".json")) {
      const base = lower.split("/").pop() ?? lower;
      if (NOISE_JSON.has(base)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
