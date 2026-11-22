// A rematch's words (ADR 0055), pure: the card on the end screen while one is asked (with its
// seconds, on the pick card's bar), and the line both players read when it ends without a match.
import { REMATCH_ANSWER_MS, REMATCH_LINEUP_MS, type RematchView } from '../api/rematch.ts';
import { secondsUntil } from '../app/live-play.ts';
import type { Side } from '../sim/series.ts';
import { URGENT_SECONDS, type PickClock } from './pick-clock-text.ts';

/** The end screen's card for a rematch at server time `now`, seen from `you`. */
export function rematchClockOf(
  rematch: RematchView,
  you: Side,
  they: string,
  now: number,
): PickClock | undefined {
  const { deadline } = rematch;
  if (deadline === null) return undefined;
  const total = rematch.state === 'agreed' ? REMATCH_LINEUP_MS : REMATCH_ANSWER_MS;
  const seconds = secondsUntil(deadline, now);
  const timed = {
    seconds,
    left: Math.min(1, Math.max(0, (deadline - now) / total)),
    total: total / 1000,
    urgent: seconds <= URGENT_SECONDS,
  };
  if (rematch.state === 'asked') {
    return rematch.askedBy === you
      ? { kind: 'rematch', title: `Waiting for ${they} to answer`, ...timed }
      : { kind: 'rematch', title: `${they} wants a rematch`, ...timed };
  }
  if (rematch.state === 'agreed') {
    return {
      kind: 'rematch',
      title: rematch.lineupIn ? `Waiting for ${they}’s lineup` : 'Rematch on: build your lineup',
      ...timed,
    };
  }
  return undefined;
}

/** What both players read when a rematch ends without a match; undefined otherwise. */
export function rematchEnding(rematch: RematchView, you: Side, they: string): string | undefined {
  if (rematch.state === 'declined') {
    return rematch.declinedBy === you
      ? 'You said no to a rematch.'
      : `${they} said no to a rematch.`;
  }
  return rematch.state === 'expired' ? 'No rematch: time ran out.' : undefined;
}

/** The end screen's buttons: Rematch to ask, or Rematch and No thanks to answer. */
export function rematchChoiceOf(rematch: RematchView, you: Side): 'offer' | 'answer' | undefined {
  if (rematch.state === 'none' && rematch.offered) return 'offer';
  return rematch.state === 'asked' && rematch.askedBy !== you ? 'answer' : undefined;
}

/**
 * What a player away from the end screen is told of a rematch (playtest 2026-11-19, 2026-11-23), at
 * server time `now`:
 *
 * - `asked`: the other player asks (who, the seconds to answer), with Accept and No thanks;
 * - `agreed`: both said yes and this player's lineup is still to come ("Player 4821 accepted" to
 *   the one who asked, the seconds left for the lineups), with Choose lineup;
 * - `started`: the new match began after this player's lineup was in: straight into it;
 * - `ended`: why it ended without a match, to the one who asked and to anyone who said yes (`yes`:
 *   this device saw both agree); the one who said no, or let the ask go, knows already.
 *
 * Undefined while there is nothing to say.
 */
export type RematchNotice =
  | { readonly kind: 'asked'; readonly clock: PickClock }
  | { readonly kind: 'agreed'; readonly clock: PickClock }
  | { readonly kind: 'started'; readonly seriesId: string }
  | { readonly kind: 'ended'; readonly line: string }
  /** A friend's live challenge (ADR 0079 PR (d)): its line, with Accept and No thanks. */
  | { readonly kind: 'invite'; readonly line: string };

export function rematchNoticeOf(
  rematch: RematchView,
  you: Side,
  they: string,
  now: number,
  yes = false,
): RematchNotice | undefined {
  const clock = rematchClockOf(rematch, you, they, now);
  const running = clock !== undefined && clock.seconds > 0;
  if (rematch.state === 'asked' && rematch.askedBy !== you) {
    return running ? { kind: 'asked', clock } : undefined;
  }
  if (rematch.state === 'agreed' && !rematch.lineupIn) {
    if (!running) return undefined;
    const title = rematch.askedBy === you ? `${they} accepted` : 'Rematch on: choose your lineup';
    return { kind: 'agreed', clock: { ...clock, title } };
  }
  if (rematch.state === 'started') {
    return rematch.seriesId === null ? undefined : { kind: 'started', seriesId: rematch.seriesId };
  }
  if (rematch.declinedBy === you || (rematch.askedBy !== you && !yes)) return undefined;
  const line = rematchEnding(rematch, you, they);
  return line === undefined ? undefined : { kind: 'ended', line };
}

/**
 * Whether a rematch can still move: asked for, being asked, or both said yes and the new match yet
 * to start (this player's lineup to come, or in and waiting for the other's).
 */
export const rematchOpen = (rematch: RematchView): boolean =>
  (rematch.state === 'none' && rematch.offered) ||
  rematch.state === 'asked' ||
  rematch.state === 'agreed';

/**
 * Home's way back to a rematch that waits on this player (2026-11-23): the end screen while the one
 * who asked waits for the answer (`answer`), or the lineup once both said yes (`lineup`).
 */
export type RematchBack = 'answer' | 'lineup';

export function rematchBackOf(
  rematch: RematchView,
  you: Side,
  now: number,
): RematchBack | undefined {
  const open = rematch.deadline !== null && rematch.deadline > now;
  if (!open) return undefined;
  if (rematch.state === 'asked' && rematch.askedBy === you) return 'answer';
  return rematch.state === 'agreed' && !rematch.lineupIn ? 'lineup' : undefined;
}
