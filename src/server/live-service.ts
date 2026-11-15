// PROTOTYPE (proto/live-friend-matches, ADR 0053 draft): what a live series adds on the server.
// A read settles what the clock decided (a pick that ran out is made at random; an opponent
// silent past the grace period loses by forfeit), and the view carries the database's clock, the
// fights' scheduled times and whether the opponent is away.
import type { LiveInfo, SeriesView } from '../api/series.ts';
import type { Side } from '../sim/index.ts';
import { forfeitTo } from './db/series.ts';
import { loadSeries, type LoadedSeries } from './db/series-record.ts';
import type { Deps } from './http.ts';
import { AWAY_AFTER_MS, fightMsOf, fightsOf, GRACE_MS, PICK_SECONDS } from './live.ts';
import { rulesetSim } from './rulesets.ts';
import { other, viewOf } from './view.ts';

/** The series after what the clock decided, read again; undefined when nothing changed. */
export async function settleLive(
  deps: Deps,
  series: LoadedSeries,
  side: Side,
  autoPick: (deps: Deps, series: LoadedSeries) => Promise<boolean>,
): Promise<LoadedSeries | undefined> {
  if (series.status !== 'open' || series.now === undefined) return undefined;
  if (series.expired) {
    await autoPick(deps, series);
    return loadSeries(deps.sql, series.id);
  }
  const seen = series.seen?.[other(side)];
  if (seen !== null && seen !== undefined) {
    const silent = series.now.getTime() - seen.getTime();
    if (silent > AWAY_AFTER_MS + GRACE_MS) {
      await forfeitTo(deps.sql, series.id, series.version, side);
      return loadSeries(deps.sql, series.id);
    }
  }
  return undefined;
}

export async function liveViewOf(series: LoadedSeries, side: Side): Promise<SeriesView> {
  const view = viewOf(series, side);
  const now = series.now?.getTime();
  if (now === undefined) return view;
  const sim = await rulesetSim(series.ruleset);
  const lockedAt = (round: number) => {
    const times = series.picks
      .filter((p) => p.round === round && p.at !== undefined)
      .map((p) => Date.parse(p.at ?? ''));
    return times.length > 0 ? Math.max(...times) : undefined;
  };
  const fights = fightsOf(series.rounds, lockedAt, (round) =>
    fightMsOf(sim, `${series.id}:${String(round.round)}`, round, round.a, round.b),
  );
  const seen = series.seen?.[other(side)]?.getTime();
  const away =
    series.status === 'open' && seen !== undefined && now - seen > AWAY_AFTER_MS
      ? { since: seen, forfeitAt: seen + AWAY_AFTER_MS + GRACE_MS }
      : null;
  const live: LiveInfo = { now, pickSeconds: PICK_SECONDS, fights, away };
  return { ...view, live };
}
