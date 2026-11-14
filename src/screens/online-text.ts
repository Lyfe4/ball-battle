// Online play's words (ADR 0052): the notices in place of a screen (loading, offline, nothing to
// show) and the line under a series that waits or ended without being played out. Pure.
import type { ChallengeInfo } from '../api/challenges.ts';
import type { SeriesView } from '../api/series.ts';
import { dueOf, seatsOf, timeLeft } from '../app/online-series.ts';
import { otherSide } from '../ui/series/seats.ts';
import { FORMAT_SHORT, bestOfName } from '../ui/series-text.ts';
import type { NoticeContent } from '../ui/notice.ts';

export type LoadStatus = 'loading' | 'ready' | 'offline' | 'missing' | 'error';

/** A series' or a challenge's screen while it can't be shown: always with a way on. */
export function onlineNotice(
  status: LoadStatus,
  retry: () => void,
  home: () => void,
): NoticeContent {
  const homeButton = { text: 'Home', onClick: home };
  const again = { text: 'Try again', onClick: retry };
  switch (status) {
    case 'offline':
      return {
        title: 'You’re offline',
        body: [
          'Online play needs a connection. Your series are safe on the server until you’re back.',
        ],
        buttons: [again, homeButton],
      };
    case 'missing':
      return {
        title: 'Nothing here',
        body: ['This series isn’t one of yours on this device, or it no longer exists.'],
        buttons: [homeButton],
      };
    case 'error':
      return {
        title: 'Something went wrong',
        body: ['The server couldn’t answer just now.'],
        buttons: [again, homeButton],
      };
    default:
      return { title: 'Loading…', body: [], buttons: [homeButton] };
  }
}

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
  return `Waiting for ${they}${left === undefined ? '' : ` · ${left}`}`;
}

/** "Best of 3 · Reveal": what a challenge is. */
export const challengeLine = (info: Pick<ChallengeInfo, 'format' | 'bestOf'>): string =>
  `${bestOfName(info.bestOf)} · ${FORMAT_SHORT[info.format]}`;
