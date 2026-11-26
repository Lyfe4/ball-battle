// What a move costs when the functions run far from the database (Netlify's Ohio region to a
// database in Sydney: ~200 ms a round trip). A TCP proxy adds 100 ms each way between the API and
// the local database; on a warm connection a series read must take one round trip (the session's
// profile, the series, the heartbeat and the rate limit in one statement) and a pick two (that
// statement, then the write), not the 8 and 15 of a transaction that read and wrote row by row
// (cost proposal decision 4, 2026-11-25: they were two and four). Queries go one at a time: the
// pooler never answers two pipelined on one connection.
import { createServer, connect, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseFor } from '../db.ts';
import type { Deps } from '../http.ts';
import { TestBrowser } from '../test/client.ts';
import { leftOf, newPlayer, newSeries, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { meRecord } from './record.ts';
import { seriesOne } from './series.ts';

const ONE_WAY_MS = 100;
const ROUND_TRIP_MS = 2 * ONE_WAY_MS;

const deps = testDeps();
const admin = adminSql();
let proxy: Server;
const sockets = new Set<Socket>();
let far: Deps;
let queries = 0;

/** Forwards every byte to the database, each direction after ONE_WAY_MS, in order. */
function startProxy(target: URL): Promise<number> {
  // Read now: the caller then points its URL at the proxy itself.
  const port = Number(target.port);
  const host = target.hostname;
  proxy = createServer((client) => {
    const upstream = connect(port, host);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('error', () => undefined);
    }
    const delayed = (to: Socket) => (data: Buffer) => {
      setTimeout(() => {
        if (!to.destroyed) to.write(data);
      }, ONE_WAY_MS);
    };
    client.on('data', delayed(upstream));
    upstream.on('data', delayed(client));
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
  return new Promise((resolve) => {
    proxy.listen(0, '127.0.0.1', () => {
      const address = proxy.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });
}

beforeAll(async () => {
  await admin`delete from game.rate_limits`;
  const url = new URL(process.env['TEST_DATABASE_URL'] ?? '');
  const port = await startProxy(url);
  url.host = `127.0.0.1:${String(port)}`;
  far = {
    ...deps,
    sql: databaseFor(url.href, () => {
      queries += 1;
    }),
  };
});

afterAll(async () => {
  await far.sql.end({ timeout: 1 });
  for (const socket of sockets) socket.destroy();
  proxy.close();
  await deps.sql.end();
  await admin.end();
});

/** `player` on the far API: the same cookie, the far database. */
const farOf = (player: Player): TestBrowser => player.browser.elsewhere(far);

/** How long `run` takes, and how many queries it sends. */
async function measure(run: () => Promise<unknown>): Promise<{ ms: number; queries: number }> {
  queries = 0;
  const started = performance.now();
  await run();
  return { ms: performance.now() - started, queries };
}

describe('a move across an ocean', () => {
  it('reads a series in one round trip, and locks a pick in two', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    /** A Reveal series and the side that shows first, as that player on the far API. */
    async function started() {
      const id = await newSeries(deps, players, 'reveal');
      const seen = await read(players.a, id);
      const side = seen.turn === 'b' ? ('b' as const) : ('a' as const);
      const browser = farOf(players[side]);
      const pick = () =>
        browser.call(seriesOne, 'POST', `/api/v1/series/${id}/picks`, {
          round: 0,
          ball: leftOf(seen, side)[0] ?? '',
        });
      return { id, browser, pick };
    }
    // Warm, as a function instance is after its first requests: the connection's handshake and
    // the first run of each statement are paid once per instance, not per move.
    const warm = await started();
    await warm.browser.call(seriesOne, 'GET', `/api/v1/series/${warm.id}`);
    await warm.pick();

    const { id, browser, pick } = await started();
    const reading = await measure(() => browser.call(seriesOne, 'GET', `/api/v1/series/${id}`));
    expect(reading.queries).toBe(1);
    expect(reading.ms).toBeLessThan(2 * ROUND_TRIP_MS);

    const picking = await measure(pick);
    expect(picking.queries).toBe(2);
    expect(picking.ms).toBeLessThan(3 * ROUND_TRIP_MS);
  });

  it('reads an account’s record in one round trip (ADR 0088)', async () => {
    const player = await newPlayer(deps);
    await admin`update game.profiles set account_at = now() where user_id = ${player.userId}`;
    const browser = farOf(player);
    const call = () => browser.call(meRecord, 'GET', '/api/v1/me/record');
    expect((await call()).status).toBe(200);
    const reading = await measure(call);
    expect(reading.queries).toBe(1);
    expect(reading.ms).toBeLessThan(2 * ROUND_TRIP_MS);
  });
});
