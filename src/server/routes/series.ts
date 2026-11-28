// /api/v1/series (ADR 0052, "A turn on the server"):
// - GET /api/v1/series: the player's series, open first (theirs to play first), then the latest
//   finished ones. Home's "Your turn (n)".
// - GET /api/v1/series/:id: the player's view, with an ETag of its version, so polling a series
//   that hasn't moved costs a 304.
// - POST /api/v1/series/:id/picks {round, ball}: locks a pick, in one statement.
// - POST /api/v1/series/:id/forfeit: "Leave and forfeit", a live series only (ADR 0053).
// - GET and POST /api/v1/series/:id/rematch: a rematch after a live match (ADR 0055): where it
//   stands; ask or answer {answer: 'yes' | 'no'}, then the new lineup {lineup}.
// A live series' answers carry the database's clock in `X-Now`, a 304's too (ADR 0053), though
// Netlify's edge drops it from a 304 (ADR 0061).
// Expired turns are settled when anyone reads, and by the scheduled sweep.
// Queries go one at a time, never two at once (`Promise.all`): the pooler (Supavisor, transaction
// mode) never answers two queries pipelined on one connection, so such a request hangs until the
// function times out (staging, 2026-11-15). `pnpm test:db` runs through the local pooler to catch it.
import { NOW_HEADER } from '../../api/live.ts';
import { decodeRematchRequest } from '../../api/rematch.ts';
import { decodePickRequest, type SeriesView } from '../../api/series.ts';
import { listFor } from '../db/series-list.ts';
import { loadSeriesAs } from '../db/series-record.ts';
import { settleExpired } from '../db/series.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { LIMITS, refuseOver, spend } from '../rate-limit.ts';
import { readCountOf, spendRead } from '../read-count.ts';
import { moveRematch, rematchOf } from '../rematch.ts';
import { leaveSeries, lockPick, readSeries, type Served } from '../series-service.ts';
import { sessionOf, sessionWith } from '../session.ts';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ONE = new RegExp(`^/api/v1/series/(${UUID})$`);
const PICKS = new RegExp(`^/api/v1/series/(${UUID})/picks$`);
const FORFEIT = new RegExp(`^/api/v1/series/(${UUID})/forfeit$`);
const REMATCH = new RegExp(`^/api/v1/series/(${UUID})/rematch$`);

/**
 * A series' ETag: its version, which every change bumps, and in a live series whether the opponent
 * shows as away, which changes without a move. Answers vary by the session cookie.
 */
const etagOf = (view: SeriesView) =>
  `"v${String(view.version)}${view.live?.away == null ? '' : 'a'}"`;

/** The headers of a series answer: the ETag, and a live series' database clock (a 304's too). */
function headersOf({ view, now }: Served): Record<string, string> {
  return {
    ETag: etagOf(view),
    Vary: 'Cookie',
    'Cache-Control': 'private, no-cache',
    ...(now === null ? {} : { [NOW_HEADER]: String(now) }),
  };
}

export const seriesList: RouteHandler = async (request, context) => {
  guard(request, ['GET']);
  const player = await sessionOf(request, context);
  // Counted: every list settles every expired series, not only this player's.
  await spendRead(context.deps, player.userId);
  await settleExpired(context.deps.sql);
  return json(200, { series: await listFor(context.deps.sql, player.userId) });
};

export const seriesOne: RouteHandler = async (request, context) => {
  const path = new URL(request.url).pathname;
  const picks = PICKS.exec(path)?.[1];
  if (picks !== undefined) {
    guard(request, ['POST']);
    const pick = decodePickRequest(await jsonBody(request));
    if (pick === undefined) throw new ApiError(400, 'bad_request', 'Send {round, ball}');
    // The session, the series, the heartbeat and the move's rate-limit count: one statement.
    const { session: player, read } = await sessionWith(request, context, (reader) =>
      loadSeriesAs(
        context.deps.sql,
        picks,
        reader.userId,
        { limit: LIMITS.moves, weight: 1 },
        reader.sessionId,
      ),
    );
    if (read.series?.spent !== undefined) refuseOver(LIMITS.moves, read.series.spent);
    const answer = await lockPick(context.deps, picks, player.userId, pick, read.series);
    return json(200, answer.view, headersOf(answer));
  }
  const rematch = REMATCH.exec(path)?.[1];
  if (rematch !== undefined) {
    guard(request, ['GET', 'POST']);
    const player = await sessionOf(request, context);
    if (request.method === 'GET') {
      await spendRead(context.deps, player.userId);
      return json(200, await rematchOf(context.deps, rematch, player.userId));
    }
    const move = decodeRematchRequest(await jsonBody(request));
    if (move === undefined) throw new ApiError(400, 'bad_request', 'Send {answer} or {lineup}');
    await spend(context.deps.sql, player.userId, LIMITS.moves);
    return json(200, await moveRematch(context.deps, rematch, player.userId, move));
  }
  const leaving = FORFEIT.exec(path)?.[1];
  if (leaving !== undefined) {
    guard(request, ['POST']);
    const player = await sessionOf(request, context);
    await spend(context.deps.sql, player.userId, LIMITS.moves);
    const answer = await leaveSeries(context.deps, leaving, player.userId);
    return json(200, answer.view, headersOf(answer));
  }
  const id = ONE.exec(path)?.[1];
  if (id === undefined) throw new ApiError(404, 'not_found', 'No such series');
  guard(request, ['GET']);
  // The session, the read, the reader's heartbeat and their rate-limit count: one statement.
  const count = readCountOf(context.deps);
  const { session: player, read } = await sessionWith(request, context, (reader) =>
    loadSeriesAs(context.deps.sql, id, reader.userId, count, reader.sessionId),
  );
  const loaded = read.series;
  if (loaded?.spent !== undefined) refuseOver(count.limit, loaded.spent);
  const answer = await readSeries(context.deps, id, player.userId, loaded);
  const headers = headersOf(answer);
  if (request.headers.get('If-None-Match') === headers['ETag']) return json(304, null, headers);
  return json(200, answer.view, headers);
};
