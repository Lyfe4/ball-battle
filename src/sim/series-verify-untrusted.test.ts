// verifySeries as the one gate for a series from outside (ADR 0022): a link, a save, or later a
// server's request body, read as `unknown`. It refuses anything that isn't a setup with a reason,
// and never throws.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { randomBot } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import { setupWithPicks, type SeriesSetup } from './series.ts';
import { verifySeries } from './series-verify.ts';
import { playLikeTheGame } from './test-support.ts';

const ids = BALLS.map((ball) => ball.id);

/** A whole Showdown series against the bot, as its link holds it. */
const showdown: SeriesSetup = setupWithPicks(
  playLikeTheGame(
    {
      ruleset: RULESET_VERSION,
      seed: 3,
      a: randomBot.pickLineup(1003, ids),
      b: randomBot.pickLineup(3, ids),
      opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: 3 },
      format: 'showdown',
    },
    BALL_LOOKUP,
  ),
);

const reasonOf = (raw: unknown) => {
  const verdict = verifySeries(raw, BALL_LOOKUP);
  return verdict.ok ? 'ok' : verdict.reason;
};

describe('verifySeries, given untrusted input', () => {
  it('accepts the series itself, from JSON as from code', () => {
    expect(reasonOf(showdown)).toBe('ok');
    expect(reasonOf(JSON.parse(JSON.stringify(showdown)))).toBe('ok');
  });

  it('refuses an unknown format rather than playing it as Showdown', () => {
    expect(reasonOf({ ...showdown, format: 'weird' })).toBe('Unknown format');
  });

  it('refuses an unknown opponent kind rather than skipping the bot checks', () => {
    expect(reasonOf({ ...showdown, opponent: { kind: 'banana' } })).toBe('Unknown opponent kind');
  });

  it('refuses malformed fields with a reason instead of throwing', () => {
    expect(reasonOf({ ...showdown, a: 'abc' })).toBe(
      'A lineup is not 3 different balls from the roster',
    );
    expect(reasonOf({ ...showdown, opponent: null })).toBe('Unknown opponent kind');
    expect(reasonOf({ ...showdown, picks: 'abc' })).toBe('The picks are not balls from the roster');
    expect(reasonOf(null)).toBe('The series is not an object');
  });

  it('says a ruleset that is not a number is malformed, not another ruleset', () => {
    expect(reasonOf({ ...showdown, ruleset: String(RULESET_VERSION) })).toBe(
      'The ruleset is not a 32-bit unsigned integer',
    );
    expect(reasonOf({ ...showdown, ruleset: RULESET_VERSION - 1 })).toBe(
      `Played under ruleset ${String(RULESET_VERSION - 1)}, not ${String(RULESET_VERSION)}`,
    );
  });
});
