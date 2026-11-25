// The Realtime poke's database side (ADR 0082): row triggers write one `realtime.messages` row per
// change a player reads, to that player's own topic, only on commit, only with the flag on, and
// never for a write that changes nothing they read. Read straight from `realtime.messages`, which
// Realtime broadcasts from once the write commits.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from './db.ts';
import { startedLive } from './test/live-support.ts';
import {
  dueSides,
  leftOf,
  newPlayer,
  newSeries,
  pick,
  read,
  type Player,
} from './test/series-support.ts';
import { adminSql, testDeps } from './test/support.ts';
import { befriend, newAccount } from './test/friends-support.ts';
import { tokenOf } from './test/live-support.ts';
import { challengeOne, challenges } from './routes/challenges.ts';

const deps = testDeps();
const admin = adminSql();
let flagWas = false;

const setFlag = async (sql: Sql, on: boolean): Promise<void> => {
  await sql`update game.flags set enabled = ${on}, changed_at = now() where name = 'poke'`;
};

beforeAll(async () => {
  const [row] = await admin<{ enabled: boolean }[]>`
    select enabled from game.flags where name = 'poke'`;
  flagWas = row?.enabled ?? false;
});
beforeEach(async () => {
  await setFlag(admin, true);
});
afterAll(async () => {
  await setFlag(admin, flagWas);
  await deps.sql.end();
  await admin.end();
});

/** Every poke a player's topic has had, as `event` names, oldest first. */
async function pokesOf(userId: string): Promise<string[]> {
  const rows = await admin<{ event: string }[]>`
    select m.event from realtime.messages m
    join game.profiles p on m.topic = 'p:' || p.poke_key
    where p.user_id = ${userId}
    order by m.inserted_at`;
  return rows.map((row) => row.event);
}

/** What each player is poked with while `act` runs. */
async function pokedBy(players: readonly Player[], act: () => Promise<unknown>) {
  const before = await Promise.all(players.map((player) => pokesOf(player.userId)));
  await act();
  const after = await Promise.all(players.map((player) => pokesOf(player.userId)));
  return after.map((events, i) => events.slice(before[i]?.length ?? 0));
}

/** A live series under way, and its first pick: who makes it, and with which ball. */
async function liveMatch() {
  const made = await startedLive(deps, admin);
  const seen = await read(made.players.a, made.id);
  const side = dueSides(seen)[0] ?? 'a';
  const ball = leftOf(seen, side)[0] ?? 'archer';
  const firstPick = async (): Promise<void> => {
    const answer = await pick(made.players[side], made.id, 0, ball);
    if (answer.status !== 200) throw new Error(`The pick answered ${String(answer.status)}`);
  };
  return { ...made, firstPick };
}

describe('a live match', () => {
  it('pokes both players once when a pick moves it, and nobody on a plain read', async () => {
    const { id, players, firstPick } = await liveMatch();
    const both = [players.a, players.b];
    expect(await pokedBy(both, () => firstPick())).toStrictEqual([['match'], ['match']]);
    // Reading is the heartbeat (it writes game.presence): no poke.
    expect(
      await pokedBy(both, async () => {
        await read(players.a, id);
        await read(players.b, id);
      }),
    ).toStrictEqual([[], []]);
  });

  it('pokes nobody for a change that rolls back', async () => {
    const { id, players } = await liveMatch();
    const pokes = await pokedBy([players.a, players.b], () =>
      admin
        .begin(async (sql) => {
          await sql`update game.series set version = version + 1 where id = ${id}`;
          throw new Error('rolled back');
        })
        .catch(() => undefined),
    );
    expect(pokes).toStrictEqual([[], []]);
  });

  it('pokes nobody while the flag is off', async () => {
    const { players, firstPick } = await liveMatch();
    await setFlag(admin, false);
    const pokes = await pokedBy([players.a, players.b], () => firstPick());
    expect(pokes).toStrictEqual([[], []]);
  });

  it('sends to a topic of random characters, never the user id', async () => {
    const { players, firstPick } = await liveMatch();
    await firstPick();
    const rows = await admin<{ topic: string; payload: unknown; private: boolean }[]>`
      select m.topic, m.payload, m.private from realtime.messages m
      join game.profiles p on m.topic = 'p:' || p.poke_key
      where p.user_id in ${admin([players.a.userId, players.b.userId])}`;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.topic).toMatch(/^p:[0-9a-f]{32}$/);
      for (const userId of [players.a.userId, players.b.userId]) {
        expect(row.topic).not.toContain(userId.replaceAll('-', ''));
        expect(row.topic).not.toContain(userId);
      }
      // Realtime adds the message's own id; nothing of the game's.
      expect(Object.keys(row.payload as object)).toStrictEqual(['id']);
      expect(row.private).toBe(false);
    }
  });
});

