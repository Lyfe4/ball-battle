// One live invitation per pair (ADR 0089 addendum of 2026-11-28), against the local database: a
// rematch offer counts like a live challenge to a friend. A challenge sent to the friend whose
// offer waits for you is your yes to it, on its rules (both want to play); a send takes back your
// own offer; a rematch asked while their challenge waits is refused; sends and answers at once on
// two connections leave one thing. And a live challenge to a friend ends unanswered after
// INVITE_ANSWER_MS, read by both without a write.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChallengeInfo, ChallengeLink } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { InboxResponse } from '../../api/friends.ts';
import { INVITE_ANSWER_MS, type CurrentMatchResponse } from '../../api/live.ts';
import type { RematchView } from '../../api/rematch.ts';
import type { SeriesView } from '../../api/series.ts';
import { befriend, makeAccount, newAccount } from '../test/friends-support.ts';
import { linkInfo, startedLive, tokenOf } from '../test/live-support.ts';
import type { Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { meInbox, meMatch } from './me.ts';
import { seriesOne } from './series.ts';

const deps = testDeps();
/** A second function instance, with its own connection: the other phone at the same moment. */
const other = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await other.sql.end();
  await admin.end();
});

const code = (body: unknown) => errorOf(body)?.code;
const challengeTo = (from: Player, friend: string, rules = { format: 'reveal', bestOf: 3 }) =>
  from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    ...rules,
    requestId: crypto.randomUUID(),
    live: true,
    friend,
  });
const rematch = (player: Player, id: string, answer?: 'yes' | 'no') =>
  player.browser.call(
    seriesOne,
    answer === undefined ? 'GET' : 'POST',
    `/api/v1/series/${id}/rematch`,
    answer === undefined ? undefined : { answer },
  );
const rematchOf = async (player: Player, id: string) =>
  (await rematch(player, id)).body as RematchView;
