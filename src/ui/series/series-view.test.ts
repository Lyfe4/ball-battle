import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, botPick, randomBot } from '../../sim/bot.ts';
import { RULESET_VERSION } from '../../sim/ruleset.ts';
import {
  awaitingPick,
  FORMATS,
  recordOutcome,
  recordPick,
  startSeries,
  type Format,
  type SeriesState,
} from '../../sim/series.ts';
import { betweenLine } from '../series-text.ts';
import { pairingOf, pickChoiceOf, seriesScreenOf, trackOf } from './series-view.ts';

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
    expect(pickChoiceOf(play(series('reveal'), 'thorns'))).toStrictEqual({
      kind: 'answer',
      facing: 'thorns',
      options: ['brawler', 'archer', 'vampire'],
      opponents: ['thorns', 'speedster', 'frost'],
    });
  });

  it('asks round 2 as a ball to show, marked against every ball the bot has left', () => {
    expect(pickChoiceOf(play(series('reveal'), 'thorns', 'archer', 'a'))).toStrictEqual({
      kind: 'show',
      options: ['brawler', 'vampire'],
      opponents: ['speedster', 'frost'],
    });
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

describe('the bot’s choices (ADR 0035)', () => {
  it('never shows a choice the bot has not made, in any format, at any level', () => {
    let checked = 0;
    for (const format of FORMATS) {
      for (const bot of [randomBot, ...BOT_LEVELS]) {
        for (let seed = 0; seed < 12; seed++) {
          let state = startSeries({
            ruleset: RULESET_VERSION,
            opponent: { kind: 'bot', bot: bot.id, lineupSeed: seed },
            seed,
            a: ['brawler', 'archer', 'vampire'],
            b: ['thorns', 'speedster', 'frost'],
            format,
          });
          for (let guard = 0; guard < 12 && state.winner === undefined; guard++) {
            const due = awaitingPick(state);
            if (due === 'a') {
              const choice = pickChoiceOf(state);
              const moment = { state, current: undefined, settled: true, linkState: undefined };
              const screen = seriesScreenOf(moment);
              // The bot's coming pick, worked out ahead: nothing on screen may single it out. Its
              // balls are all listed as columns, so only the rest of the screen is searched.
              const ahead = recordPick(state, choice?.options[0] ?? '');
              const coming = botPick(bot, ahead);
              const said = JSON.stringify({ ...screen, choice: { ...choice, opponents: [] } });
              if (coming !== undefined) {
                expect(said, `${format} ${bot.id} ${String(seed)}`).not.toContain(coming);
                checked++;
              }
              state = ahead;
            } else if (due === 'b') {
              state = recordPick(state, botPick(bot, state) ?? '');
            } else {
              state = recordOutcome(state, guard % 2 === 0 ? 'a' : 'b');
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('showdown', () => {
  it('asks round 1 as an opener, marked against the bot’s whole lineup', () => {
    expect(pickChoiceOf(series('showdown'))).toStrictEqual({
      kind: 'open',
      options: ['brawler', 'archer', 'vampire'],
      opponents: ['thorns', 'speedster', 'frost'],
    });
    // The bot's other two wait under round 2 once round 1 is set.
    const [, round2] = trackOf(play(series('showdown'), 'archer', 'thorns'), undefined);
    expect(round2?.bot).toStrictEqual({ pool: ['speedster', 'frost'] });
  });

  it('has the winner show first and the loser answer the shown ball', () => {
    expect(pickChoiceOf(play(series('showdown'), 'archer', 'thorns', 'a'))?.kind).toBe('show');
    const lost = play(series('showdown'), 'archer', 'thorns', 'b', 'frost');
    expect(pickChoiceOf(lost)).toMatchObject({ kind: 'answer', facing: 'frost' });
  });
});

describe('blind', () => {
  it('never shows the bot’s next ball in a blind series', () => {
    const state = play(series('blind'), 'a');
    expect(pairingOf(state)?.bot).toBeUndefined();
    expect(trackOf(state, undefined)[1]?.bot).toStrictEqual({});
    // The player's own order is set, so their later balls show.
    expect(trackOf(state, undefined)[2]?.you).toStrictEqual({ ball: 'vampire' });
  });

  it('leaves unplayed rounds off the track once the series is decided', () => {
    expect(trackOf(play(series('blind'), 'a', 'a'), undefined)).toHaveLength(2);
  });
});
