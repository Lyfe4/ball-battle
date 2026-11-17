import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { BALL_SOUNDS, SHARED_SOUNDS } from './ball-sounds.ts';
import { FIGHT_CUES } from './cue-names.ts';

describe('BALL_SOUNDS', () => {
  it('names every ball in the roster', () => {
    expect(Object.keys(BALL_SOUNDS).sort()).toStrictEqual(BALLS.map((ball) => ball.id).sort());
  });

  it('gives every fight sound to exactly one ball, or to all of them', () => {
    const owned = Object.values(BALL_SOUNDS)
      .flat()
      .filter((kind) => kind !== 'bump');
    expect(new Set(owned).size).toBe(owned.length);
    expect([...new Set([...owned, ...SHARED_SOUNDS])].sort()).toStrictEqual([...FIGHT_CUES].sort());
  });

  it('leaves the Brawler only the shared bump', () => {
    expect(BALL_SOUNDS['brawler']).toStrictEqual(['bump']);
  });
});
