// The guided first series' seed (ADR 0090 addendum "Tuned to teach"): the first series is tuned to
// teach, so its seed is chosen after the player's lineup, never a rule. Every choice the Easy bot
// makes and every fight is a pure function of the series seed, so the seed alone can give a
// newcomer a grid that reads naturally (two or three ▲, at most one ▲▲, at most one ▼, no ▼▼), a
// first shown ball they have a ▲ answer to, round 2 answers that are never favoured against them,
// and fights a favoured ball wins. A pick that isn't favoured plays its fight as it falls, so "▲
// matters" stays true. `verifySeries` accepts any seed, so a reload and a link verify as before.
// Pure and bounded (browser tests pin `generateSeed`), no DOM: the measuring script imports it.
import { botPick, easyBot } from '../sim/bot.ts';
import { standingOf } from '../sim/counter-map.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  startSeries,
  type Lineup,
  type SeriesSetup,
  type SeriesState,
} from '../sim/series.ts';
import { revealFirst } from '../sim/series-seeds.ts';
import { matchWorld, playToEnd } from '../sim/series-verify.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';

/** How many seeds from the first are looked at before the best one seen is taken. */
export const SEARCH_STEPS = 2048;
/** A seed's score when a player who reads the marks is carried by favoured fights alone. */
const CARRIED = 100;
/** The search stops at the first seed passing everything that carries a player reading the marks. */
const ENOUGH = CARRIED;
/** Seeds passing everything kept before the best of them is taken. */
const PASSES_KEPT = 6;

/** The player's side of a lineup grid: how many cells are ▲ or better, ▲▲, ▼ or worse, ▼▼. */
export interface GridShape {
  readonly favoured: number;
  readonly strong: number;
  readonly against: number;
  readonly strongAgainst: number;
}

export function gridOf(a: Lineup, b: Lineup): GridShape {
  const cells = a.flatMap((x) => b.map((y) => standingOf(x, y)));
  return {
    favoured: cells.filter((s) => s > 0).length,
    strong: cells.filter((s) => s === 2).length,
    against: cells.filter((s) => s < 0).length,
    strongAgainst: cells.filter((s) => s === -2).length,
  };
}

/** A grid that teaches without looking rigged: 2-3 ▲ (one ▲▲ at most), mostly =, one ▼ at most. */
export function isNaturalGrid(grid: GridShape): boolean {
  return (
    grid.favoured >= 2 &&
    grid.favoured <= 3 &&
    grid.strong <= 1 &&
    grid.against <= 1 &&
    grid.strongAgainst === 0
  );
}

/** The first series on `seed` for lineup `a`, as the lineup step starts it. */
export function firstSeriesOn(seed: number, a: Lineup, roster: readonly string[]): SeriesSetup {
  return {
    ruleset: RULESET_VERSION,
    seed,
    a,
    b: easyBot.pickLineup(seed, roster, 3),
    opponent: { kind: 'bot', bot: easyBot.id, lineupSeed: seed },
    format: 'reveal',
  };
}

/** The state once the round under way is decided (draws replayed), its picks made. */
function decide(state: SeriesState, definitions: DefinitionLookup): SeriesState {
  const round = state.rounds.length;
  let current = state;
  while (current.rounds.length === round && current.winner === undefined) {
    const match = nextMatch(current);
    if (match === undefined) break;
    const end = playToEnd(matchWorld(match, definitions), definitions);
    if (end.match.status !== 'finished') break;
    current = recordOutcome(current, outcomeOf(end.match.result, end));
  }
  return current;
}

