import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../../sim/balls/index.ts';
import { randomBot } from '../../sim/bot.ts';
import { RULESET_VERSION } from '../../sim/ruleset.ts';
import {
  recordOutcome,
  recordPick,
  startSeries,
  type Format,
  type SeriesState,
} from '../../sim/series.ts';
import { betweenLine } from '../series-text.ts';
import { botAnswers, pairingOf, pickChoiceOf, trackOf } from './series-view.ts';

const series = (format: Format) =>
  startSeries({
    ruleset: RULESET_VERSION,
    opponent: { kind: 'player' },
    seed: 1,
    a: ['brawler', 'archer', 'vampire'],
    b: ['thorns', 'speedster', 'frost'],
    format,
  });

/** Plays on: each step a pick (a ball id) or an outcome ('a', 'b' or 'draw'). */
const play = (state: SeriesState, ...steps: string[]) =>
  steps.reduce(
    (at, step) =>
      step === 'a' || step === 'b' || step === 'draw'
        ? recordOutcome(at, step)
        : recordPick(at, step),
    state,
  );

const nameOf = (id: string) => id;

describe('reveal', () => {
  // Round 1: the bot shows Thorns, the player answers Archer and wins. Round 2: the player shows
  // Brawler, the bot answers Speedster and wins. Round 3 is what is left: Vampire vs Frost.
  const atRound3 = play(series('reveal'), 'thorns', 'archer', 'a', 'brawler', 'speedster', 'b');

  it('names the bot’s last ball before round 3, since both lineups are revealed', () => {
    expect(pairingOf(atRound3)).toStrictEqual({
      round: 2,
      you: 'vampire',
      bot: 'frost',
      attempt: 0,
    });
    expect(
      betweenLine(atRound3, { round: 2, attempt: 0, seed: 0, a: 'vampire', b: 'frost' }, nameOf),
    ).toBe('Next, round 3: your vampire against the bot’s frost.');
  });

  it('puts the bot’s other two under round 2 once it has shown its round-1 ball', () => {
    const [round1, round2, round3] = trackOf(play(series('reveal'), 'thorns'), undefined);
    expect(round1?.bot).toStrictEqual({ ball: 'thorns' });
    expect(round2?.bot).toStrictEqual({ pool: ['speedster', 'frost'] });
    expect(round3?.bot).toStrictEqual({});
  });

  it('asks round 1 as an answer to the ball the bot showed', () => {
    const choice = pickChoiceOf(play(series('reveal'), 'thorns'));
    expect(choice?.kind).toBe('answer');
    expect(choice?.options.map((option) => option.faces)).toStrictEqual([
      ['thorns'],
      ['thorns'],
      ['thorns'],
    ]);
  });

  it('asks round 2 as a ball to show, with the bot’s possible answers to each', () => {
    const choice = pickChoiceOf(play(series('reveal'), 'thorns', 'archer', 'a'));
    expect(choice?.kind).toBe('show');
    expect(choice?.options.map((option) => option.ball)).toStrictEqual(['brawler', 'vampire']);
    for (const option of choice?.options ?? []) {
      expect(option.faces.length).toBeGreaterThan(0);
      expect(['speedster', 'frost']).toEqual(expect.arrayContaining([...option.faces]));
    }
  });

  it('shows the bot’s unplayed balls as a pool on the track until one is chosen', () => {
    const [round1, round2, round3] = trackOf(
      play(series('reveal'), 'thorns', 'archer', 'a'),
      undefined,
    );
    expect(round1).toMatchObject({ when: 'played', you: { ball: 'archer', result: 'won' } });
    expect(round1?.bot).toStrictEqual({ ball: 'thorns', result: 'lost' });
    expect(round2).toMatchObject({ when: 'now', you: {}, bot: { pool: ['speedster', 'frost'] } });
    expect(round3).toMatchObject({ when: 'later', bot: {} });
  });
});

describe('the bot’s answer preview', () => {
  it('always holds the answer the bot really gives', () => {
    const roster = [...BALL_LOOKUP.keys()];
    for (const shown of roster) {
      for (const first of roster) {
        for (const second of roster) {
          if (first === second) continue;
          const preview = botAnswers([first, second], shown);
          for (let seed = 0; seed < 8; seed += 1) {
            expect(preview).toContain(randomBot.answer(seed, 1, [first, second], shown));
          }
        }
      }
    }
  });

  it('names one ball when the counter map ranks one answer best', () => {
    // The Vampire is favoured against the Venom and even with the Frost, so against a Vampire the
    // bot answers with the Frost.
    expect(botAnswers(['venom', 'frost'], 'vampire')).toStrictEqual(['frost']);
  });
});

describe('blind and loser picks next', () => {
  it('never shows the bot’s next ball in a blind series', () => {
    const state = play(series('blind'), 'a');
    expect(pairingOf(state)?.bot).toBeUndefined();
    expect(trackOf(state, undefined)[1]?.bot).toStrictEqual({});
    // The player's own order is set, so their later balls show.
    expect(trackOf(state, undefined)[2]?.you).toStrictEqual({ ball: 'vampire' });
  });

  it('shows the winner’s next ball to the player who lost and must pick', () => {
    const lost = play(series('loser'), 'b');
    expect(pickChoiceOf(lost)).toStrictEqual({
      kind: 'answer',
      options: [
        { ball: 'archer', faces: ['speedster'] },
        { ball: 'vampire', faces: ['speedster'] },
      ],
    });
    // Having won, the bot's next ball stays hidden from a player who has nothing to pick.
    expect(pairingOf(play(series('loser'), 'a'))?.bot).toBeUndefined();
  });

  it('leaves unplayed rounds off the track once the series is decided', () => {
    expect(trackOf(play(series('blind'), 'a', 'a'), undefined)).toHaveLength(2);
  });
});