describe('friends', () => {
  it('pokes both inboxes on a request, an answer and a removal; never on a no-op', async () => {
    const one = await newPlayer(deps);
    const two = await newPlayer(deps);
    const [low, high] = [one.userId, two.userId].sort() as [string, string];
    const both = [one, two];
    const insert = () => admin`
      insert into game.friendships (low, high, requested_by) values (${low}, ${high}, ${low})`;
    expect(await pokedBy(both, insert)).toStrictEqual([['inbox'], ['inbox']]);
    const accept = () => admin`
      update game.friendships set accepted_at = now() where low = ${low} and high = ${high}`;
    expect(await pokedBy(both, accept)).toStrictEqual([['inbox'], ['inbox']]);
    const nothing = () => admin`
      update game.friendships set created_at = created_at where low = ${low} and high = ${high}`;
    expect(await pokedBy(both, nothing)).toStrictEqual([[], []]);
    const remove = () => admin`
      delete from game.friendships where low = ${low} and high = ${high}`;
    expect(await pokedBy(both, remove)).toStrictEqual([['inbox'], ['inbox']]);
  });
});

describe('a friend’s challenge', () => {
  it('reaches the invitee’s inbox, then the sender’s lobby on an answer, not on its heartbeat', async () => {
    const sender = await newPlayer(deps);
    const friend = await newPlayer(deps);
    const both = [sender, friend];
    let id = '';
    const send = async () => {
      const [row] = await admin<{ id: string }[]>`
        insert into game.challenges (token_hash, creator, ruleset, format, best_of, request_id,
          expires_at, live, creator_seen_at, invitee)
        values (${Buffer.alloc(32, Math.floor(Math.random() * 255))}, ${sender.userId}, 1,
          'reveal', 3, gen_random_uuid(), now() + interval '1 day', true, now(), ${friend.userId})
        returning id`;
      id = row?.id ?? '';
    };
    expect(await pokedBy(both, send)).toStrictEqual([[], ['inbox']]);
    const heartbeat = () => admin`
      update game.challenges set creator_seen_at = now() where id = ${id}`;
    expect(await pokedBy(both, heartbeat)).toStrictEqual([[], []]);
    const decline = () => admin`
      update game.challenges set invitee_declined_at = now() where id = ${id}`;
    expect(await pokedBy(both, decline)).toStrictEqual([['match'], ['inbox']]);
  });
});

describe('crossed challenges (ADR 0086)', () => {
  it('pokes each player once for the merge: the inbox that lost one, the lobby that moved on', async () => {
    const sam = await newAccount(deps, admin);
    const jo = await newAccount(deps, admin);
    const id = await befriend(admin, sam, jo);
    const send = (from: Player) =>
      from.browser.call(challenges, 'POST', '/api/v1/challenges', {
        format: 'reveal',
        bestOf: 3,
        requestId: crypto.randomUUID(),
        live: true,
        friend: id,
      });
    const samsLink = tokenOf(await send(sam));
    expect((await send(jo)).status).toBe(201);
    // Jo accepts Sam's: Jo's lobby is cancelled (Sam's inbox loses it, Jo's lobby reads) and Sam's
    // is accepted (Sam's lobby reads, Jo's inbox loses it). One of each, never twice.
    const poked = await pokedBy([sam, jo], () =>
      jo.browser.call(challengeOne, 'POST', `/api/v1/challenges/${samsLink}/accept`, {}),
    );
    expect(poked.map((events) => [...events].sort())).toStrictEqual([
      ['inbox', 'match'],
      ['inbox', 'match'],
    ]);
  });
});

