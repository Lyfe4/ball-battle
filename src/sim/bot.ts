// Opponents for a series (ADR 0017, 0019, 0021, 0035, 0048): three levels, Easy, Normal and
// Hard, plus the original bot kept for old links (and ruleset 19's Normal and Hard, bots-r19.ts). Each level is a weighting of its balls for every
// kind of choice, drawn on a seeded stream, so a choice is a pure function of the series and a
// verifier makes the same one (ADR 0022). The measurement scripts read the same weights, so what
// they measure is what plays. Pure and seeded, like the rest of the sim.
import { afterRound, mapOdds, type Memo, type Odds, type Position } from './bot-model.ts';
import { maximinMix } from './maximin.ts';
import { standingOf } from './counter-map.ts';
import { bestBy, blend, draw, LEVEL_SALTS, pickLineup, ROLE_SALTS, uniform } from './bot-draw.ts';
import { R19_READING } from './bot-r19.ts';
import { createStream, deriveSeed } from './rng.ts';
import { RULESET_VERSION } from './ruleset.ts';
import { botSeedOf } from './series-seeds.ts';
import {
  formatOf,
  awaitingPick,
  DEFAULT_BEST_OF,
  remainingOf,
  winsNeededOf,
  scoreOf,
  type BestOf,
  type Format,
  type Lineup,
  type Opponent,
  type SeriesState,
} from './series.ts';

/**
 * What a bot is choosing: the ball it shows first, its answer to a ball shown first, or Showdown's
 * round-1 opener, picked at the same time as the opponent's.
 */
export type BotRole = 'show' | 'answer' | 'open';

/**
 * Everything a bot may know when it chooses, and nothing else: an opponent's pick it hasn't been
 * shown is not in here, so no bot can read it, even by mistake.
 */
export interface BotView {
  readonly format: Format;
  /**
   * The seed of its choice stream (`botSeedOf`): the series seed, or a server series' secret bot
   * seed (ADR 0052). Every choice is drawn from a stream derived from it.
   */
  readonly seed: number;
  /** 0-based. */
  readonly round: number;
  readonly role: BotRole;
  /** The bot's balls left, in its lineup order. */
  readonly own: readonly string[];
  /** The opponent's balls left. */
  readonly opponent: readonly string[];
  /** `answer`: the ball the opponent showed first. */
  readonly shown?: string;
  /** Round wins so far: the bot's, then the opponent's. */
  readonly wins: number;
  readonly losses: number;
  /** The series length; undefined is Best of 3 (ADR 0048). */
  readonly bestOf?: BestOf;
}

/** A ball and how likely the bot is to choose it. Weights are positive and sum to 1. */
export type Weights = readonly (readonly [string, number])[];

export interface LineupBot {
  readonly id: string;
  /**
   * `size` different ids from `roster` (three unless named), in order. The same seed always gives
   * the same lineup, and a longer one starts with the shorter one's balls.
   */
  pickLineup(seed: number, roster: readonly string[], size?: BestOf): Lineup;
  /** How likely each of its balls is for this choice. */
  weights(view: BotView): Weights;
  /** The ball it chooses: a seeded draw from `weights`. */
  choose(view: BotView): string;
}

/** How often Normal plays the counter map's best choice; otherwise it picks at random. */
export const NORMAL_COUNTER_SHARE = 0.6;
/** Hard mixes the balls it may show first whose value is this close to its best (ADR 0035). */
export const HARD_SHOW_MARGIN = 0.03;

/**
 * How a bot reads the counter map: a ball's standing against another (higher is better for it),
 * and the round odds Hard plays by. Today's is the three levels (ADR 0073); a retired bot keeps
 * the map it played by.
 */
export interface MapReading {
  readonly standing: (ball: string, opponent: string) => number;
  readonly odds: Odds;
}

/** The three levels: strong 2, edge 1, even 0, and the levels' odds. */
export const LEVELS_READING: MapReading = { standing: standingOf, odds: mapOdds };

