import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { playToEnd } from '../sim/series-verify.ts';
import { createWorld } from '../sim/world.ts';
import {
  BIG_HIT,
  chooseMoments,
  clockOf,
  leadTakenAt,
  MAX_MOMENTS,
  sourceWords,
  storyOf,
  type Moment,
  type SideStory,
} from './match-story-data.ts';

const start = (a: string, b: string, seed: number) =>
  createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);

describe('how it was won (ADR 0036, 0037)', () => {
  it('adds up to the health each ball lost, and puts the winner first', () => {
    for (const [a, b] of [
      ['storm', 'vampire'],
      ['venom', 'thorns'],
      ['inferno', 'necromancer'],
    ] as const) {
      const opening = start(a, b, 3);
      const end = playToEnd(opening, BALL_LOOKUP);
      const story = storyOf(opening, BALL_LOOKUP);
      for (const side of story.sides) {
        expect(side.dealt).toBe(side.sources.reduce((sum, share) => sum + share.amount, 0));
      }
      // What each ball dealt is what the other lost, net of its heals.
      for (const side of story.sides) {
        const other = story.sides.find((s) => s.ballId !== side.ballId);
        const ball = end.balls.find((x) => x.id === other?.ballId);
        const max = getDefinition(BALL_LOOKUP, other?.definitionId ?? '').maxHealth;
        expect(max - (ball?.health ?? 0) + (other?.healed ?? 0)).toBe(side.dealt);
      }
      const result = end.match.status === 'finished' ? end.match.result : undefined;
      if (result?.kind === 'win') expect(story.sides[0]?.ballId).toBe(result.winnerId);
    }
  });

  it('names damage by the ball’s ability, and contact as hits', () => {
    const story = storyOf(start('venom', 'thorns', 2), BALL_LOOKUP);
    const labels = story.sides.flatMap((side) => side.sources.map((share) => share.label));
    expect(labels).toContain('Poison');
    expect(labels).toContain('Spikes');
    expect(labels).toContain('Hits');
  });

  it('keeps a few key moments in order, always ending with the finish', () => {
    for (let seed = 0; seed < 6; seed++) {
      const { moments } = storyOf(start('storm', 'vampire', seed), BALL_LOOKUP);
      expect(moments.length).toBeGreaterThan(0);
      expect(moments.length).toBeLessThanOrEqual(MAX_MOMENTS);
      const ticks = moments.map((moment) => moment.tick);
      expect(ticks).toStrictEqual([...ticks].sort((x, y) => x - y));
      expect(moments.filter((moment) => moment.kind === 'finish')).toHaveLength(1);
      expect(moments.at(-1)?.kind).toBe('finish');
    }
  });

  it('leads with the result in one plain line, and says who hit whom', () => {
    for (let seed = 0; seed < 8; seed++) {
      const opening = start('chrono', 'titan', seed);
      const end = playToEnd(opening, BALL_LOOKUP);
      const story = storyOf(opening, BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('The match did not finish');
      const { result, reason, endTick } = end.match;
      if (result.kind === 'win') {
        const winner = story.sides[0]?.name ?? '';
        const loser = story.sides[1]?.name ?? '';
        expect(story.result).toBe(
          reason === 'knockout'
            ? `${winner} knocked out ${loser} at ${clockOf(endTick)}`
            : `Time up: ${winner} won with more health left`,
        );
      } else {
        expect(story.result).toMatch(/draw/);
      }
      for (const moment of story.moments.filter((m) => m.kind === 'bigHit')) {
        expect(moment.text).toMatch(
          /^(Chrono|Titan)\S* .*hit (Chrono|Titan) for \d+, the round’s biggest hit\.$/,
        );
      }
    }
  });

  it('chooses moments by what decided the round: finish, comeback, rewinds, then the big hit', () => {
    const at = (tick: number, kind: Moment['kind']): Moment => ({ tick, kind, text: kind });
    const all = [
      at(5, 'bigHit'),
      at(1, 'rewind'),
      at(2, 'rewind'),
      at(9, 'finish'),
      at(3, 'rewind'),
      at(6, 'lead'),
    ];
    expect(chooseMoments(all).map((m) => m.kind)).toStrictEqual([
      'rewind',
      'rewind',
      'lead',
      'finish',
    ]);
    expect(chooseMoments(all, 6).map((m) => m.tick)).toStrictEqual([1, 2, 3, 5, 6, 9]);
    expect(chooseMoments([at(9, 'finish'), at(4, 'bigHit')]).map((m) => m.kind)).toStrictEqual([
      'bigHit',
      'finish',
    ]);
    // The knockout itself can be the round's biggest hit: the finish still closes the story.
    expect(chooseMoments([at(9, 'finish'), at(9, 'bigHit')]).map((m) => m.kind)).toStrictEqual([
      'bigHit',
      'finish',
    ]);
    expect(BIG_HIT).toBe(20);
  });

  it('marks the comeback only when the winner was behind at some point', () => {
    const track = (rows: readonly (readonly [number, number])[]) =>
      rows.map(([a, b], tick) => ({
        tick,
        share: new Map([
          ['a', a],
          ['b', b],
        ]),
      }));
    // Ahead or level all the way: no comeback.
    const ahead = track([
      [1, 1],
      [1, 0.9],
      [0.8, 0.5],
      [0.6, 0],
    ]);
    expect(leadTakenAt(ahead, 'a')).toBeUndefined();
    // Behind, level, ahead, behind again, then ahead for good from tick 5.
    const comeback = track([
      [1, 1],
      [0.8, 0.9],
      [0.8, 0.8],
      [0.8, 0.7],
      [0.6, 0.7],
      [0.6, 0.5],
      [0.4, 0],
    ]);
    expect(leadTakenAt(comeback, 'a')).toBe(5);
  });

  it('says a ball’s sources only when there is more than one, or a heal', () => {
    const side: SideStory = {
      ballId: 'a',
      definitionId: 'titan',
      name: 'Titan',
      repeat: false,
      won: true,
      dealt: 61,
      sources: [{ label: 'Hits', amount: 61, ability: false }],
      healed: 0,
    };
    expect(sourceWords(side)).toBe('all hits');
    expect(
      sourceWords({
        ...side,
        healed: 12,
        sources: [
          { label: 'Poison', amount: 40, ability: true },
          { label: 'Hits', amount: 21, ability: false },
        ],
      }),
    ).toBe('Poison 40 · Hits 21 · healed 12');
  });

  it('names each slot by its label when given, so a mirror reads plainly', () => {
    const story = storyOf(start('titan', 'titan', 2), BALL_LOOKUP, [
      'your Titan',
      'the bot’s Titan',
    ]);
    expect(story.result).toMatch(
      /^(Your Titan knocked out the bot’s Titan|The bot’s Titan knocked out your Titan|Time up)/,
    );
    expect(story.sides.map((side) => side.name).sort()).toStrictEqual([
      'The bot’s Titan',
      'Your Titan',
    ]);
    for (const moment of story.moments) expect(moment.text.charAt(0)).toMatch(/[A-Z0-9]/);
  });

  it('reads a tick as the match clock', () => {
    expect(clockOf(0)).toBe('0:00');
    expect(clockOf(7 * 60 + 5)).toBe('0:07');
    expect(clockOf(75 * 60)).toBe('1:15');
  });
});
