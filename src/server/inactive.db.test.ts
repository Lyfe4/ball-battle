// Guests not seen for 90 days are deleted by the sweep (ADR 0052, "Guests"; ADR 0068), the way
// "Forget me" deletes one, and nobody seen more recently is touched.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { INACTIVE_ACCOUNT_DAYS, INACTIVE_DAYS } from './inactive.ts';
import { sweep } from './sweep.ts';
import { adminSql, testDeps } from './test/support.ts';
import { newPlayer, newSeries, read, type Player } from './test/series-support.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
  // Earlier runs' players are recent; nothing else here is older than these tests make it.
  await admin`update game.profiles set last_seen_at = now() where last_seen_at < now()`;
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** Moves a player's last visit `days` back. */
async function lastSeen(player: Player, days: number): Promise<void> {
  await admin`
    update game.profiles set last_seen_at = now() - make_interval(days => ${days}::int)
    where user_id = ${player.userId}`;
}

async function exists(
  player: Player,
): Promise<{ auth: boolean; profile: boolean; sessions: number }> {
  const [auth] = await admin<{ n: number }[]>`
    select count(*)::int as n from auth.users where id = ${player.userId}`;
  const [profile] = await admin<{ n: number }[]>`
    select count(*)::int as n from game.profiles where user_id = ${player.userId}`;
  const [sessions] = await admin<{ n: number }[]>`
    select count(*)::int as n from auth.sessions where user_id = ${player.userId}`;
  return { auth: auth?.n === 1, profile: profile?.n === 1, sessions: sessions?.n ?? 0 };
}

describe('guests not seen for 90 days', () => {
  it('are deleted with their sessions; one seen a day sooner stays', async () => {
    const gone = await newPlayer(deps);
    const kept = await newPlayer(deps);
    await lastSeen(gone, INACTIVE_DAYS + 1);
    await lastSeen(kept, INACTIVE_DAYS - 1);
    expect((await exists(gone)).sessions).toBeGreaterThan(0);

    expect((await sweep(deps)).inactive).toBeGreaterThanOrEqual(1);
    expect(await exists(gone)).toStrictEqual({ auth: false, profile: false, sessions: 0 });
    expect(await exists(kept)).toMatchObject({ auth: true, profile: true });
  });

  it('forfeit an open series to the player still here, who keeps it in their history', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const id = await newSeries(deps, players, 'reveal');
    await lastSeen(players.b, INACTIVE_DAYS + 5);
    await sweep(deps);
    const seen = await read(players.a, id);
    expect(seen.status).toBe('forfeit');
    expect(seen.winner).toBe('a');
    expect(seen.names.b).toBeNull();
  });

  it('are deleted past one that Auth refuses, which the run still reports', async () => {
    const stuck = await newPlayer(deps);
    const gone = await newPlayer(deps);
    await lastSeen(stuck, INACTIVE_DAYS + 60);
    await lastSeen(gone, INACTIVE_DAYS + 50);
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input instanceof Request ? input.url : input).endsWith(`/admin/users/${stuck.userId}`)
        ? Promise.resolve(Response.json({ error_code: 'unexpected_failure' }, { status: 500 }))
        : realFetch(input, init),
    );
    await expect(sweep(deps)).rejects.toThrow();
    expect((await exists(gone)).auth).toBe(false);
    expect((await exists(stuck)).auth).toBe(true);
    vi.restoreAllMocks();
    await sweep(deps);
    expect((await exists(stuck)).auth).toBe(false);
  });

  it('are deleted once: a second sweep finds nobody to delete', async () => {
    const gone = await newPlayer(deps);
    await lastSeen(gone, INACTIVE_DAYS + 30);
    await sweep(deps);
    expect((await sweep(deps)).inactive).toBe(0);
  });
});

describe('accounts (ADR 0079)', () => {
  it('are kept past a guest’s 90 days, and deleted after 24 months unseen', async () => {
    const account = await newPlayer(deps);
    const guest = await newPlayer(deps);
    await admin`update game.profiles set account_at = now() where user_id = ${account.userId}`;
    await lastSeen(account, INACTIVE_DAYS + 30);
    await lastSeen(guest, INACTIVE_DAYS + 30);
    await sweep(deps);
    expect((await exists(account)).profile).toBe(true);
    expect((await exists(guest)).profile).toBe(false);
    await lastSeen(account, INACTIVE_ACCOUNT_DAYS + 1);
    await sweep(deps);
    expect(await exists(account)).toStrictEqual({ auth: false, profile: false, sessions: 0 });
  });
});