/** Its best counter to `shown` by the map: the ball that stands best against it. */
const counterTo = (map: MapReading, own: readonly string[], shown: string): Weights =>
  uniform(bestBy(own, (ball) => map.standing(ball, shown)));

/** The balls that do best by the map against the opponent's whole lineup. */
const bestAgainstLineup = (
  map: MapReading,
  own: readonly string[],
  opponent: readonly string[],
): Weights =>
  uniform(bestBy(own, (ball) => opponent.reduce((sum, y) => sum + map.standing(ball, y), 0)));

const positionOf = (view: BotView, odds: Odds): Position => ({
  format: view.format,
  own: view.own,
  opponent: view.opponent,
  wins: view.wins,
  losses: view.losses,
  winsNeeded: winsNeededOf(view.bestOf ?? DEFAULT_BEST_OF),
  odds,
});

function shownOf(view: BotView): string {
  if (view.shown === undefined) throw new Error('An answer needs the ball shown first');
  return view.shown;
}

/** A bot level: its weights, and choices drawn from them on its own streams. */
export function level(id: string, weights: (view: BotView) => Weights): LineupBot {
  const salt = LEVEL_SALTS[id] ?? 0;
  return {
    id,
    pickLineup,
    weights,
    choose(view) {
      return draw(weights(view), deriveSeed([view.seed, salt, ROLE_SALTS[view.role], view.round]));
    },
  };
}

/** Easy: any of its balls, at random, for every choice. Good for learning the balls. */
export const easyBot = level('easy', (view) => uniform(view.own));

/**
 * Normal: usually its counter-map best, sometimes anything. Answering, its best counter to the
 * shown ball (a strong counter, else an edge, else even...); opening a Showdown, its balls that
 * fare best against the opponent's lineup; each NORMAL_COUNTER_SHARE of the time, otherwise at
 * random. It shows first at random.
 */
export const normalWeights =
  (map: MapReading) =>
  (view: BotView): Weights => {
    if (view.role === 'show') return uniform(view.own);
    const best =
      view.role === 'answer'
        ? counterTo(map, view.own, shownOf(view))
        : bestAgainstLineup(map, view.own, view.opponent);
    return blend(NORMAL_COUNTER_SHARE, best, uniform(view.own));
  };

export const normalBot = level('normal', normalWeights(LEVELS_READING));

/**
 * Hard: plays the whole series, not just the round (ADR 0035), valuing positions by the counter
 * map (bot-model.ts), at any length (ADR 0048: the bot the Best of 5 measurement played, whose Best
 * of 3 choices are the ones Hard always made). Answering, the ball that leaves it the best series
 * chance, the last round included.
 * Showing first, a ball whose worst answer leaves it within HARD_SHOW_MARGIN of its best, at random
 * among them. Opening a Showdown, the mix of balls that no opener of the opponent's can exploit.
 */
export const hardWeights =
  (map: MapReading) =>
  (view: BotView): Weights => {
    const position = positionOf(view, map.odds);
    // One memo per choice: positions repeat within a choice, never across series (bot-model.ts).
    const memo: Memo = new Map();
    if (view.role === 'answer') {
      const shown = shownOf(view);
      return uniform(
        bestBy(view.own, (ball) => afterRound(position, 'opponent', ball, shown, memo)),
      );
    }
    if (view.role === 'show') {
      const worstAnswer = (ball: string) =>
        Math.min(...view.opponent.map((y) => afterRound(position, 'bot', ball, y, memo)));
      return uniform(bestBy(view.own, worstAnswer, HARD_SHOW_MARGIN));
    }
    // Round 1 of a Showdown: both open at once, so neither leads; the winner leads round 2.
    const matrix = view.own.map((ball) =>
      view.opponent.map((y) => afterRound(position, 'bot', ball, y, memo)),
    );
    const mix = maximinMix(matrix);
    return view.own
      .map((ball, index) => [ball, mix[index] ?? 0] as const)
      .filter(([, weight]) => weight > 0);
  };

