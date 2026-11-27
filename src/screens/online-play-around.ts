// What surrounds an online series' panel (online-play.ts): the notice in its place (a failure,
// nothing to show), its skeleton while a cold series loads (ADR 0054), and, by turns between its
// fights, the page frame's header row over it (turns-frame.ts).
import { createNotice, type Notice } from '../ui/notice.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import type { OnlinePlayHost } from './online-play-types.ts';
import { createTurnsFrame, type TurnsFrame } from './turns-frame.ts';

export interface SeriesAround {
  readonly notice: Notice;
  readonly frame: TurnsFrame;
}

export function createSeriesAround(
  roots: {
    readonly panel: HTMLElement;
    readonly notice: HTMLElement;
    readonly loading: HTMLElement;
  },
  host: Pick<OnlinePlayHost, 'home' | 'back'>,
): SeriesAround {
  const home = () => {
    host.home();
  };
  // Opened cold (a link, a reload): the pick screen's layout until the first answer (ADR 0054).
  createSkeleton(roots.loading, 'series', home);
  return {
    notice: createNotice(roots.notice, home),
    frame: createTurnsFrame(roots.panel, host.back ?? home),
  };
}
