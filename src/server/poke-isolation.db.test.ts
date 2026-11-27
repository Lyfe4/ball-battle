// A player hears only their own pokes (ADR 0082; 2026-11-28 audit, ADR 0092): each page learns
// only its own topic, from GET /me/poke behind its session, and the topic is 122 random bits,
// rotated at Log out. Here two sockets on the local Realtime, joined as a page joins (the Phoenix
// messages of src/app/poke-socket.ts, written out here: the server's tests import no app code):
// a poke for A reaches A's socket and never B's. And no browser role can read the
// message log Realtime broadcasts from, so a topic can't be learned there either.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PokeOn } from '../api/poke.ts';
import { mePoke } from './routes/poke.ts';
import { newPlayer, type Player } from './test/series-support.ts';
import { adminSql, testDeps } from './test/support.ts';

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

/** A page's socket for `player`, joined to the topic its own /me/poke gave it. */
async function listen(player: Player): Promise<{ heard: string[]; up: () => boolean }> {
  const answer = await player.browser.call(mePoke, 'GET', '/api/v1/me/poke');
  const { url, key, topic } = answer.body as PokeOn;
  expect(topic).toMatch(/^p:[0-9a-f]{32}$/);
  const channel = `realtime:${topic}`;
  const heard: string[] = [];
  let up = false;
  const socket = new WebSocket(`${url}?apikey=${encodeURIComponent(key)}&vsn=1.0.0`);
  sockets.push(socket);
  socket.onopen = () => {
    const config = {
      broadcast: { self: false, ack: false },
      presence: { key: '' },
      private: false,
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
      ref,
    } = JSON.parse(String(message.data)) as {
      topic: string;
      event: string;
      payload: { status?: string; event?: string };
      ref: string | null;
    };
    if (event === 'phx_reply' && ref === '1') up = payload.status === 'ok';
    if (to === channel && event === 'broadcast' && payload.event !== undefined) {
      heard.push(payload.event);
    }
  };
  return { heard, up: () => up };
}

describe('pokes on Realtime', () => {
  it('reach the player they are for, and no one else', async () => {
    const a = await newPlayer(deps);
    const b = await newPlayer(deps);
    const pageA = await listen(a);
    const pageB = await listen(b);
    expect(await until(() => pageA.up() && pageB.up(), 10_000)).toBe(true);

    // Pokes until its owner hears one: local Realtime starts broadcasting a moment after the first
    // socket joins and drops what came before (a poke is a hint; repeats change nothing).
    const pokeUntilHeard = async (player: Player, event: string, page: { heard: string[] }) => {
      for (let tries = 0; tries < 30 && page.heard.length === 0; tries += 1) {
        await admin`select game.poke(${player.userId}::uuid, ${event})`;
        await until(() => page.heard.length > 0, 500);
      }
    };
    await pokeUntilHeard(a, 'inbox', pageA);
    // Time enough for a wrong delivery to land.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const only = (heard: readonly string[]) => [...new Set(heard)];
    expect({ a: only(pageA.heard), b: pageB.heard }).toStrictEqual({ a: ['inbox'], b: [] });
    // B's socket hears its own: its silence above was not a dead socket.
    await pokeUntilHeard(b, 'match', pageB);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect({ a: only(pageA.heard), b: only(pageB.heard) }).toStrictEqual({
      a: ['inbox'],
      b: ['match'],
    });
  }, 40_000);

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
