const MAX_SEED = 0xffff_ffff;

/**
 * Reads a seed from a URL parameter. Accepts only plain decimal integers in the uint32 range, so
 * a typo or tampered link yields undefined (and a fresh seed) rather than NaN or a silently
 * wrapped value that would not match what the user typed.
 */
export function parseSeed(raw: string | null): number | undefined {
  if (raw === null || !/^\d{1,10}$/.test(raw.trim())) return undefined;
  const seed = Number(raw.trim());
  return seed <= MAX_SEED ? seed : undefined;
}

/** A fresh random seed. Uses crypto, so it is only for app code, never the sim. */
export function generateSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
