// /api/v1/series (ADR 0052, "A turn on the server"):
// - GET /api/v1/series: the player's series, open first (theirs to play first), then the latest
//   finished ones. Home's "Your turn (n)".
// - GET /api/v1/series/:id: the player's view, with an ETag of its version, so polling a series
//   that hasn't moved costs a 304.
// - POST /api/v1/series/:id/picks {round, ball}: locks a pick, in one transaction.
// Expired turns are settled when anyone reads, and by the scheduled sweep.
import { decodePickRequest } from '../../api/series.ts';
import { listFor } from '../db/series-list.ts';
import { loadSeries } from '../db/series-record.ts';
import { settleExpired } from '../db/series.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { LIMITS, spend } from '../rate-limit.ts';
import { lockPick, readSeries } from '../series-service.ts';
import { sessionOf } from '../session.ts';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ONE = new RegExp(`^/api/v1/series/(${UUID})$`);
const PICKS = new RegExp(`^/api/v1/series/(${UUID})/picks$`);

/** A series' ETag: its version, which every change bumps. Answers vary by the session cookie. */
const etagOf = (version: number) => `"v${String(version)}"`;

export const seriesList: RouteHandler = async (request, context) => {
  guard(request, ['GET']);
  // Settling expired turns needs nobody's session: both go to the database at once.
  const [player] = await Promise.all([
    sessionOf(request, context),
    settleExpired(context.deps.sql),
  ]);
  return json(200, { series: await listFor(context.deps.sql, player.userId) });
};

export const seriesOne: RouteHandler = async (request, context) => {
  const path = new URL(request.url).pathname;
  const picks = PICKS.exec(path)?.[1];
  if (picks !== undefined) {
    guard(request, ['POST']);
    const pick = decodePickRequest(await jsonBody(request));
    if (pick === undefined) throw new ApiError(400, 'bad_request', 'Send {round, ball}');
    // The session and the series are read together: one connection pipelines both queries, so
    // they cost one round trip to the database, not two.
    const [player, loaded] = await Promise.all([
      sessionOf(request, context),
      loadSeries(context.deps.sql, picks),
    ]);
    await spend(context.deps.sql, player.userId, LIMITS.moves);
    const view = await lockPick(context.deps, picks, player.userId, pick, loaded);
    return json(200, view, { ETag: etagOf(view.version), Vary: 'Cookie' });
  }
  const id = ONE.exec(path)?.[1];
  if (id === undefined) throw new ApiError(404, 'not_found', 'No such series');
  guard(request, ['GET']);
  const [player, loaded] = await Promise.all([
    sessionOf(request, context),
    loadSeries(context.deps.sql, id),
  ]);
  const view = await readSeries(context.deps, id, player.userId, loaded);
  const etag = etagOf(view.version);
  const headers = { ETag: etag, Vary: 'Cookie', 'Cache-Control': 'private, no-cache' };
  if (request.headers.get('If-None-Match') === etag) return json(304, null, headers);
  return json(200, view, headers);
};
