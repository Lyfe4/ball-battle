// A player hears only their own pokes, and only the server can send them (ADR 0082; 2026-11-28
// audit, ADR 0092): each page learns only its own topic, from GET /me/poke behind its session; the
// topic is 122 random bits, rotated at Log out, and shares nothing with what anyone can see of a
// player. Here sockets on the local Realtime, joined as a page joins (the Phoenix messages of
// src/app/poke-socket.ts, written out here: the server's tests import no app code): a poke for A
// reaches A's socket and never B's; a stranger who somehow knows A's topic can listen, but can't
// make A's page hear anything, by socket or by Realtime's REST broadcast (the topic is a private
// channel that browser roles may only listen on, `20261128140000_poke_private.sql`); and no
// browser role can read the message log Realtime broadcasts from, so a topic can't be learned there.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PokeOn } from '../api/poke.ts';
import { claimFriendCode } from './db/friends.ts';
import { newFriendCode } from './friends.ts';
import { mePoke } from './routes/poke.ts';
import { makeAccount } from './test/friends-support.ts';
import { newPlayer, type Player } from './test/series-support.ts';
import { adminSql, testDeps } from './test/support.ts';

/** How the page joins its topic (`poke-socket.ts`). */
const PAGE_JOINS_PRIVATE = true;

const base = testDeps();
const deps = testDeps({
  BALLBATTLE_POKE: '1',
  SUPABASE_BROWSER_KEY: base.config.supabasePublishableKey,
});
const admin = adminSql();
let flagWas = false;
const sockets: WebSocket[] = [];

beforeAll(async () => {
  const [row] = await admin<{ enabled: boolean }[]>`
    select enabled from game.flags where name = 'poke'`;
  flagWas = row?.enabled ?? false;
  await admin`update game.flags set enabled = true where name = 'poke'`;
});
afterAll(async () => {
  for (const socket of sockets) socket.close();
  await admin`update game.flags set enabled = ${flagWas} where name = 'poke'`;
  await Promise.all([deps.sql.end(), base.sql.end()]);
  await admin.end();
});

const until = async (check: () => boolean, ms: number): Promise<boolean> => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 50));
  return check();
};

/** Time enough for a wrong delivery to land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 1_500));

interface Page {
  readonly heard: string[];
  readonly up: () => boolean;
  /** Sends a broadcast on the topic, as any client that joined it can try. */
  readonly send: (event: string) => void;
}

/** The topic `player`'s own /me/poke gives its page, with the socket and the browser key. */
async function connectionOf(player: Player): Promise<PokeOn> {
  const answer = await player.browser.call(mePoke, 'GET', '/api/v1/me/poke');
  const connection = answer.body as PokeOn;
  expect(connection.topic).toMatch(/^p:[0-9a-f]{32}$/);
  return connection;
}

/** A socket joined to `topic` with the browser key and no session, as a page joins (by default). */
function join({ url, key, topic }: PokeOn, isPrivate = PAGE_JOINS_PRIVATE): Page {
  const channel = `realtime:${topic}`;
  const heard: string[] = [];
  let up = false;
  let ref = 1;
  const socket = new WebSocket(`${url}?apikey=${encodeURIComponent(key)}&vsn=1.0.0`);
  sockets.push(socket);
  socket.onopen = () => {
    const config = {
      broadcast: { self: false, ack: false },
      presence: { key: '' },
      private: isPrivate,
    };
    socket.send(
      JSON.stringify({
        topic: channel,
        event: 'phx_join',
        payload: { config },
        ref: '1',
        join_ref: '1',
      }),
    );
  };
  socket.onmessage = (message: { readonly data: unknown }) => {
    const {
      topic: to,
      event,
      payload,
      ref: answered,
    } = JSON.parse(String(message.data)) as {
      topic: string;
      event: string;
      payload: { status?: string; event?: string };
      ref: string | null;
    };
    if (event === 'phx_reply' && answered === '1') up = payload.status === 'ok';
    if (to === channel && event === 'broadcast' && payload.event !== undefined) {
      heard.push(payload.event);
    }
  };
  return {
    heard,
    up: () => up,
    send: (name) => {
      ref += 1;
      socket.send(
        JSON.stringify({
          topic: channel,
          event: 'broadcast',
          payload: { type: 'broadcast', event: name, payload: {} },
          ref: String(ref),
          join_ref: '1',
        }),
      );
    },
  };
}