const inboxOf = async (player: Player) =>
  (await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox')).body as InboxResponse;
const matchOf = async (player: Player) =>
  ((await player.browser.call(meMatch, 'GET', '/api/v1/me/match')).body as CurrentMatchResponse)
    .match;
/** The challenges between the two still waiting (not accepted, not called off). */
const waitingBetween = async (a: Player, b: Player) =>
  (
    await admin<{ n: number }[]>`
      select count(*)::int as n from game.challenges
      where series_id is null and start_id is null and cancelled_at is null and expires_at > now()
        and ((creator = ${a.userId} and invitee = ${b.userId})
          or (creator = ${b.userId} and invitee = ${a.userId}))`
  )[0]?.n;

/** Two friends whose live match just ended (A left it): a rematch can be asked. */
async function endedFriends() {
  const made = await startedLive(deps, admin);
  const { a, b } = made.players;
  const left = await a.browser.call(seriesOne, 'POST', `/api/v1/series/${made.id}/forfeit`, {});
  expect((left.body as SeriesView).status).toBe('forfeit');
  await makeAccount(admin, a);
  await makeAccount(admin, b);
  return { id: made.id, a, b, friend: await befriend(admin, a, b) };
}

describe('a rematch offer is the pair’s one live invitation', () => {
  it('a challenge sent to the friend whose offer waits is the yes to it, on its rules', async () => {
    // The owner's sequence: B offers a rematch; A goes home, presses Play, picks B and sends a
    // challenge on other rules.
    const { id, a, b, friend } = await endedFriends();
    expect((await rematch(b, id, 'yes')).status).toBe(200);
    const sent = await challengeTo(a, friend, { format: 'showdown', bestOf: 5 });
    expect(sent.status).toBe(201);
    const link = sent.body as ChallengeLink;
    // The rematch's rules (the match before: Reveal, Best of 3), and no link was made.
    expect(link).toMatchObject({ format: 'reveal', bestOf: 3, rematchOf: id, token: '' });
    expect(await rematchOf(b, id)).toMatchObject({ state: 'agreed', startId: link.startId });
    expect(await matchOf(a)).toMatchObject({ kind: 'start', id: link.startId });
    expect(await matchOf(b)).toMatchObject({ kind: 'start', id: link.startId });
    expect(await waitingBetween(a, b)).toBe(0);
    expect((await inboxOf(b)).invites).toStrictEqual([]);
  });

  it('a send takes back the sender’s own offer: one invitation out at a time', async () => {
    const { id, a, b, friend } = await endedFriends();
    expect((await rematch(a, id, 'yes')).status).toBe(200);
    const sent = await challengeTo(a, friend);
    expect(sent.status).toBe(201);
    expect((sent.body as ChallengeLink).startId).toBeUndefined();
    expect(await rematchOf(b, id)).toMatchObject({ state: 'declined', declinedBy: 'a' });
    expect((await inboxOf(b)).invites).toHaveLength(1);
  });

  it('a rematch asked while their challenge waits is refused: answer theirs', async () => {
    const { id, a, b, friend } = await endedFriends();
    tokenOf(await challengeTo(a, friend));
    const asked = await rematch(b, id, 'yes');
    expect(asked.status).toBe(409);
    expect(code(asked.body)).toBe('their_challenge_waiting');
    expect(await rematchOf(a, id)).toMatchObject({ state: 'none' });
    expect(await waitingBetween(a, b)).toBe(1);
  });

  it('a yes to a rematch stops the agreer’s own lobby for someone else', async () => {
    const { id, a, b } = await endedFriends();
    const kim = await newAccount(deps, admin);
    const kimFriend = await befriend(admin, a, kim);
    tokenOf(await challengeTo(a, kimFriend));
    expect((await rematch(b, id, 'yes')).status).toBe(200);
    expect(await rematchOf(a, id)).toMatchObject({ state: 'asked' });
    expect((await rematch(a, id, 'yes')).status).toBe(200);
    expect(await rematchOf(a, id)).toMatchObject({ state: 'agreed' });
    expect((await inboxOf(kim)).invites).toStrictEqual([]);
  });
});

describe('at the same moment, on two connections', () => {
  it('two friends challenging each other make one pair of lineups, every time', async () => {
    for (let round = 0; round < 4; round += 1) {
      const a = await newAccount(deps, admin);
      const b = await newAccount(deps, admin);
      const friend = await befriend(admin, a, b);
      const [one, two] = await Promise.all([
        challengeTo(a, friend),
        challengeTo({ ...b, browser: b.browser.elsewhere(other) }, friend),
      ]);
      expect([one.status, two.status]).toStrictEqual([201, 201]);
      const starts = [one, two].map((sent) => (sent.body as ChallengeLink).startId);
      // The second send found the first's lobby and accepted it.
      expect(starts.filter((start) => start !== undefined)).toHaveLength(1);
      const start = starts.find((one) => one !== undefined);
      expect(await matchOf(a)).toMatchObject({ kind: 'start', id: start });
      expect(await matchOf(b)).toMatchObject({ kind: 'start', id: start });
      expect(await waitingBetween(a, b)).toBe(0);
    }
  });

  it('a rematch asked and a challenge sent back at once leave one live thing', async () => {
    for (let round = 0; round < 4; round += 1) {
      const { id, a, b, friend } = await endedFriends();
      const [asked, sent] = await Promise.all([
        rematch(b, id, 'yes'),
        challengeTo({ ...a, browser: a.browser.elsewhere(other) }, friend),
      ]);
      const state = (await rematchOf(a, id)).state;
      if (asked.status === 200 && (sent.body as ChallengeLink).startId !== undefined) {
        // The ask came first: the send was its yes.
        expect(state).toBe('agreed');
        expect(await waitingBetween(a, b)).toBe(0);
      } else {
        // The send came first: the ask was refused, and A's challenge waits.
        expect(code(asked.body)).toBe('their_challenge_waiting');
        expect(state).toBe('none');
        expect(await waitingBetween(a, b)).toBe(1);
      }
    }
  });

  it('a yes and a challenge from the same player at once make one pair of lineups', async () => {
    for (let round = 0; round < 3; round += 1) {
      const { id, a, b, friend } = await endedFriends();
      expect((await rematch(b, id, 'yes')).status).toBe(200);
      const [yes, sent] = await Promise.all([
        rematch(a, id, 'yes'),
        challengeTo({ ...a, browser: a.browser.elsewhere(other) }, friend),
      ]);
      expect(yes.status).toBe(200);
      // Second, the send finds A in those lineups (in_a_match); first, it was the yes itself.
      if (sent.status !== 201) expect(code(sent.body)).toBe('in_a_match');
      const view = await rematchOf(a, id);
      expect(view.state).toBe('agreed');
      expect(await matchOf(b)).toMatchObject({ kind: 'start', id: view.startId });
      expect(await waitingBetween(a, b)).toBe(0);
    }
  });
});

describe('a live challenge to a friend unanswered', () => {
  it('ends after INVITE_ANSWER_MS: the sender reads why, the friend’s banner goes', async () => {
    const a = await newAccount(deps, admin);
    const b = await newAccount(deps, admin);
    const friend = await befriend(admin, a, b);
    const token = tokenOf(await challengeTo(a, friend));
    const waiting = (await linkInfo(a, token)).body as ChallengeInfo;
    expect(waiting.status).toBe('yours');
    expect(waiting.endsInMs).toBeGreaterThan(INVITE_ANSWER_MS - 5_000);
    expect(waiting.endsInMs).toBeLessThanOrEqual(INVITE_ANSWER_MS);
    const [invite] = (await inboxOf(b)).invites;
    expect(invite?.stopsInMs).toBeLessThanOrEqual(INVITE_ANSWER_MS);
    // The minute goes by (the database's `now()` can't move: the challenge's times move back).
    await admin`
      update game.challenges set expires_at = now() - interval '1 second',
        created_at = created_at - make_interval(secs => ${INVITE_ANSWER_MS / 1000 + 1})
      where creator = ${a.userId}`;
    const ended = (await linkInfo(a, token)).body as ChallengeInfo;
    expect(ended).toMatchObject({ status: 'stopped', unanswered: true, inviteeFriend: friend });
    expect(ended.endsInMs).toBeUndefined();
    expect((await inboxOf(b)).invites).toStrictEqual([]);
    expect(await matchOf(a)).toBeNull();
    const late = await b.browser.call(
      challengeOne,
      'POST',
      `/api/v1/challenges/${token}/accept`,
      {},
    );
    expect(code(late.body)).toBe('challenge_expired');
    // Send again: a new challenge, waiting.
    expect((await challengeTo(a, friend)).status).toBe(201);
  });

  it('a link to anyone keeps no answer window: it waits while its sender does', async () => {
    const a = await newAccount(deps, admin);
    const sent = await a.browser.call(challenges, 'POST', '/api/v1/challenges', {
      format: 'reveal',
      bestOf: 3,
      requestId: crypto.randomUUID(),
      live: true,
    });
    const info = (await linkInfo(a, tokenOf(sent))).body as ChallengeInfo;
    expect(info.status).toBe('yours');
    expect(info.endsInMs).toBeUndefined();
  });
});
