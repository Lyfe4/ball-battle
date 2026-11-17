// What the clock decides in a live series (ADR 0053), settled whenever the series is read or moved
// and by the scheduled sweep, as series by turns settle their deadlines. Each event is written in
// one statement guarded by the series' version, earliest first: when two players' reads race to
// settle the same timeout, one write wins and the other reloads to find it made.
import type { Side } from '../sim/index.ts';
import { liveSeriesToSettle } from './db/live.ts';
import { loadSeries, type LoadedSeries } from './db/series-record.ts';
import { forfeitSeries, writeSeries } from './db/series-write.ts';
import type { Deps } from './http.ts';
import { firstPickOpensAt, nextLiveEvent, randomBall, secureRandom } from './live.ts';
import { dueOf, stateOf } from './machine.ts';
import { rulesetSim } from './rulesets.ts';
import { moveOf, storedOf, type MovePick } from './series-move.ts';

/** Enough for every event a series can owe at once (a start, picks, a forfeit), with races. */
const MOST_EVENTS = 12;

/** The picks due when time ran out, each a random ball from those its side has left. */
async function randomPicks(deps: Deps, series: LoadedSeries): Promise<MovePick[]> {
  const sim = await rulesetSim(series.ruleset);
  const stored = await storedOf(deps.config, series);
  const state = stateOf(sim, stored);
  const due = dueOf(sim, stored, state);
  return due.sides.flatMap((side: Side) => {
    const ball = randomBall(sim.remainingOf(state, side), secureRandom());
    return ball === undefined ? [] : [{ round: due.round, side, ball, auto: true }];
  });
}

/**
 * The series once everything its clock decided by now is written: the first pick phase opened
 * when both players are here, every pick that ran out made at random as of its deadline, and a
 * forfeit for a missed start or a player silent past the grace period. A series by turns, or one
 * with nothing due, comes back as it was.
 */
export async function settleLive(deps: Deps, loaded: LoadedSeries): Promise<LoadedSeries> {
  let series = loaded;
  for (let step = 0; step < MOST_EVENTS; step += 1) {
    const clock = series.live;
    if (clock === null || series.status !== 'open') return series;
    const event = nextLiveEvent({
      now: clock.now,
      createdAt: clock.createdAt,
      startedAt: clock.startedAt,
      seen: clock.seen,
      deadline: series.deadline?.getTime() ?? null,
    });
    if (event === undefined) return series;
    if (event.kind === 'forfeit') {
      await forfeitSeries(deps.sql, series.id, series.version, event.winner, event.reason);
    } else {
      const picks = event.kind === 'timeout' ? await randomPicks(deps, series) : [];
      const lockedAt = event.kind === 'timeout' ? event.at : clock.now;
      // The start: the first pick opens after Reveal's coin toss (ADR 0061).
      const startedAt =
        event.kind === 'start'
          ? { startedAt: clock.now, opensFrom: firstPickOpensAt(series.format, clock.now) }
          : {};
      const move = await moveOf(deps.config, series, picks, false, { lockedAt, ...startedAt });
      await writeSeries(deps.sql, series.id, series.version, move);
    }
    // Written, or another request wrote first: either way, read what is stored now.
    const next = await loadSeries(deps.sql, series.id);
    if (next === undefined) return series;
    series = next;
  }
  return series;
}

/** The sweep: every open live series whose clock decided something, settled. */
export async function settleLiveSeries(deps: Deps): Promise<number> {
  let settled = 0;
  for (const id of await liveSeriesToSettle(deps.sql)) {
    const series = await loadSeries(deps.sql, id);
    if (series !== undefined && (await settleLive(deps, series)).status !== 'open') settled += 1;
  }
  return settled;
}
