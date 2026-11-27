// The pick card of a live match (ADR 0055, B2), pure: whose turn it is, the seconds left and how
// much of the whole time that is, whether to hurry, and for the player who waits, what the other is
// answering and what happens next. The same card on both phones; before the match starts it waits
// for the friend to join, and while one player is away it counts their grace down. Times are the
// server's (ms since the epoch); the page only counts down.
import { GRACE_MS, PICK_SECONDS, START_WINDOW_MS } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { secondsUntil } from '../app/live-play.ts';
import { dueOf, seatsOf } from '../app/online-series.ts';
import { otherSide, type SeriesState } from '../sim/series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { pickChoiceOf } from '../ui/series/series-view.ts';

/** From here down the card turns the accent yellow: urgent, never alarming (no red, no flash). */
export const URGENT_SECONDS = 10;

export interface PickClock {
  /** The player's pick, the other's, the friend not yet arrived, the other away, a rematch. */
  readonly kind: 'yours' | 'theirs' | 'join' | 'away' | 'rematch';
  /** "Your pick", "Player 4821 is picking", "Waiting for Player 6338 to join". */
  readonly title: string;
  /** Whole seconds left, as the card shows them. */
  readonly seconds: number;
  /** How much of the whole time is left, 0 to 1: the bar's length. */
  readonly left: number;
  /** The whole time in seconds (30 a pick): with reduced motion the bar steps by these. */
  readonly total: number;
  readonly urgent: boolean;
  /**
   * The player waits on the other (their pick, their arrival, their answer, their lineup): the card
   * shows its waiting dots (ADR 0087 addendum of 2026-11-27: every wait on another player shows).
   */
  readonly waiting?: boolean;
  /** The waiting player's line: what the other is answering, and the balls they pick from. */
  readonly answering?: { readonly line: string; readonly from: readonly string[] };
  /** What happens next, under the track. */
  readonly next?: string;
}

function timed(until: number, total: number, now: number) {
  const seconds = secondsUntil(until, now);
  const left = Math.min(1, Math.max(0, (until - now) / total));
  return { seconds, left, total: total / 1000, urgent: seconds <= URGENT_SECONDS };
}

/**
 * The card for a live series at server time `now`, with `state` the series as watched here (every
 * round watched); undefined when there is no clock to show (a fight on, or the match over).
 */
export function pickClockOf(
  view: SeriesView,
  state: SeriesState,
  now: number,
  lookup: DefinitionLookup,
): PickClock | undefined {
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  const live = view.live;
  if (live === null || view.status !== 'open') return undefined;
  const { they } = seatsOf(view);
  if (live.startedAt === null) {
    return {
      kind: 'join',
      title: `Waiting for ${they} to join`,
      ...timed(live.startBy, START_WINDOW_MS, now),
      next: 'The match starts as soon as they arrive.',
    };
  }
  if (live.away !== null) {
    return {
      kind: 'away',
      title: `${they} disconnected`,
      ...timed(live.away.forfeitAt, GRACE_MS, now),
      next: 'If they don’t come back in time, you win.',
    };
  }
  const deadline = view.deadline === null ? undefined : Date.parse(view.deadline);
  if (deadline === undefined || live.opensAt === null || now < live.opensAt) return undefined;
  const clock = timed(deadline, PICK_SECONDS * 1000, now);
  const due = dueOf(view);
  if (pickChoiceOf(state, view.you, due) !== undefined) {
    return { kind: 'yours', title: 'Your pick', ...clock };
  }
  const theirs = pickChoiceOf(state, otherSide(view.you), due);
  if (theirs === undefined) return undefined;
  const mine = state.picks.find(
    (pick) => pick.round === state.rounds.length && pick.side === view.you,
  )?.ball;
  const line =
    theirs.kind === 'answer' && theirs.facing !== undefined
      ? `You showed ${nameOf(theirs.facing)}. They answer from:`
      : theirs.kind === 'show'
        ? 'They show first, from:'
        : mine === undefined
          ? 'They pick from:'
          : `You picked ${nameOf(mine)}. They pick from:`;
  return {
    kind: 'theirs',
    title: `${they} is picking`,
    ...clock,
    answering: { line, from: theirs.options },
    next: theirs.kind === 'show' ? 'Then you answer.' : 'You’ll fight as soon as they pick.',
  };
}
