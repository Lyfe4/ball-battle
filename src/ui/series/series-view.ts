// What the best-of-3 screens show, as pure functions of the series state, so the visuals (the
// round track, the pick rows, the next pairing; ADR 0025) are tested without a DOM. Only what the
// player is allowed to know is ever returned: the bot's hidden balls are `undefined`.
import type { TossTimes } from '../../app/coin-toss.ts';
import {
  attemptSeed,
  awaitingPick,
  bestOfOf,
  formatOf,
  nextBallOf,
  nextMatch,
  remainingOf,
  roundSeedOf,
  type NextMatch,
  type SeriesState,
  type Side,
} from '../../sim/series.ts';
import { otherSide, type Seats } from './seats.ts';

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
  /** The other side: the bot offline, a player online. */
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
 * a ball is known once picked, or when it is the last one left (the last round); in a blind series the
 * bot's lineup stays hidden and the player knows their own order. A bot's pick is only ever here
 * once it is made, so no screen can show a choice the bot hasn't made.
 */
export function knownNextBall(state: SeriesState, side: Side, you: Side = 'a'): string | undefined {
  const round = state.rounds.length;
  const left = remainingOf(state, side);
  if (isOpen(state)) return picked(state, round, side) ?? (left.length === 1 ? left[0] : undefined);
  return side === you ? nextBallOf(state, you) : undefined;
}

