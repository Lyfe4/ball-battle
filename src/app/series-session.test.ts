import { RULESET_VERSION } from '../sim/ruleset.ts';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { botPick, randomBot } from '../sim/bot.ts';
import {
  awaitingPick,
  remainingOf,
  revealFirst,
  setupWithPicks,
  startSeries,
  type SeriesSetup,
} from '../sim/series.ts';
import { playLikeTheGame } from '../sim/test-support.ts';
import { matchWorld, playSeries, playToEnd, verifySeries } from '../sim/series-verify.ts';
import {
  advanceSession,
  pickInSession,
  beginSession,
  rematchOf,
  replayPickDue,
  resolvePicks,
  seriesAddress,
  settleCurrent,
  showBotBallNow,
  type SeriesSession,
} from './series-session.ts';

const setup: SeriesSetup = {
  ruleset: RULESET_VERSION,
  opponent: { kind: 'player' },
  seed: 77,
  a: ['frost', 'thorns', 'sniper'],
  b: ['venom', 'archer', 'speedster'],
};

describe('series session', () => {
  it('records a match once, only when it has finished', () => {
    const session = beginSession(setup);
    const current = session.current;
    if (current === undefined) throw new Error('expected a first match');
    const start = matchWorld(current, BALL_LOOKUP);
    expect(settleCurrent(session, start)).toBe(session);

    const end = playToEnd(start, BALL_LOOKUP);
    const settled = settleCurrent(session, end);
    expect(settled.recorded).toBe(true);
    expect(settled.state.rounds.length + settled.state.pending.length).toBe(1);
    // Later frames show the same finished world: nothing is recorded twice.
    expect(settleCurrent(settled, end)).toBe(settled);
  });

  it('only moves on after recording', () => {
    const session = beginSession(setup);
    expect(advanceSession(session)).toBe(session);
  });

  it('plays the same series as the headless run, match by match', () => {
    let session: SeriesSession = beginSession(setup);
    let guard = 0;
    while (session.current !== undefined) {
      const end = playToEnd(matchWorld(session.current, BALL_LOOKUP), BALL_LOOKUP);
      session = advanceSession(settleCurrent(session, end));
      expect(++guard).toBeLessThan(20);
    }
    expect(session.state).toStrictEqual(playSeries(setup, BALL_LOOKUP));
  });
});

describe('series session, showdown', () => {
  const showdown: SeriesSetup = { ...setup, format: 'showdown' };

  it('has no current match while a pick is due, and plays the picked ball after it', () => {
    let session = beginSession(showdown);
    expect(session.current).toBeUndefined();
    session = pickInSession(pickInSession(session, showdown.a[0]), showdown.b[0]);
    // Play round 1 to its end, whatever its result.
    for (;;) {
      const current = session.current;
      if (current === undefined) throw new Error('expected a match');
      session = settleCurrent(session, playToEnd(matchWorld(current, BALL_LOOKUP), BALL_LOOKUP));
      session = advanceSession(session);
      if (session.state.rounds.length > 0) break;
    }
    const due = awaitingPick(session.state);
    if (due === undefined) throw new Error('expected a pick after round 1');
    expect(session.current).toBeUndefined();
    // The winner shows first; there is still no match until the loser answers.
    const shown = remainingOf(session.state, due).at(-1) ?? '';
    const waiting = pickInSession(session, shown);
    expect(waiting.current).toBeUndefined();
    const other = due === 'a' ? 'b' : 'a';
    expect(awaitingPick(waiting.state)).toBe(other);
    const answer = remainingOf(waiting.state, other)[0] ?? '';
    const picked = pickInSession(waiting, answer);
    expect(picked.current?.[due]).toBe(shown);
    expect(picked.current?.[other]).toBe(answer);
    expect(picked.recorded).toBe(false);
  });
});

