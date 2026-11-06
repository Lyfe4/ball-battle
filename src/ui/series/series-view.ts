// What the best-of-3 screens show, as pure functions of the series state, so the visuals (the
// round track, the pick rows, the next pairing; ADR 0025) are tested without a DOM. Only what the
// player is allowed to know is ever returned: the bot's hidden balls are `undefined`.
import {
  awaitingPick,
  formatOf,
  LINEUP_SIZE,
  nextBallOf,
  nextMatch,
  remainingOf,
  type NextMatch,
  type SeriesState,
  type Side,
} from '../../sim/series.ts';

/** One side of one round on the track. */
export interface TrackCell {
  /** The ball, when the player may know it. */
  readonly ball?: string;
  /** Reveal and Showdown: the bot's balls not yet played, any of which may come next. */
  readonly pool?: readonly string[];
  readonly result?: 'won' | 'lost';
}

export interface TrackColumn {
  /** 0-based. */
  readonly round: number;
  /** Played, the one being played or coming next, or later. */
  readonly when: 'played' | 'now' | 'later';
  readonly you: TrackCell;
  readonly bot: TrackCell;
  /** Draws replayed in this round (↻). */
  readonly draws: number;
  /** All three plays drew and a coin decided it (⚡). */
  readonly suddenDeath: boolean;
}

const picked = (state: SeriesState, round: number, side: Side) =>
  state.picks.find((pick) => pick.round === round && pick.side === side)?.ball;

/** Formats where both lineups are revealed and every ball is picked round by round. */
const isOpen = (state: SeriesState) => formatOf(state.setup) !== 'blind';

/**
 * The ball a side plays in the round coming up, if the player may know it. In Reveal and Showdown
 * a ball is known once picked, or when it is the last one left (round 3); in a blind series the
 * bot's lineup stays hidden and the player knows their own order. A bot's pick is only ever here
 * once it is made, so no screen can show a choice the bot hasn't made.
 */
export function knownNextBall(state: SeriesState, side: Side): string | undefined {
  const round = state.rounds.length;
  const left = remainingOf(state, side);
  if (isOpen(state)) return picked(state, round, side) ?? (left.length === 1 ? left[0] : undefined);
  return side === 'a' ? nextBallOf(state, 'a') : undefined;
}

/** Every round of the series as the track shows it: played, now, later (only rounds to play). */
export function trackOf(state: SeriesState, current: NextMatch | undefined): TrackColumn[] {
  const format = formatOf(state.setup);
  const played = state.rounds.length;
  const total = state.winner === undefined ? LINEUP_SIZE : played;
  return Array.from({ length: total }, (_, round): TrackColumn => {
    const record = state.rounds[round];
    if (record !== undefined) {
      const result = (side: Side) => (record.winner === side ? 'won' : 'lost');
      return {
        round,
        when: 'played',
        you: { ball: record.a, result: result('a') },
        bot: { ball: record.b, result: result('b') },
        draws: record.suddenDeath ? 0 : record.outcomes.length - 1,
        suddenDeath: record.suddenDeath,
      };
    }
    if (round === played) {
      const match = current?.round === round ? current : undefined;
      const botBall = match?.b ?? knownNextBall(state, 'b');
      const pool = remainingOf(state, 'b');
      return {
        round,
        when: 'now',
        you: { ...optional(match?.a ?? knownNextBall(state, 'a')) },
        bot: botBall === undefined && format !== 'blind' ? { pool } : { ...optional(botBall) },
        draws: state.pending.length,
        suddenDeath: false,
      };
    }
    // Later rounds: in a blind series the player's own order is set; everything else is open,
    // except that in Reveal and Showdown the bot's balls not yet in a column wait under the next round.
    const own = format === 'blind' ? remainingOf(state, 'a')[round - played] : undefined;
    const nowBall = current?.round === played ? current.b : knownNextBall(state, 'b');
    const waiting = remainingOf(state, 'b').filter((id) => id !== nowBall);
    const pool = format !== 'blind' && round === played + 1 && nowBall !== undefined;
    return {
      round,
      when: 'later',
      you: { ...optional(own) },
      bot: pool ? { pool: waiting } : {},
      draws: 0,
      suddenDeath: false,
    };
  });
}

const optional = (ball: string | undefined) => (ball === undefined ? {} : { ball });

