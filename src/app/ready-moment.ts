// Whether a match waits on its ready moment's Fight! (ADR 0037), and whether its card says what to
// watch, by what the arena is showing. Pure: the ready card (src/ui/ready-card.ts) asks it.

/**
 * What the arena is showing: the home demo (`still` while it waits on a still frame under reduced
 * motion, ADR 0055: the pairing shows over it, so it reads as a picture), a Free play match, a
 * series round, or a live round (ADR 0053), which starts at the server's time on both screens: a
 * countdown, no Fight!.
 */
export type ReadyMoment = 'demo' | 'still' | 'quick' | 'series' | 'live';

/** Whether a match waits on Fight!, and whether its card says what to watch. */
export function readyFor(moment: ReadyMoment, cardDue: boolean): { held: boolean; card: boolean } {
  if (moment === 'demo' || moment === 'still') return { held: false, card: false };
  // Live: every round waits for its server time (6 s: Get ready, then the 3-2-1, ADR 0054), long
  // enough to read what to watch; the card goes with the sticker at Fight!, so it never delays it.
  if (moment === 'live') return { held: true, card: cardDue };
  return { held: moment === 'series' || cardDue, card: cardDue };
}
