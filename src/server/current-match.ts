// The live match or lobby a player can go back to (ADR 0053): home's "Back to your match". Read
// from home, so it is never a heartbeat: a player on home is away from their match, and loses it
// once the grace period runs out. A series is settled first, so one already lost isn't offered.
import type { CurrentMatch } from '../api/live.ts';
import { tokenFor } from './challenges.ts';
import { liveNowOf } from './db/live.ts';
import { loadSeries } from './db/series-record.ts';
import type { Deps } from './http.ts';
import { settleLive } from './live-service.ts';
import { sideOf } from './view.ts';

export async function currentMatch(deps: Deps, userId: string): Promise<CurrentMatch | null> {
  const now = await liveNowOf(deps.sql, userId);
  if (now === undefined) return null;
  if (now.kind === 'lobby') {
    const token = await tokenFor(deps.config, userId, now.requestId);
    return { kind: 'lobby', token, format: now.format, bestOf: now.bestOf };
  }
  const loaded = await loadSeries(deps.sql, now.id);
  if (loaded === undefined) return null;
  const series = await settleLive(deps, loaded);
  const side = sideOf(series.players, userId);
  if (series.status !== 'open' || side === undefined) return null;
  return {
    kind: 'series',
    id: series.id,
    format: series.format,
    bestOf: series.bestOf,
    opponent: series.names[side === 'a' ? 'b' : 'a'],
  };
}