/**
 * A choice the player is asked for (ADR 0035): never what the bot will do, only how each of the
 * player's balls stands against every ball the bot still has, so the player makes their own read.
 */
export interface PickChoice {
  /**
   * `answer`: the bot showed its ball first; `show`: the player shows first and the bot answers;
   * `open`: Showdown's round 1, both picking at the same time.
   */
  readonly kind: 'answer' | 'show' | 'open';
  /** `answer`: the bot's ball being answered. */
  readonly facing?: string;
  /** The player's balls to choose from. */
  readonly options: readonly string[];
  /** Every ball the bot still has: the columns each option is marked against. */
  readonly opponents: readonly string[];
}

/** The pick the player must make now, if any (a Reveal or Showdown turn). */
export function pickChoiceOf(state: SeriesState): PickChoice | undefined {
  if (awaitingPick(state) !== 'a') return undefined;
  const options = remainingOf(state, 'a');
  const opponents = remainingOf(state, 'b');
  const round = state.rounds.length;
  const facing = picked(state, round, 'b');
  if (facing !== undefined) return { kind: 'answer', facing, options, opponents };
  const opening = formatOf(state.setup) === 'showdown' && round === 0;
  return { kind: opening ? 'open' : 'show', options, opponents };
}

/** The coming round when nothing is asked of the player: its balls as far as the player knows. */
export interface Pairing {
  readonly round: number;
  readonly you: string | undefined;
  readonly bot: string | undefined;
  /** Above 0 when a drawn round is replayed. */
  readonly attempt: number;
}

export function pairingOf(state: SeriesState): Pairing | undefined {
  if (state.winner !== undefined || awaitingPick(state) === 'a') return undefined;
  const next = nextMatch(state);
  return {
    round: state.rounds.length,
    you: next?.a ?? knownNextBall(state, 'a'),
    bot: knownNextBall(state, 'b') ?? (isOpen(state) ? next?.b : undefined),
    attempt: next?.attempt ?? 0,
  };
}

/** What the player can do next on a series screen: every screen but a fight offers one or more. */
export type SeriesAction = 'pick' | 'play' | 'rematch' | 'newSeries';

/** Where the series is: a round being fought, the screen between rounds, or the result. */
export type SeriesPhase = 'playing' | 'between' | 'finished';

export interface SeriesMoment {
  readonly state: SeriesState;
  /** The match on screen, if any. */
  readonly current: NextMatch | undefined;
  /** True once the match on screen has ended and its result is showing. */
  readonly settled: boolean;
  /**
   * A replayed link holds the pick that is due: the state once the link's due picks are made (they
   * are made when the next round is played). Undefined when no link pick is due.
   */
  readonly linkState: SeriesState | undefined;
}

export interface SeriesScreen {
  readonly phase: SeriesPhase;
  /** The pick the player makes now, if any. */
  readonly choice: PickChoice | undefined;
  /** The coming round, when Play round is how the player moves on. */
  readonly pairing: Pairing | undefined;
  /**
   * The controls that move the player forward. Never empty outside a fight (no dead ends): a fight
   * moves on by itself, every other screen offers a pick, Play round, or Rematch and New series.
   */
  readonly actions: readonly SeriesAction[];
}

/** What a series screen shows and offers at this moment; the panel renders exactly this. */
export function seriesScreenOf({ state, current, settled, linkState }: SeriesMoment): SeriesScreen {
  const playing = current !== undefined && !settled;
  const finished = state.winner !== undefined && !playing;
  const phase: SeriesPhase = playing ? 'playing' : finished ? 'finished' : 'between';
  if (phase !== 'between') {
    return {
      phase,
      choice: undefined,
      pairing: undefined,
      actions: finished ? ['rematch', 'newSeries'] : [],
    };
  }
  // A link's due pick is the link's to make, so the player isn't asked for it: Play round makes it.
  const choice = linkState === undefined ? pickChoiceOf(state) : undefined;
  // The round Play round leads to: after the link's due picks, when it holds them.
  const pairing = choice === undefined ? pairingOf(linkState ?? state) : undefined;
  return {
    phase,
    choice,
    pairing,
    actions: choice !== undefined ? ['pick'] : pairing !== undefined ? ['play'] : [],
  };
}
