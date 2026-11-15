// Where a live series is at a moment of the server's clock (ADR 0053), pure. The server times each
// round's fight; a drawn round is fought again straight after, each attempt for its own watching
// time (`attemptWatchMs`, the same function the server timed it with). So a page that comes back,
// or opens the series late, knows which rounds have already been fought, which attempt is on now
// and how far into it, and fights it from there: both screens show the same moment.
import { attemptWatchMs, COUNTDOWN_MS } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';

/** One attempt of a round on the server's clock (ms since the epoch). */
export interface AttemptSlot {
  readonly round: number;
  readonly attempt: number;
  readonly startAt: number;
  readonly endAt: number;
}

/** Each attempt of a fight, one after the other from its Fight!. `ticks` is each one's length. */
export function attemptSlots(
  fight: { readonly round: number; readonly fightAt: number },
  ticks: readonly number[],
): AttemptSlot[] {
  let startAt = fight.fightAt;
  return ticks.map((length, attempt) => {
    const slot = { round: fight.round, attempt, startAt, endAt: startAt + attemptWatchMs(length) };
    startAt = slot.endAt;
    return slot;
  });
}

export interface LivePlace {
  /** Rounds over by now: watched here or not, they count as seen. */
  readonly watched: number;
  /** The attempt on screen now or next (before its Fight!), if a fight is still to come. */
  readonly slot: AttemptSlot | undefined;
}

/**
 * Where the series is at `now` for a page that has watched `watched` rounds: every round whose
 * fight has ended counts as watched, and the next round's attempt that hasn't ended is the one to
 * show (held until its start, or part-way through). `ticksOf` says how long each attempt of a round
 * is, in ticks (the page plays it headlessly from its revealed seed).
 */
export function livePlace(
  view: SeriesView,
  watched: number,
  now: number,
  ticksOf: (round: number) => readonly number[],
): LivePlace {
  const fights = view.live?.fights ?? [];
  let seen = Math.min(watched, view.rounds.length);
  for (;;) {
    const fight = fights.find((f) => f.round === seen);
    if (fight === undefined || seen >= view.rounds.length)
      return { watched: seen, slot: undefined };
    if (fight.endsAt > now) {
      const slot = attemptSlots(fight, ticksOf(seen)).find((s) => s.endAt > now);
      return { watched: seen, slot };
    }
    seen += 1;
  }
}

/** Whole seconds left until `at`, never negative: a countdown's number. */
export const secondsUntil = (at: number, now: number): number =>
  Math.max(0, Math.ceil((at - now) / 1000));

/** A page that learned of a round this little short of the whole 3-2-1 still shows all of it. */
const COUNTDOWN_SLACK_MS = 200;

/**
 * The ready card's line before a live fight that starts at `startAt` (ADR 0054): "Get ready", then
 * the 3-2-1 over its last COUNTDOWN_MS, each number for a whole second. A page that learned of the
 * round (`learnedAt`) too late for the whole 3-2-1 keeps "Get ready" until the fight starts: it never
 * joins the count part-way.
 */
export function countdownLine(startAt: number, now: number, learnedAt: number): string {
  const late = startAt - learnedAt < COUNTDOWN_MS - COUNTDOWN_SLACK_MS;
  const left = startAt - now;
  if (late || left > COUNTDOWN_MS) return 'Get ready';
  return `Fight in ${String(secondsUntil(startAt, now))}…`;
}

/** Ms until the countdown's line next changes, or undefined once the fight has started. */
export function nextLineChange(startAt: number, now: number): number | undefined {
  const left = startAt - now;
  if (left <= 0) return undefined;
  if (left > COUNTDOWN_MS) return left - COUNTDOWN_MS;
  return left % 1000 === 0 ? 1000 : left % 1000;
}