export const hardBot = level('hard', hardWeights(LEVELS_READING));

/** Favoured or not, at either level: how the first bot reads the map (it predates levels). */
const SIDES_READING: MapReading = {
  standing: (ball, opponent) => Math.sign(standingOf(ball, opponent)),
  odds: mapOdds,
};

/**
 * The first bot (ADR 0017, 0021, 0029), kept so links played against it still replay: it shows
 * first at random and answers with its best counter, ties on a seeded coin. Not offered to new
 * series. Its streams are the ones it always used.
 */
export function firstBot(map: MapReading): LineupBot {
  const weights = (view: BotView): Weights =>
    view.role === 'answer' ? counterTo(map, view.own, shownOf(view)) : uniform(view.own);
  return {
    id: 'random',
    pickLineup,
    weights,
    choose(view) {
      const pool = weights(view).map(([ball]) => ball);
      const random = createStream(deriveSeed([view.seed, ROLE_SALTS[view.role], view.round]));
      const choice = pool[Math.floor(random() * pool.length)];
      if (choice === undefined) throw new Error('No ball to choose from');
      return choice;
    },
  };
}

export const randomBot = firstBot(SIDES_READING);

/** The levels a player can choose, easiest first. */
export const BOT_LEVELS: readonly LineupBot[] = [easyBot, normalBot, hardBot];
export const DEFAULT_BOT = normalBot;

/** Every bot, by id: what a series setup's opponent names (ADR 0022). */
export const BOTS: ReadonlyMap<string, LineupBot> = new Map(
  [...BOT_LEVELS, randomBot].map((bot) => [bot.id, bot]),
);

/**
 * Ruleset 19's bots (ADR 0073), by id: Easy never read the map, so it is today's; Normal, Hard and
 * the first bot read ruleset 19's two levels. Same ids, so the same streams.
 */
const R19_BOTS: ReadonlyMap<string, LineupBot> = new Map(
  [
    easyBot,
    level('normal', normalWeights(R19_READING)),
    level('hard', hardWeights(R19_READING)),
    firstBot(R19_READING),
  ].map((bot) => [bot.id, bot]),
);

/** The bot named `id` as it played under `ruleset`, if any. */
export function botNamed(id: string, ruleset: number = RULESET_VERSION): LineupBot | undefined {
  return (ruleset === 19 ? R19_BOTS : BOTS).get(id);
}

/** The bot an opponent names under a ruleset, or the default level for a player or unknown id. */
export function botFor(opponent: Opponent, ruleset: number = RULESET_VERSION): LineupBot {
  return (opponent.kind === 'bot' ? botNamed(opponent.bot, ruleset) : undefined) ?? DEFAULT_BOT;
}

/**
 * What side B may know before its due pick: the shown ball only when it answers. In a Showdown's
 * round 1 the player's opener is recorded first, but the view leaves it out.
 */
export function botViewOf(state: SeriesState): BotView | undefined {
  if (awaitingPick(state) !== 'b') return undefined;
  const format = formatOf(state.setup);
  const round = state.rounds.length;
  const score = scoreOf(state);
  const base = {
    format,
    seed: botSeedOf(state.setup),
    round,
    own: remainingOf(state, 'b'),
    opponent: remainingOf(state, 'a'),
    wins: score.b,
    losses: score.a,
    // Best of 3 views name no length, as before ADR 0048.
    ...(state.setup.bestOf === undefined ? {} : { bestOf: state.setup.bestOf }),
  };
  if (format === 'showdown' && round === 0) return { ...base, role: 'open' };
  const shown = state.picks.find((pick) => pick.round === round && pick.side === 'a');
  return shown === undefined
    ? { ...base, role: 'show' }
    : { ...base, role: 'answer', shown: shown.ball };
}

/** The bot's pick when side B (the bot) is due to pick, else undefined. */
export function botPick(bot: LineupBot, state: SeriesState): string | undefined {
  const view = botViewOf(state);
  return view === undefined ? undefined : bot.choose(view);
}
