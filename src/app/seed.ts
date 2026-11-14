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

/**
 * Reads the ruleset version a link was made under (`v=`, ADR 0022). A link from before versions,
 * or with a version that isn't a plain positive integer, reads as 0: unversioned, so older than
 * every ruleset.
 */
export function parseVersion(raw: string | null): number {
  return parseSeed(raw) ?? 0;
}
