import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { playToEnd } from '../sim/series-verify.ts';
import { createWorld } from '../sim/world.ts';
import { clockOf, MAX_MOMENTS, storyOf } from './match-story-data.ts';

const start = (a: string, b: string, seed: number) =>
  createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);

describe('how it was won (ADR 0036)', () => {
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

  it('keeps a few key moments in order, ending with the knockout or the time', () => {
    for (let seed = 0; seed < 6; seed++) {
      const { moments } = storyOf(start('storm', 'vampire', seed), BALL_LOOKUP);
      expect(moments.length).toBeGreaterThan(0);
      expect(moments.length).toBeLessThanOrEqual(MAX_MOMENTS);
      const ticks = moments.map((moment) => moment.tick);
      expect(ticks).toStrictEqual([...ticks].sort((x, y) => x - y));
      expect(moments.at(-1)?.text).toMatch(/knocked out|Time up/);
    }
  });

  it('reads a tick as the match clock', () => {
    expect(clockOf(0)).toBe('0:00');
    expect(clockOf(7 * 60 + 5)).toBe('0:07');
    expect(clockOf(75 * 60)).toBe('1:15');
  });
});