/** Every round of the series as the track shows it: played, now, later (only rounds to play). */
export function trackOf(
  state: SeriesState,
  current: NextMatch | undefined,
  you: Side = 'a',
): TrackColumn[] {
  const them = otherSide(you);
  const format = formatOf(state.setup);
  const played = state.rounds.length;
  const total = state.winner === undefined ? bestOfOf(state.setup) : played;
  return Array.from({ length: total }, (_, round): TrackColumn => {
    const record = state.rounds[round];
    if (record !== undefined) {
      const result = (side: Side) => (record.winner === side ? 'won' : 'lost');
      return {
        round,
        when: 'played',
        you: { ball: record[you], result: result(you) },
        bot: { ball: record[them], result: result(them) },
        draws: record.suddenDeath ? 0 : record.outcomes.length - 1,
        suddenDeath: record.suddenDeath,
      };
    }
    if (round === played) {
      const match = current?.round === round ? current : undefined;
      const botBall = match?.[them] ?? knownNextBall(state, them, you);
      const pool = remainingOf(state, them);
      return {
        round,
        when: 'now',
        you: { ...optional(match?.[you] ?? knownNextBall(state, you, you)) },
        bot: botBall === undefined && format !== 'blind' ? { pool } : { ...optional(botBall) },
        draws: state.pending.length,
        suddenDeath: false,
      };
    }
    // Later rounds: in a blind series the player's own order is set; everything else is open,
    // except that in Reveal and Showdown the bot's balls not yet in a column wait under the next round.
    const own = format === 'blind' ? remainingOf(state, you)[round - played] : undefined;
    const nowBall = current?.round === played ? current[them] : knownNextBall(state, them, you);
    const waiting = remainingOf(state, them).filter((id) => id !== nowBall);
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
export function pickChoiceOf(
  state: SeriesState,
  you: Side = 'a',
  due: readonly Side[] = dueOf(state),
): PickChoice | undefined {
  if (
    !due.includes(you) ||
    state.picks.some((p) => p.round === state.rounds.length && p.side === you)
  ) {
    return undefined;
  }
  const options = remainingOf(state, you);
  const opponents = remainingOf(state, otherSide(you));
  const round = state.rounds.length;
  if (formatOf(state.setup) === 'showdown' && round === 0) {
    return { kind: 'open', options, opponents };
  }
  const facing = picked(state, round, otherSide(you));
  if (facing !== undefined) return { kind: 'answer', facing, options, opponents };
  return { kind: 'show', options, opponents };
}

/** Who must pick now, by the series' own rules: the sim's awaitingPick (a series on this device). */
const dueOf = (state: SeriesState): readonly Side[] => {
  const due = awaitingPick(state);
  return due === undefined ? [] : [due];
};

/** The coming round when nothing is asked of the player: its balls as far as the player knows. */
export interface Pairing {
  readonly round: number;
  readonly you: string | undefined;
  readonly bot: string | undefined;
  /** Above 0 when a drawn round is replayed. */
  readonly attempt: number;
}

export function pairingOf(
  state: SeriesState,
  you: Side = 'a',
  due: readonly Side[] = dueOf(state),
): Pairing | undefined {
  const them = otherSide(you);
  if (state.winner !== undefined || due.includes(you)) return undefined;
  const next = nextMatch(state);
  return {
    round: state.rounds.length,
    you: next?.[you] ?? knownNextBall(state, you, you),
    bot: knownNextBall(state, them, you) ?? (isOpen(state) ? next?.[them] : undefined),
    attempt: next?.attempt ?? 0,
  };
}

/**
 * The last match played in the series, the one "How it was won" tells between rounds and at the
 * end (ADR 0038): a drawn play waiting to be replayed, else the last play of the last round (its
 * third draw, after sudden death). Undefined before anything is played.
 */
export function lastPlayOf(state: SeriesState): NextMatch | undefined {
  const replay = state.pending.length > 0 ? nextMatch(state) : undefined;
  if (replay !== undefined) {
    const attempt = replay.attempt - 1;
    const seed = attemptSeed(roundSeedOf(state.setup, replay.round), attempt);
    return { ...replay, attempt, seed };
  }
  const last = state.rounds.at(-1);
  const seed = last?.seeds.at(-1);
  if (last === undefined || seed === undefined) return undefined;
  return { round: last.round, attempt: last.seeds.length - 1, seed, a: last.a, b: last.b };
}

/** What the player can do next on a series screen: every screen but a fight offers one or more. */
/**
 * `leave`: a live match's only way on while it waits (Leave and forfeit, ADR 0053). `decline`:
 * No thanks to a friend's rematch (ADR 0055).
 */
export type SeriesAction = 'pick' | 'play' | 'rematch' | 'decline' | 'newSeries' | 'leave';

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
  /** Who the player is, and the other side's name: the bot offline (`BOT_SEATS`). */
  readonly seats?: Seats;
  /**
   * Who must pick now, when a server says so (an online series, ADR 0052): Showdown's opener is
   * due from both sides at once, which the sim records A first. Offline it is the sim's own.
   */
  readonly due?: readonly Side[];
  /**
   * An online series (ADR 0052): the series goes on elsewhere, so at the end and while it is the
   * other side's turn the way on is Home (`newSeries`), and `note` says why it waits ("Waiting
   * for Player 4821 · 23 h left") or how it ended (a forfeit).
   */
  readonly online?: {
    readonly note: string | undefined;
    /**
     * A live match (ADR 0053): it goes on only while both players stay, so while it waits the way
     * on is "Leave match" (asked as Leave and forfeit?), never a Home that would quietly lose it.
     */
    readonly live?: boolean;
    /**
     * At the end of a live match (ADR 0055): `offer`, Rematch may be asked (beside Home);
     * `answer`, the other player asked, so Rematch or No thanks.
     */
    readonly rematch?: 'offer' | 'answer' | undefined;
    /** A live Reveal's coin toss on the server's clock (ADR 0061), from the start to the first pick. */
    readonly toss?: TossTimes;
    /** The server's clock as this page knows it (live). */
    readonly now?: () => number;
  };
}

export interface SeriesScreen {
  readonly phase: SeriesPhase;
  /** The pick the player makes now, if any. */
  readonly choice: PickChoice | undefined;
  /** The coming round, when Play round is how the player moves on. */
  readonly pairing: Pairing | undefined;
  /** Online, between rounds with nothing to do but wait for the other side. */
  readonly waiting: boolean;
  /**
   * The controls that move the player forward. Never empty outside a fight (no dead ends): a fight
   * moves on by itself, every other screen offers a pick, Play round, or Rematch and New series.
   */
  readonly actions: readonly SeriesAction[];
}

/** The ways on at the end: offline Rematch and New series; online Home, and a friend's rematch. */
function endActionsOf(online: SeriesMoment['online']): readonly SeriesAction[] {
  if (online === undefined) return ['rematch', 'newSeries'];
  if (online.rematch === 'answer') return ['rematch', 'decline'];
  return online.rematch === 'offer' ? ['rematch', 'newSeries'] : ['newSeries'];
}

/** What a series screen shows and offers at this moment; the panel renders exactly this. */
export function seriesScreenOf({
  state,
  current,
  settled,
  linkState,
  seats,
  due,
  online,
}: SeriesMoment): SeriesScreen {
  const you = seats?.you ?? 'a';
  const playing = current !== undefined && !settled;
  const finished = state.winner !== undefined && !playing;
  const phase: SeriesPhase = playing ? 'playing' : finished ? 'finished' : 'between';
  if (phase !== 'between') {
    return {
      phase,
      choice: undefined,
      pairing: undefined,
      waiting: false,
      actions: finished ? endActionsOf(online) : [],
    };
  }
  // A link's due pick is the link's to make, so the player isn't asked for it: Play round makes it.
  const choice = linkState === undefined ? pickChoiceOf(state, you, due) : undefined;
  // The round Play round leads to: after the link's due picks, when it holds them.
  const paired = choice === undefined ? pairingOf(linkState ?? state, you, due) : undefined;
  // Online, a round can only be played (watched) once the server has played it.
  const pairing =
    online !== undefined && nextMatch(linkState ?? state) === undefined ? undefined : paired;
  const waiting = online !== undefined && choice === undefined && pairing === undefined;
  return {
    phase,
    choice,
    pairing,
    waiting,
    actions:
      choice !== undefined
        ? ['pick']
        : pairing !== undefined
          ? ['play']
          : waiting
            ? [online.live === true ? 'leave' : 'newSeries']
            : [],
  };
}