/** How a seed did: undefined when it breaks a rule; else how many round 3s favour the player. */
function judge(
  seed: number,
  a: Lineup,
  roster: readonly string[],
  definitions: DefinitionLookup,
): number | undefined {
  if (revealFirst(seed) !== 'b') return undefined;
  const setup = firstSeriesOn(seed, a, roster);
  if (!isNaturalGrid(gridOf(a, setup.b))) return undefined;
  const start = startSeries(setup);
  const shown = botPick(easyBot, start);
  if (shown === undefined || !a.some((x) => standingOf(x, shown) > 0)) return undefined;
  const r1 = recordPick(start, shown);
  // Every fight a favoured ball can meet the player in, ready to play: each answer to the shown
  // ball, each ball shown in round 2 against the bot's answer, and round 3's last two balls. The
  // cheap rules are read on every branch first; fights play only for a seed that passes them.
  const fights: SeriesState[] = [];
  const favoured = (state: SeriesState, x: string, y: string) => {
    if (standingOf(x, y) > 0) fights.push(state);
  };
  let round3 = 0;
  // A player who reads the marks (the highest ▲ against what they face) gets a series whose
  // favoured fights alone carry it: round 1's answer, then round 2's ball or, if round 2 is lost,
  // round 3's. Even fights are never chosen: they play as they fall.
  let carried = true;
  const best1 = topBy(a, (x) => standingOf(x, shown));
  for (const p1 of a) {
    const answered = recordPick(r1, p1);
    favoured(answered, p1, shown);
    // Round 2 whichever way round 1 went: Easy's answer is drawn the same either way.
    const after1 = recordOutcome(answered, 'a');
    const botLeft = remainingOf(after1, 'b');
    const best2 = topBy(remainingOf(after1, 'a'), (x) =>
      botLeft.reduce((sum, y) => sum + standingOf(x, y), 0),
    );
    for (const p2 of remainingOf(after1, 'a')) {
      const shownFirst = recordPick(after1, p2);
      const answer = botPick(easyBot, shownFirst);
      if (answer === undefined || standingOf(p2, answer) < 0) return undefined;
      const r2 = recordPick(shownFirst, answer);
      favoured(r2, p2, answer);
      // Round 3 after a 1-1: the balls each side has left, no picks.
      const tied = recordOutcome(r2, 'b');
      if (awaitingPick(tied) !== undefined || tied.winner !== undefined) continue;
      const x = remainingOf(tied, 'a')[0];
      const y = remainingOf(tied, 'b')[0];
      if (x === undefined || y === undefined) continue;
      favoured(tied, x, y);
      if (standingOf(x, y) > 0) round3++;
      if (best1.includes(p1) && best2.includes(p2)) {
        carried &&= standingOf(p2, answer) > 0 || standingOf(x, y) > 0;
      }
    }
  }
  // The same fight (round and balls) is reached by more than one branch: played once.
  const played = new Map<string, boolean>();
  for (const state of fights) {
    const match = nextMatch(state);
    const key = `${String(match?.round)} ${String(match?.a)} ${String(match?.b)}`;
    let won = played.get(key);
    if (won === undefined) {
      won = decide(state, definitions).rounds.at(-1)?.winner === 'a';
      played.set(key, won);
    }
    if (!won) return undefined;
  }
  return (carried ? CARRIED : 0) + round3;
}

/** The items that score highest. */
function topBy(items: readonly string[], score: (item: string) => number): readonly string[] {
  const top = Math.max(...items.map(score));
  return items.filter((item) => score(item) === top);
}

/**
 * The search, one seed a step: yields after each seed it judges, and returns the seed chosen. From
 * `seed`, the first seed passing every rule that carries a player who reads the marks (ENOUGH),
 * else the best of the first PASSES_KEPT that pass, else (none within SEARCH_STEPS) the first
 * where the bot shows first.
 */
function* search(
  seed: number,
  a: Lineup,
  roster: readonly string[],
  definitions: DefinitionLookup,
): Generator<undefined, number> {
  let best: { seed: number; score: number } | undefined;
  let passes = 0;
  let botFirst: number | undefined;
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const candidate = (seed + step) >>> 0;
    if (botFirst === undefined && revealFirst(candidate) === 'b') botFirst = candidate;
    const score = judge(candidate, a, roster, definitions);
    if (score !== undefined) {
      if (score >= ENOUGH) return candidate;
      if (best === undefined || score > best.score) best = { seed: candidate, score };
      if (++passes >= PASSES_KEPT) break;
    }
    yield undefined;
  }
  return best?.seed ?? botFirst ?? seed;
}

/** The guided first series' seed for lineup `a` (`search`), at once: the measuring script's. */
export function firstSeriesSeed(
  seed: number,
  a: Lineup,
  roster: readonly string[],
  definitions: DefinitionLookup,
): number {
  const steps = search(seed, a, roster, definitions);
  for (;;) {
    const next = steps.next();
    if (next.done === true) return next.value;
  }
}

/** How long the page's search runs before it lets a frame through. */
export const SLICE_MS = 12;

/**
 * The same seed as `firstSeriesSeed`, searched in slices of SLICE_MS between frames, so a phone
 * that takes half a second to search keeps drawing (Reveal lineups shows it is working).
 * `now` and `pause` are the page's clock and its way to yield (a timeout).
 */
export async function firstSeriesSeedSliced(
  seed: number,
  a: Lineup,
  roster: readonly string[],
  definitions: DefinitionLookup,
  now: () => number,
  pause: () => Promise<void>,
): Promise<number> {
  const steps = search(seed, a, roster, definitions);
  let sliceStart = now();
  for (;;) {
    const next = steps.next();
    if (next.done === true) return next.value;
    if (now() - sliceStart >= SLICE_MS) {
      await pause();
      sliceStart = now();
    }
  }
}