describe('a start lineup', () => {
  it('pokes both when one opens or locks in, never on a draft', async () => {
    const a = await newPlayer(deps);
    const b = await newPlayer(deps);
    const both = [a, b];
    const [start] = await admin<{ id: string }[]>`
      insert into game.starts (player_a, player_b, format, best_of, deadline_at)
      values (${a.userId}, ${b.userId}, 'reveal', 3, now() + interval '60 seconds')
      returning id`;
    const id = start?.id ?? '';
    const open = () => admin`update game.starts set opened_a = now() where id = ${id}`;
    expect(await pokedBy(both, open)).toStrictEqual([['match'], ['match']]);
    const draft = () => admin`
      update game.starts set draft_a = '{archer}', draft_seq_a = 1 where id = ${id}`;
    expect(await pokedBy(both, draft)).toStrictEqual([[], []]);
    const lock = () => admin`update game.starts set locked_b = now() where id = ${id}`;
    expect(await pokedBy(both, lock)).toStrictEqual([['match'], ['match']]);
  });
});

describe('a rematch', () => {
  it('pokes both players’ match and inbox when asked and when answered', async () => {
    const { id, players } = await liveMatch();
    const both = [players.a, players.b];
    const ask = () => admin`insert into game.rematches (series_id, asked_by) values (${id}, 'a')`;
    const each = ['match', 'inbox'];
    expect(await pokedBy(both, ask)).toStrictEqual([each, each]);
    const no = () => admin`update game.rematches set declined_by = 'b' where series_id = ${id}`;
    expect(await pokedBy(both, no)).toStrictEqual([each, each]);
  });
});

describe('a series by turns (ADR 0085)', () => {
  it('pokes both players’ match and inbox when made and on a move; nobody on a read', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const both = [players.a, players.b];
    let id = '';
    const made = async () => {
      id = await newSeries(deps, players, 'reveal');
    };
    const each = ['match', 'inbox'];
    expect(await pokedBy(both, made)).toStrictEqual([each, each]);
    const seen = await read(players.a, id);
    const side = dueSides(seen)[0] ?? 'a';
    const move = async () => {
      const answer = await pick(players[side], id, 0, leftOf(seen, side)[0] ?? 'archer');
      if (answer.status !== 200) throw new Error(`The pick answered ${String(answer.status)}`);
    };
    expect(await pokedBy(both, move)).toStrictEqual([each, each]);
    expect(
      await pokedBy(both, async () => {
        await read(players.a, id);
        await read(players.b, id);
      }),
    ).toStrictEqual([[], []]);
  });
});

describe('game.poke', () => {
  it('is the database’s alone: neither the API nor a page may call it', async () => {
    const rows = await admin<{ role: string; allowed: boolean }[]>`
      select r.role, has_function_privilege(r.role, 'game.poke(uuid, text)', 'execute') as allowed
      from (values ('anon'), ('authenticated'), ('game_api')) as r (role)`;
    expect(rows.filter((row) => row.allowed)).toStrictEqual([]);
  });

  it('starts switched off', async () => {
    const [row] = await admin<{ enabled: boolean }[]>`
      select enabled from game.flags where name = 'poke'`;
    expect(row !== undefined).toBe(true);
    // The migration's own value: read from its text, since this file turns the flag on.
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync(
      new URL('../../supabase/migrations/20261124120000_poke.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain("insert into game.flags (name, enabled) values ('poke', false);");
  });
});