describe('series session, picks and the address bar', () => {
  const ids = [...BALL_LOOKUP.keys()];
  const reveal: SeriesSetup = {
    ruleset: RULESET_VERSION,
    seed: 31,
    a: ['frost', 'thorns', 'sniper'],
    b: randomBot.pickLineup(31, ids),
    opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: 31 },
    format: 'reveal',
  };
  const decided = setupWithPicks(playLikeTheGame(reveal, BALL_LOOKUP));

  it('makes the bot’s pick at once and stops when the player is due', () => {
    const session = resolvePicks(beginSession(reveal), randomBot);
    expect(session.state.picks).toStrictEqual([
      { round: 0, side: 'b', ball: botPick(randomBot, startSeries(reveal)) },
    ]);
    expect(awaitingPick(session.state)).toBe('a');
    expect(replayPickDue(session)).toBeUndefined();
    expect(resolvePicks(session, randomBot)).toBe(session);
  });

  it('replays a link’s picks in order, both sides’, and plays it to the same end', () => {
    let session = resolvePicks(beginSession(decided, true), randomBot);
    // The link's first two picks (the bot's, then the player's answer) are made at once.
    expect(session.state.picks.map((pick) => pick.ball)).toStrictEqual(decided.picks?.slice(0, 2));
    let guard = 0;
    while (session.current !== undefined) {
      const end = playToEnd(matchWorld(session.current, BALL_LOOKUP), BALL_LOOKUP);
      session = resolvePicks(advanceSession(settleCurrent(session, end)), randomBot);
      expect(++guard).toBeLessThan(20);
    }
    expect(session.state).toStrictEqual(playSeries(decided, BALL_LOOKUP));
  });

  it('shows the bot’s ball at once when it shows first in round 2, keeping the round on screen', () => {
    // Seed 5's toss goes to the player, so the bot answers in round 1 and shows first in round 2.
    const won: SeriesSetup = { ...reveal, seed: 5 };
    expect(revealFirst(won.seed)).toBe('a');
    let session = resolvePicks(beginSession(won), randomBot);
    expect(awaitingPick(session.state)).toBe('a');
    expect(showBotBallNow(session, randomBot)).toBe(session);
    session = resolvePicks(pickInSession(session, 'frost'), randomBot);
    if (session.current === undefined) throw new Error('expected round 1');
    const end = playToEnd(matchWorld(session.current, BALL_LOOKUP), BALL_LOOKUP);
    const settled = settleCurrent(session, end);
    const shown = showBotBallNow(settled, randomBot);
    expect(shown.current).toBe(settled.current);
    expect(shown.recorded).toBe(true);
    expect(awaitingPick(shown.state)).toBe('a');
    expect(shown.state.picks.at(-1)).toStrictEqual({
      round: 1,
      side: 'b',
      ball: botPick(randomBot, settled.state),
    });
    // The bot answers in round 2 of a series whose toss it won: nothing to show early.
    let lost = resolvePicks(beginSession(reveal), randomBot);
    lost = resolvePicks(pickInSession(lost, 'frost'), randomBot);
    if (lost.current === undefined) throw new Error('expected round 1');
    const lostEnd = settleCurrent(
      lost,
      playToEnd(matchWorld(lost.current, BALL_LOOKUP), BALL_LOOKUP),
    );
    expect(showBotBallNow(lostEnd, randomBot)).toBe(lostEnd);
  });

  it('says when the link holds the due pick, so the player is not asked for it', () => {
    const live = beginSession(decided);
    const replay = beginSession(decided, true);
    expect(replayPickDue(live)).toBeUndefined();
    expect(replayPickDue(replay)).toBe(decided.picks?.[0]);
  });

  it('keeps the bot’s lineup out of the address bar until the series is decided', () => {
    const live = resolvePicks(beginSession(reveal), randomBot);
    expect(seriesAddress(live)).toStrictEqual({ format: 'reveal' });
    expect(seriesAddress(beginSession(decided, true))).toStrictEqual({ setup: decided });
    // Play it live as the game does, the player making the same picks as in `decided`.
    const own = playLikeTheGame(reveal, BALL_LOOKUP)
      .picks.filter((pick) => pick.side === 'a')
      .map((pick) => pick.ball);
    let session = live;
    while (session.state.winner === undefined) {
      expect(seriesAddress(session)).toStrictEqual({ format: 'reveal' });
      const ball = own[0];
      if (awaitingPick(session.state) === 'a' && ball !== undefined) {
        own.shift();
        session = resolvePicks(pickInSession(session, ball), randomBot);
        continue;
      }
      if (session.current === undefined) throw new Error('expected a match');
      const end = playToEnd(matchWorld(session.current, BALL_LOOKUP), BALL_LOOKUP);
      session = resolvePicks(advanceSession(settleCurrent(session, end)), randomBot);
    }
    expect(session.state.winner).toBeDefined();
    expect(seriesAddress(session)).toStrictEqual({ setup: decided });
  });

  it('rematches on a new seed with the same lineups, under today’s rules, the bot’s seed kept', () => {
    const old = { ...decided, ruleset: 0 };
    expect(rematchOf(old, 9)).toStrictEqual({
      ruleset: RULESET_VERSION,
      seed: 9,
      a: reveal.a,
      b: reveal.b,
      opponent: reveal.opponent,
      format: 'reveal',
    });
    expect(
      verifySeries(setupWithPicks(playLikeTheGame(rematchOf(old, 9), BALL_LOOKUP)), BALL_LOOKUP).ok,
    ).toBe(true);
  });
});
