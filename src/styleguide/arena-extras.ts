// Extras for the style guide's phone arena (ADR 0034): a burning patch behind the Inferno, just
// after a burn, and the Chrono's rewind trail, to check both read at phone size.
import { PATCH_RADIUS } from '../sim/balls/inferno.ts';
import type { BallState, ZoneState } from '../sim/types.ts';
import type { RewindTrail } from '../render/rewind.ts';
import { TICK } from './tick.ts';

export function batchFourExtras(balls: readonly BallState[]): {
  readonly zones: readonly ZoneState[];
  readonly rewinds: readonly RewindTrail[];
} {
  const burner = balls.find((ball) => ball.definitionId === 'inferno');
  const zones =
    burner === undefined
      ? []
      : [
          {
            id: 'zone-0',
            ownerId: burner.id,
            position: { x: burner.position.x - 100, y: burner.position.y },
            radius: PATCH_RADIUS,
            damage: 0,
            spawnTick: TICK - 30,
            strikeTick: TICK - 2,
            endTick: TICK + 80,
            pulseEveryTicks: 15,
          },
        ];
  const rewinder = balls.find((ball) => ball.definitionId === 'chrono');
  const rewinds =
    rewinder === undefined
      ? []
      : [
          {
            ballId: rewinder.id,
            from: { x: rewinder.position.x + 90, y: rewinder.position.y + 60 },
            to: rewinder.position,
            strength: 0.8,
          },
        ];
  return { zones, rewinds };
}
