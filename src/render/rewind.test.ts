import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/types.ts';
import { createRewinds } from './rewind.ts';
import { theme } from './theme.ts';

const rewound: SimEvent = {
  type: 'rewound',
  tick: 40,
  ballId: 'ball-0',
  from: { x: 500, y: 500 },
  to: { x: 300, y: 300 },
  healthBefore: 0,
  healthAfter: 50,
};

describe('the rewind on screen', () => {
  it('shows a trail from where the ball left to where it landed, fading over rewindMs', () => {
    const rewinds = createRewinds();
    rewinds.apply([rewound], 100);
    expect(rewinds.trails(100)).toStrictEqual([
      { ballId: 'ball-0', from: { x: 500, y: 500 }, to: { x: 300, y: 300 }, strength: 1 },
    ]);
    expect(rewinds.trails(100 + theme.rewindMs / 2)[0]?.strength).toBeCloseTo(0.5, 9);
    expect(rewinds.isActive(100 + theme.rewindMs - 1)).toBe(true);
    expect(rewinds.trails(100 + theme.rewindMs)).toStrictEqual([]);
    expect(rewinds.isActive(100 + theme.rewindMs)).toBe(false);
  });

  it('ignores other events and starts over on reset', () => {
    const rewinds = createRewinds();
    rewinds.apply([{ type: 'ballDefeated', tick: 1, ballId: 'ball-1', defeatedById: 'ball-0' }], 0);
    expect(rewinds.trails(0)).toStrictEqual([]);
    rewinds.apply([rewound], 0);
    rewinds.reset();
    expect(rewinds.trails(0)).toStrictEqual([]);
  });
});
