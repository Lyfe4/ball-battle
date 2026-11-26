// What an online series screen adds to the shared series panel (ADR 0052, 0053, 0055): a live
// match's pick card above the track, the fair-play line under it at the end, and the rematch the
// end of a live match offers. online-play.ts asks it, every display tick, what the panel's online
// part says (`moment`), then shows the card and the line for the phase the panel chose (`shown`).
import type { SeriesView } from '../api/series.ts';
import { liveTossOf } from '../app/coin-toss.ts';
import type { FairPlay } from '../app/online-series.ts';
import { writeOnlineSeriesParams } from '../app/online-url.ts';
import { replaysHere } from '../sim/ruleset.ts';
import type { SeriesState } from '../sim/series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import type { SeriesPhase } from '../ui/series-panel.ts';
import { createFairPlayLine } from '../ui/series/fair-play.ts';
import { createPickClock } from '../ui/series/pick-clock.ts';
import type { SeriesMoment } from '../ui/series/series-view.ts';
import { liveNote } from './live-text.ts';
import { createOnlineRematch, type OnlineRematch } from './online-rematch.ts';
import { OLDER_VERSION, waitNote } from './online-text.ts';
import { pickClockOf } from './pick-clock-text.ts';

export interface ExtrasHost {
  go(write: (params: URLSearchParams) => void): void;
  primeSeries(id: string): Promise<void>;
  redraw(): void;
  /** The end screen's rematch moved (asked, answered, ended): a waiting banner may now show. */
  readonly rematchMoved?: () => void;
}

/** Where the series stands this tick, as the extras need it. */
export interface ExtrasTick {
  readonly view: SeriesView;
  readonly state: SeriesState;
  /** The server's clock (live) or this device's. */
  readonly now: number;
  readonly live: boolean;
  /** Every round played has been watched here. */
  readonly all: boolean;
  readonly watched: number;
  readonly visible: boolean;
}

export interface SeriesExtras {
  readonly rematch: OnlineRematch;
  /** The panel's online part this tick: the note, live or not, the end's rematch buttons. */
  moment(tick: ExtrasTick): NonNullable<SeriesMoment['online']>;
  /** Shows the pick card and the fair-play line for the panel's `phase`. */
  shown(tick: ExtrasTick, phase: SeriesPhase, fair: FairPlay | 'checking' | undefined): void;
}

export function createSeriesExtras(
  panel: HTMLElement,
  lookup: DefinitionLookup,
  host: ExtrasHost,
): SeriesExtras {
  const clock = createPickClock(lookup, panel);
  const fairLine = createFairPlayLine();
  panel.querySelector('#series-track')?.after(fairLine.element);
  const rematch = createOnlineRematch({
    go: (write) => {
      host.go(write);
    },
    intoSeries: async (id) => {
      await host.primeSeries(id);
      host.go((url) => {
        writeOnlineSeriesParams(url, id);
      });
    },
    changed: () => {
      host.redraw();
      host.rematchMoved?.();
    },
  });

  return {
    rematch,
    moment(tick) {
      const { view, live, all } = tick;
      rematch.watch(live && all ? view : undefined, tick.visible);
      const ended = view.status !== 'open';
      const older = ended && !replaysHere(view.ruleset);
      const said = live
        ? (rematch.note() ?? liveNote(view, tick.watched))
        : waitNote(view, Date.now());
      // An older ruleset's series (ADR 0088): its result, and why its fights don't show.
      const note = older ? [said, OLDER_VERSION].filter(Boolean).join(' ') : said;
      const choice = rematch.choice();
      const toss = live ? liveTossOf(view) : undefined;
      return {
        note: all ? note : undefined,
        live,
        // Live, played out or forfeit while this page still shows a fight of it: nothing to leave.
        over: live && view.status !== 'open',
        ...(choice === undefined ? {} : { rematch: choice }),
        // Watch again where it replays here, once nothing else is asked (ADR 0088).
        watchAgain: all && ended && !older && view.status !== 'void' && choice === undefined,
        ...(toss === undefined ? {} : { toss }),
      };
    },
    shown(tick, phase, fair) {
      const { view, all } = tick;
      fairLine.show(all && phase === 'finished' ? fair : undefined);
      const timed = tick.live && all && phase !== 'playing';
      clock.show(
        timed ? (pickClockOf(view, tick.state, tick.now, lookup) ?? rematch.clock()) : undefined,
      );
    },
  };
}
