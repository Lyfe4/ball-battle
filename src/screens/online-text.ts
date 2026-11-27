// Online play's words (ADR 0052): the notices in place of a screen (loading, a failure, nothing
// to show) and the line under a series that waits or ended without being played out. Pure.
import type { ChallengeInfo } from '../api/challenges.ts';
import type { ErrorCode } from '../api/errors.ts';
import type { SeriesView } from '../api/series.ts';
import type { FailureKind } from '../app/api.ts';
import { dueOf, seatsOf, timeLeft } from '../app/online-series.ts';
import { otherSide } from '../ui/series/seats.ts';
import { failureText } from './online-failure-text.ts';
import { FORMAT_SHORT, bestOfName } from '../ui/series-text.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import type { WaitingContent } from '../ui/waiting-content.ts';

export type LoadStatus = 'loading' | 'ready' | 'missing' | FailureKind;

/**
 * A series' or a challenge's screen while it can't be shown: always with a way on. A failure says
 * what failed (`failureText`; `reason` is a refusal's message from the server), with Try again.
 * Loading is never a notice: the screen's own layout shows meanwhile (skeleton.ts, ADR 0054).
 */
export function onlineNotice(
  status: Exclude<LoadStatus, 'loading' | 'ready'>,
  /** A request: Try again shows it is working until it settles. */
  retry: () => Promise<unknown>,
  home: () => void,
  reason?: string,
  /** A refusal's code: the game's own words where it has them (ADR 0086). */
  code?: ErrorCode,
): NoticeContent {
  const homeButton = { text: 'Home', onClick: home };
  switch (status) {
    case 'missing':
      return {
        title: 'Nothing here',
        body: ['This series isn’t one of yours on this device, or it no longer exists.'],
        buttons: [homeButton],
      };
    default: {
      const { title, body } = failureText(status, reason, code);
      return { title, body: [body], buttons: [{ text: 'Try again', onClick: retry }, homeButton] };
    }
  }
}

/**
 * A finished series under a ruleset whose fights this page doesn't play (`replaysHere`, ADR 0088):
 * its result is shown, its fights aren't, and there is no Watch again.
 */
export const OLDER_VERSION =
  'Played on an older version of the game: the result stands, but its fights can’t be shown here.';

/**
 * The line under a series: whose turn it is and the time left, or how it ended without being
 * played out (a forfeit, a series called off). Undefined when the screens say it all.
 */
export function waitNote(view: SeriesView, now: number): string | undefined {
  const { they } = seatsOf(view);
  const them = otherSide(view.you);
  if (view.status === 'void') return 'This series was called off. Nobody wins.';
  if (view.status === 'forfeit') {
    if (view.winner === null) return 'Both players ran out of time. Nobody wins.';
    if (view.names[them] === null && view.winner === view.you) return `${they} left the game.`;
    return view.winner === view.you ? `${they} ran out of time.` : 'You ran out of time.';
  }
  if (view.status !== 'open') return undefined;
  const left = timeLeft(view.deadline, now);
  const yours = dueOf(view).includes(view.you);
  if (yours) return left === undefined ? undefined : `Your turn · ${left}`;
  // Waiting on the other's pick: the waiting card says it (`turnWaiting`), not a line.
  return undefined;
}

/**
 * By turns, waiting on the other player's pick: the waiting card (waiting.ts), with their disc and
 * the time they have left. Undefined when it is the player's turn or the series is over.
 */
export function turnWaiting(view: SeriesView, now: number): WaitingContent | undefined {
  if (view.status !== 'open' || dueOf(view).includes(view.you)) return undefined;
  const { they } = seatsOf(view);
  const left = timeLeft(view.deadline, now);
  return {
    title: `Waiting for ${they}`,
    line: left === undefined ? 'It’s their pick' : `It’s their pick · ${left}`,
    ...(view.names[otherSide(view.you)] === null ? {} : { who: they }),
  };
}

/** "Best of 3 · Reveal": what a challenge is. */
export const challengeLine = (info: Pick<ChallengeInfo, 'format' | 'bestOf'>): string =>
  `${bestOfName(info.bestOf)} · ${FORMAT_SHORT[info.format]}`;
