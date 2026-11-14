// Proto only: the Bloom and the Glitch built from tunable numbers, so a measuring run never edits a
// file. The hooks are the shipped ones with their constants as parameters.
import { STANDARD_BALL_RADIUS } from '../../src/sim/constants.ts';
import { defineBall } from '../../src/sim/define-ball.ts';
import { BALLS } from '../../src/sim/balls/index.ts';
import type { BallDefinition } from '../../src/sim/types.ts';

export interface BloomParams {
  readonly health: number;
  readonly speed: number;
  readonly hit: number;
  /** Ticks between heals once regrowing. */
  readonly every: number;
  /** Ticks untouched before it regrows. */
  readonly wait: number;
  readonly amount?: number;
}
export interface GlitchParams {
  readonly health: number;
  readonly speed: number;
  readonly hit: number;
  readonly ticks: number;
}
export interface Variant {
  readonly bloom?: BloomParams;
  readonly glitch?: GlitchParams;
  /** Plain stat overrides for any ball. */
  /** Proto switches (src/sim/glitch.ts). */
  readonly proto?: { readonly keepSizeHit?: boolean };
  readonly stats?: Readonly<
    Record<string, Partial<Pick<BallDefinition, 'maxHealth' | 'speed' | 'contactDamage'>>>
  >;
}

type BloomState = Readonly<{ nextHealTick: number; pausedUntil: number }>;

export function bloomOf(p: BloomParams): BallDefinition {
  const amount = p.amount ?? 1;
  return defineBall<BloomState>({
    id: 'bloom',
    name: 'Bloom',
    description: '',
    color: '#f472b6',
    radius: STANDARD_BALL_RADIUS,
    speed: p.speed,
    maxHealth: p.health,
    contactDamage: p.hit,
    initialAbilityState: { nextHealTick: p.every, pausedUntil: 0 },
    hooks: {
      onTick: ({ world, self }) => {
        const { nextHealTick, pausedUntil } = self.abilityState;
        if (world.tick < nextHealTick || world.tick < pausedUntil) return [];
        return [
          { kind: 'heal', targetId: self.id, amount },
          { kind: 'setAbilityState', state: { nextHealTick: world.tick + p.every, pausedUntil } },
        ];
      },
      onDamageTaken: ({ world, self }) => [
        {
          kind: 'setAbilityState',
          state: {
            nextHealTick: Math.max(self.abilityState.nextHealTick, world.tick + p.wait),
            pausedUntil: world.tick + p.wait,
          },
        },
      ],
    },
  });
}

export function glitchOf(p: GlitchParams): BallDefinition {
  return defineBall({
    id: 'glitch',
    name: 'Glitch',
    description: '',
    color: '#94a3b8',
    radius: STANDARD_BALL_RADIUS,
    speed: p.speed,
    maxHealth: p.health,
    contactDamage: p.hit,
    initialAbilityState: {},
    hooks: {
      onHitBall: ({ other }) => [
        { kind: 'applyStatus', targetId: other.id, status: 'glitched', durationTicks: p.ticks },
      ],
    },
  });
}

/** The roster with the variant's balls in place of the shipped ones. */
export function rosterOf(v: Variant): readonly BallDefinition[] {
  return BALLS.map((ball) => {
    let def = ball;
    if (ball.id === 'bloom' && v.bloom) def = bloomOf(v.bloom);
    if (ball.id === 'glitch' && v.glitch) def = glitchOf(v.glitch);
    const over = v.stats?.[ball.id];
    return over ? { ...def, ...over } : def;
  });
}
