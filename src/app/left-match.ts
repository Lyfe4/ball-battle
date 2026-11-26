// The player left a live match (Leave and forfeit, ADR 0053): Home tells them once, "You left: Jo
// wins" (ADR 0086), the other player being told on their own end screen. A note in memory for this
// page only, taken (and so cleared) by the first Home to show it.
let leftTo: string | undefined;

/** Left a live match against `they` (their name, or a placeholder for a deleted player). */
export function noteLeft(they: string): void {
  leftTo = they;
}

/** Who won the match just left, if one was; said only this once. */
export function takeLeft(): string | undefined {
  const they = leftTo;
  leftTo = undefined;
  return they;
}

/** What Home says once: "You left: Jo wins". */
export const leftLine = (they: string): string => `You left: ${they} wins`;