/**
 * Pokes until its owner hears one: local Realtime starts broadcasting a moment after the first
 * socket joins and drops what came before (a poke is a hint; repeats change nothing).
 */
async function pokeUntilHeard(player: Player, event: string, page: Page): Promise<void> {
  for (let tries = 0; tries < 30 && page.heard.length === 0; tries += 1) {
    await admin`select game.poke(${player.userId}::uuid, ${event})`;
    await until(() => page.heard.length > 0, 500);
  }
}

const only = (heard: readonly string[]) => [...new Set(heard)];

describe('pokes on Realtime', () => {
  it('reach the player they are for, and no one else', async () => {
    const a = await newPlayer(deps);
    const b = await newPlayer(deps);
    const pageA = join(await connectionOf(a));
    const pageB = join(await connectionOf(b));
    expect(await until(() => pageA.up() && pageB.up(), 10_000)).toBe(true);

    await pokeUntilHeard(a, 'inbox', pageA);
    await settle();
    expect({ a: only(pageA.heard), b: pageB.heard }).toStrictEqual({ a: ['inbox'], b: [] });
    // B's socket hears its own: its silence above was not a dead socket.
    await pokeUntilHeard(b, 'match', pageB);
    await settle();
    expect({ a: only(pageA.heard), b: only(pageB.heard) }).toStrictEqual({
      a: ['inbox'],
      b: ['match'],
    });
  }, 40_000);

  it('come from the server only: a stranger who knows the topic is never heard', async () => {
    const a = await newPlayer(deps);
    const connection = await connectionOf(a);
    const pageA = join(connection);
    // The stranger has the topic (leaked somehow) and the browser key, as every page has, and tries
    // the page's own channel and a public one of the same name.
    const stranger = join(connection);
    const strangerPublic = join(connection, false);
    expect(await until(() => pageA.up() && stranger.up() && strangerPublic.up(), 10_000)).toBe(
      true,
    );
    await pokeUntilHeard(a, 'inbox', pageA);
    expect(pageA.heard.length).toBeGreaterThan(0);
    pageA.heard.length = 0;

    stranger.send('match');
    strangerPublic.send('match');
    const broadcast = await fetch(`${deps.config.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: connection.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [true, false].map((isPrivate) => ({
          topic: connection.topic,
          event: 'match',
          payload: {},
          private: isPrivate,
        })),
      }),
    });
    expect(broadcast.status).toBeLessThan(500);
    await settle();
    expect(pageA.heard).toStrictEqual([]);
  }, 40_000);

  it('use a topic that shares nothing with what anyone can see of the player', async () => {
    const a = await newPlayer(deps);
    const b = await newPlayer(deps);
    const username = await makeAccount(admin, a);
    const code = await claimFriendCode(admin, a.userId, newFriendCode());
    const topic = (await connectionOf(a)).topic.slice('p:'.length);
    const [derived] = await admin<{ md5: string }[]>`select md5(${a.userId}) as md5`;
    for (const value of [
      a.userId.replaceAll('-', ''),
      derived?.md5 ?? '',
      username.toLowerCase(),
      code.toLowerCase(),
    ]) {
      expect(topic).not.toContain(value);
    }
    expect(topic).not.toBe((await connectionOf(b)).topic.slice('p:'.length));
    // No browser role can reach the key where it is kept.
    const access = await admin<{ role: string; schema: boolean; column: boolean }[]>`
      select r as role, has_schema_privilege(r, 'game', 'usage') as schema,
        has_column_privilege(r, 'game.profiles', 'poke_key', 'select') as column
      from unnest(array['anon', 'authenticated']) r`;
    expect(access.filter(({ schema, column }) => schema || column)).toStrictEqual([]);
  });

  it('keep their log from every browser role', async () => {
    for (const role of ['anon', 'authenticated']) {
      const rows = await admin.begin(async (sql) => {
        await sql.unsafe(`set local role ${role}`);
        return sql.unsafe('select topic from realtime.messages limit 5').catch(() => []);
      });
      expect({ role, rows: rows.length }).toStrictEqual({ role, rows: 0 });
    }
  });
});
