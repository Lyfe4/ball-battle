// Where a fresh seed comes from: every new match, series, rematch and home demo. In its own module
// so the browser test projects can swap it for pinned seeds (src/flows/fixed-seed.ts,
// vite.config.ts) without the shipped page knowing about tests.

/** A fresh random seed. Uses crypto, so it is only for app code, never the sim. */
export function generateSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
