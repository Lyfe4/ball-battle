// Opponents for a best-of-3 series (ADR 0017, 0019, 0021, 0035): three levels, Easy, Normal and
// Hard, plus the original bot kept for old links. Each level is a weighting of its balls for every
// kind of choice, drawn on a seeded stream, so a choice is a pure function of the series and a
// verifier makes the same one (ADR 0022). The measurement scripts read the same weights, so what
// they measure is what plays. Pure and seeded, like the rest of the sim.
import { afterRound, maximinMix, type Position } from './bot-model.ts';
import { isFavoured } from './counter-map.ts';
import { createStream, deriveSeed } from './rng.ts';
import {
  formatOf,
  awaitingPick,
  LINEUP_SIZE,
  remainingOf,
  scoreOf,
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
  /** The series seed: every choice is drawn from a stream derived from it. */
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
}

/** A ball and how likely the bot is to choose it. Weights are positive and sum to 1. */
export type Weights = readonly (readonly [string, number])[];

export interface LineupBot {
  readonly id: string;
  /** Three different ids from `roster`, in order. The same seed always gives the same lineup. */
  pickLineup(seed: number, roster: readonly string[]): Lineup;
  /** How likely each of its balls is for this choice. */
  weights(view: BotView): Weights;
  /** The ball it chooses: a seeded draw from `weights`. */
  choose(view: BotView): string;
}

/** Keeps each of the bot's choices on its own stream, apart from the series' round seeds. */
const BOT_SALT = 0xb07;
const SHOW_SALT = 0x5409;
const ANSWER_SALT = 0xa45e;
const OPEN_SALT = 0x0be7;
/** Normal and Hard draw on streams of their own, so a level never shares another's draws. */
const LEVEL_SALTS: Readonly<Record<string, number>> = {
  easy: 0xea5,
  normal: 0x707a1,
  hard: 0x4a7d,
};
const ROLE_SALTS: Readonly<Record<BotRole, number>> = {
  show: SHOW_SALT,
  answer: ANSWER_SALT,
  open: OPEN_SALT,
};

/** How often Normal plays the counter map's best choice; otherwise it picks at random. */
export const NORMAL_COUNTER_SHARE = 0.6;
/** Hard mixes the balls it may show first whose value is this close to its best (ADR 0035). */
export const HARD_SHOW_MARGIN = 0.03;

function asLineup(ids: readonly string[]): Lineup {
  const [first, second, third] = ids;
  if (ids.length !== LINEUP_SIZE || first === undefined || second === undefined || !third) {
    throw new Error('Expected three balls');
  }
  return [first, second, third];
}

/** Three different balls uniformly at random, in a random order: every level picks this way. */
function pickLineup(seed: number, roster: readonly string[]): Lineup {
  if (new Set(roster).size < LINEUP_SIZE) {
    throw new Error(`A lineup needs ${String(LINEUP_SIZE)} different balls`);
  }
  const random = createStream(deriveSeed([seed, BOT_SALT]));
  const pool = [...new Set(roster)];
  const picked: string[] = [];
  while (picked.length < LINEUP_SIZE) {
    const index = Math.floor(random() * pool.length);
    picked.push(...pool.splice(index, 1));
  }
  return asLineup(picked);
}

const uniform = (balls: readonly string[]): Weights =>
  balls.map((ball) => [ball, 1 / balls.length] as const);

/** The balls in `balls` with the highest score, in their order. */
function bestBy(balls: readonly string[], score: (ball: string) => number, margin = 1e-9) {
  const scores = balls.map(score);
  const best = Math.max(...scores);
  return balls.filter((_, index) => (scores[index] ?? -Infinity) >= best - margin);
}

/** Mixes two weightings: `share` of the first, the rest of the second. */
function blend(share: number, first: Weights, second: Weights): Weights {
  const total = new Map<string, number>();
  for (const [ball, weight] of first) total.set(ball, (total.get(ball) ?? 0) + share * weight);
  for (const [ball, weight] of second)
    total.set(ball, (total.get(ball) ?? 0) + (1 - share) * weight);
  return [...total].filter(([, weight]) => weight > 0);
}

/** 2 favoured, 1 even, 0 unfavoured, by the counter map. */
const rank = (ball: string, opponent: string) =>
  isFavoured(ball, opponent) ? 2 : isFavoured(opponent, ball) ? 0 : 1;

/** Its best counter to `shown` by the counter map: favoured, else even, else unfavoured. */
const counterTo = (own: readonly string[], shown: string): Weights =>
  uniform(bestBy(own, (ball) => rank(ball, shown)));

