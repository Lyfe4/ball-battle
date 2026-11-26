import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { WAIL_DAMAGE } from './banshee.ts';
import { BALLS } from './index.ts';
import { ZONE_DAMAGE as SHOCKWAVE_DAMAGE } from './quake.ts';
import { ZONE_DAMAGE as STRIKE_DAMAGE } from './storm.ts';
import { SHELL, SHELL_MOST_SHARE, throughShell, tortoise } from './tortoise.ts';

const lookup = indexDefinitions([tortoise, blue]);

function play(world: WorldState, ticks: number): SimEvent[] {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return events;
}

describe('the Tortoise (prototype)', () => {
  it('takes SHELL off a big hit and at most half of a small one', () => {
    expect(throughShell(STRIKE_DAMAGE)).toBe(STRIKE_DAMAGE - SHELL);
    expect(throughShell(SHOCKWAVE_DAMAGE)).toBe(SHOCKWAVE_DAMAGE - SHELL);
    expect(throughShell(4)).toBe(4 * (1 - SHELL_MOST_SHARE));
    expect(throughShell(1)).toBe(1 * (1 - SHELL_MOST_SHARE));
  });

  it('a head-on bump it takes lands through the shell', () => {
    const world = withBalls(createWorld(1, [tortoise, blue]), [
      { position: { x: 300, y: 500 }, velocity: { x: 0, y: 0 } },
      { position: { x: 480, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const hits = play(world, 30).filter(
      (event) => event.type === 'damage' && event.cause === 'contact',
    );
    const taken = hits.find((event) => event.type === 'damage' && event.targetId === 'ball-0');
    if (taken?.type !== 'damage') throw new Error('expected a bump');
    expect(taken.amount).toBe(Math.round(throughShell(blue.contactDamage)));
  });

  it('identity: the shell is small next to a big hit, and nothing unblockable is cut', () => {
    // Its shell is a few points: under a tenth of the Storm's strike, and the wail lands whole
    // (an unblockable hit skips every defence, ADR 0075), so it never shrugs a big hit off.
    expect(SHELL).toBeLessThan(STRIKE_DAMAGE / 10);
    expect(WAIL_DAMAGE).toBeGreaterThan(SHELL);
    // It is the only ball with a flat cut: no other defence takes a fixed amount off every hit.
    const flat = BALLS.filter(
      (ball) =>
        ball.incomingDamageOf?.(
          createWorld(1, [ball, blue]).balls[0] as never,
          40,
          600,
          'contact',
        ) ===
        40 - SHELL,
    );
    expect(flat.map((ball) => ball.id)).toEqual(['tortoise']);
  });
});
