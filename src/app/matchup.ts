/** Which two balls fight: definition ids for slot A (left) and slot B (right). */
export interface Matchup {
  readonly a: string;
  readonly b: string;
}

/** Two different balls, so a first-time visitor sees abilities interact. */
export const DEFAULT_MATCHUP: Matchup = { a: 'speedster', b: 'vampire' };

/**
 * Reads `?a=` and `?b=` from URL parameters. Ids are trimmed and lowercased; a missing or unknown
 * id falls back to that slot's default, so a shared link with a typo still opens a match rather
 * than an error. Mirror matches are allowed.
 */
export function parseMatchup(
  params: URLSearchParams,
  validIds: readonly string[],
  defaults: Matchup = DEFAULT_MATCHUP,
): Matchup {
  const read = (key: 'a' | 'b'): string => {
    const id = params.get(key)?.trim().toLowerCase();
    return id !== undefined && validIds.includes(id) ? id : defaults[key];
  };
  return { a: read('a'), b: read('b') };
}

/** Writes the matchup and seed into URL parameters, keeping any other parameters. */
export function writeMatchParams(params: URLSearchParams, matchup: Matchup, seed: number): void {
  params.set('a', matchup.a);
  params.set('b', matchup.b);
  params.set('seed', String(seed));
}
