// A live match's words (ADR 0053), pure: the line under the series (whose pick, the seconds left,
// a pick made at random, the opponent gone quiet, how it ended) and the one line both players see
// before it starts. Times are the server's (ms since the epoch); the page only counts down.
import { GRACE_MS } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { secondsUntil } from '../app/live-play.ts';
import { dueOf, seatsOf } from '../app/online-series.ts';

/** Said once before a live match starts, to both players (decision 3). */
export const STAY_LINE = `Stay until the end. Leaving for ${String(GRACE_MS / 1000)} s loses the match.`;

/** How a live series ended early, from the viewer's side; undefined when it was played out. */
export function liveEnding(view: SeriesView): string | undefined {
  const { they } = seatsOf(view);
  const won = view.winner === view.you;
  switch (view.live?.endReason) {
    case 'left':
      return won ? `${they} left the match. You win.` : 'You left the match.';
    case 'disconnected':
      return won ? `${they} disconnected. You win.` : 'You were away too long and lost.';
    case 'start_missed':
      if (view.winner === null) return 'Neither player arrived. Nobody wins.';
      return won ? `${they} didn’t arrive. You win.` : 'You didn’t arrive in time.';
    default:
      return view.status === 'void' ? 'This match was called off. Nobody wins.' : undefined;
  }
}

/** A pick the server made at random in the round now being decided or just played. */
function autoNote(view: SeriesView, watched: number): string | undefined {
  const { they } = seatsOf(view);
  const recent = (view.live?.auto ?? []).filter((pick) => pick.round >= watched - 1);
  if (recent.some((pick) => pick.side === view.you)) {
    return 'Time’s up: a random ball was picked for you.';
  }
  return recent.length > 0 ? `${they} ran out of time: a random ball was picked.` : undefined;
}

/**
 * The line under a live series at server time `now` with `watched` rounds watched here: why it
 * waits and for how long, or how it ended. Undefined while there is nothing to say.
 */
export function liveNote(view: SeriesView, now: number, watched: number): string | undefined {
  const live = view.live;
  if (live === null) return undefined;
  const { they } = seatsOf(view);
  if (view.status !== 'open') return liveEnding(view);
  if (live.startedAt === null) {
    return `Waiting for ${they} to join · ${String(secondsUntil(live.startBy, now))} s. ${STAY_LINE}`;
  }
  if (live.away !== null) {
    return `${they} disconnected · waiting ${String(secondsUntil(live.away.forfeitAt, now))} s`;
  }
  const deadline = view.deadline === null ? undefined : Date.parse(view.deadline);
  if (deadline === undefined || live.opensAt === null || now < live.opensAt) return undefined;
  const left = `${String(secondsUntil(deadline, now))} s`;
  const turn = dueOf(view).includes(view.you)
    ? `Your pick · ${left}`
    : `Waiting for ${they} · ${left}`;
  const auto = autoNote(view, watched);
  return auto === undefined ? turn : `${auto} ${turn}`;
}

/** The line under the court in a live fight, where the speed toggle would be. */
export function liveFootLine(view: SeriesView, now: number, reconnecting: boolean): string {
  if (reconnecting) return 'Reconnecting…';
  const away = view.live?.away;
  if (view.status === 'open' && away != null) {
    const { they } = seatsOf(view);
    return `${they} disconnected · ${String(secondsUntil(away.forfeitAt, now))} s`;
  }
  return 'Live · normal speed';
}
