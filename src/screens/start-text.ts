// What the lineups picked together say (ADR 0080), pure: the line under the lineup's header ("Jo is
// choosing · 42 s", "Jo is ready · 42 s"), the wait once locked in, and what both phones are told
// when the clock made the match ("Time ran out: Jo's lineup was finished at random").
import type { StartView } from '../api/start.ts';
import type { NoticeContent } from '../ui/notice-content.ts';

/** The other player's name as the lineup screens say it. */
const nameOf = (view: Pick<StartView, 'they'>): string => view.they ?? 'Your friend';

/** The line under the lineup's header while this player chooses. */
export function startLine(view: StartView, seconds: number): string {
  const state = view.theirsLocked ? 'is ready' : 'is choosing';
  return `${nameOf(view)} ${state} · ${String(seconds)} s`;
}

/**
 * What both phones are told when the clock made the match: whose lineup was finished at random, or
 * who never opened it (that match is lost by forfeit). Undefined when both locked in.
 */
export function startMadeLine(view: StartView): string | undefined {
  const they = nameOf(view);
  const { you, missed, filled } = view;
  if (missed.length === 2) return 'Time ran out: neither lineup was opened.';
  if (missed.includes(you)) return 'Time ran out before you opened your lineup.';
  if (missed.length === 1) return `Time ran out: ${they} never opened their lineup.`;
  const yours = filled.includes(you);
  const theirs = filled.some((side) => side !== you);
  if (yours && theirs) return 'Time ran out: both lineups were finished at random.';
  if (yours) return 'Time ran out: your lineup was finished at random.';
  if (theirs) return `Time ran out: ${they}’s lineup was finished at random.`;
  return undefined;
}

/**
 * The notice in the lineup's place: waiting for the other's lineup (`seconds` left, Home), or, with
 * `made`, what the clock decided on the way into the match (Go to match).
 */
export function startWaiting(
  view: StartView,
  how: {
    readonly seconds?: number;
    readonly made?: string;
    readonly home: () => void;
    readonly go?: () => void;
  },
): NoticeContent {
  const { made, go } = how;
  if (made !== undefined && go !== undefined) {
    return {
      title: 'Your lineup',
      waiting: { title: 'Into the match', line: made },
      body: [],
      buttons: [{ text: 'Go to match', onClick: go }],
    };
  }
  return {
    title: 'Your lineup',
    waiting: {
      title: `Waiting for ${nameOf(view)}’s lineup`,
      line: `The match starts when it’s in · ${String(how.seconds ?? 0)} s left`,
    },
    body: [],
    // Waiting, nothing is the player's to do: Home is the way out, never the main action, in the
    // footer as on every waiting screen (the series by turns' too).
    buttons: [{ text: 'Home', onClick: how.home, plain: true }],
  };
}