/** The balls that do best by the counter map against the opponent's whole lineup. */
const bestAgainstLineup = (own: readonly string[], opponent: readonly string[]): Weights =>
  uniform(bestBy(own, (ball) => opponent.reduce((sum, y) => sum + rank(ball, y) - 1, 0)));

/** A seeded draw from `weights`, in their order. */
function draw(weights: Weights, seed: number): string {
  const roll = createStream(seed)();
  let sum = 0;
  for (const [ball, weight] of weights) {
    sum += weight;
    if (roll < sum) return ball;
  }
  const last = weights.at(-1);
  if (last === undefined) throw new Error('No ball to choose from');
  return last[0];
}

const positionOf = (view: BotView): Position => ({
  format: view.format,
  own: view.own,
  opponent: view.opponent,
  wins: view.wins,
  losses: view.losses,
});

function shownOf(view: BotView): string {
  if (view.shown === undefined) throw new Error('An answer needs the ball shown first');
  return view.shown;
}

/** A bot level: its weights, and choices drawn from them on its own streams. */
function level(id: string, weights: (view: BotView) => Weights): LineupBot {
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
 * shown ball; opening a Showdown, its balls that fare best against the opponent's lineup; each
 * NORMAL_COUNTER_SHARE of the time, otherwise at random. It shows first at random.
 */
export const normalBot = level('normal', (view) => {
  if (view.role === 'show') return uniform(view.own);
  const best =
    view.role === 'answer'
      ? counterTo(view.own, shownOf(view))
      : bestAgainstLineup(view.own, view.opponent);
  return blend(NORMAL_COUNTER_SHARE, best, uniform(view.own));
});

/**
 * Hard: plays the whole series, not just the round (ADR 0035), valuing positions by the counter
 * map (bot-model.ts). Answering, the ball that leaves it the best series chance, round 3 included.
 * Showing first, a ball whose worst answer leaves it within HARD_SHOW_MARGIN of its best, at random
 * among them. Opening a Showdown, the mix of balls that no opener of the opponent's can exploit.
 */
export const hardBot = level('hard', (view) => {
  const position = positionOf(view);
  if (view.role === 'answer') {
    const shown = shownOf(view);
    return uniform(bestBy(view.own, (ball) => afterRound(position, 'opponent', ball, shown)));
  }
  if (view.role === 'show') {
    const worstAnswer = (ball: string) =>
      Math.min(...view.opponent.map((y) => afterRound(position, 'bot', ball, y)));
    return uniform(bestBy(view.own, worstAnswer, HARD_SHOW_MARGIN));
  }
  // Round 1 of a Showdown: both open at once, so neither leads; the winner leads round 2.
  const matrix = view.own.map((ball) =>
    view.opponent.map((y) => afterRound(position, 'bot', ball, y)),
  );
  const mix = maximinMix(matrix);
  return view.own
    .map((ball, index) => [ball, mix[index] ?? 0] as const)
    .filter(([, weight]) => weight > 0);
});

/**
 * The first bot (ADR 0017, 0021, 0029), kept so links played against it still replay: it shows
 * first at random and answers with its best counter, ties on a seeded coin. Not offered to new
 * series. Its streams are the ones it always used.
 */
const firstBotWeights = (view: BotView): Weights =>
  view.role === 'answer' ? counterTo(view.own, shownOf(view)) : uniform(view.own);

export const randomBot: LineupBot = {
  id: 'random',
  pickLineup,
  weights: firstBotWeights,
  choose(view) {
    const pool = firstBotWeights(view).map(([ball]) => ball);
    const random = createStream(deriveSeed([view.seed, ROLE_SALTS[view.role], view.round]));
    const choice = pool[Math.floor(random() * pool.length)];
    if (choice === undefined) throw new Error('No ball to choose from');
    return choice;
  },
};

/** The levels a player can choose, easiest first. */
export const BOT_LEVELS: readonly LineupBot[] = [easyBot, normalBot, hardBot];
export const DEFAULT_BOT = normalBot;

/** Every bot, by id: what a series setup's opponent names (ADR 0022). */
export const BOTS: ReadonlyMap<string, LineupBot> = new Map(
  [...BOT_LEVELS, randomBot].map((bot) => [bot.id, bot]),
);

/** The bot an opponent names, or the default level for a player or an unknown id. */
export function botFor(opponent: Opponent): LineupBot {
  return (opponent.kind === 'bot' ? BOTS.get(opponent.bot) : undefined) ?? DEFAULT_BOT;
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
    seed: state.setup.seed,
    round,
    own: remainingOf(state, 'b'),
    opponent: remainingOf(state, 'a'),
    wins: score.b,
    losses: score.a,
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
