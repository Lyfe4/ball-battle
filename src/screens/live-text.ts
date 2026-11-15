// A live match's words (ADR 0053, 0055), pure: the line over the series (a pick made at random,
// how it ended) and the line under a fight. Whose pick it is and the seconds left are the pick
// card's (pick-clock-text.ts). Times are the server's (ms since the epoch); the page only counts.
import type { SeriesView } from '../api/series.ts';
import { secondsUntil } from '../app/live-play.ts';
import { seatsOf } from '../app/online-series.ts';

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
 * The line over a live series with `watched` rounds watched here: a pick made at random, or how it
 * ended. Whose pick it is, the seconds left, the wait to join and an away player are the pick
 * card's (pick-clock-text.ts, ADR 0055). Undefined while there is nothing to say.
 */
export function liveNote(view: SeriesView, watched: number): string | undefined {
  const live = view.live;
  if (live === null) return undefined;
  if (view.status !== 'open') return liveEnding(view);
  if (live.startedAt === null || live.away !== null) return undefined;
  return autoNote(view, watched);
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
