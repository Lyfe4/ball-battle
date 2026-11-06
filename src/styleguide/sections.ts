// The style guide's tiles: every ball in each ability state, then every status ring. One
// section per ball design; a new ball adds its section here.
import { COOLDOWN_TICKS as ARCHER_COOLDOWN } from '../sim/balls/archer.ts';
import { BALLS } from '../sim/balls/index.ts';
import { CHARGE_TICKS } from '../sim/balls/sniper.ts';
import { COOLDOWN_TICKS as STORM_COOLDOWN } from '../sim/balls/storm.ts';
import type { StatusKind } from '../sim/status.ts';
import type { AbilityState, BallState, Vec2 } from '../sim/types.ts';
import { BATCH_THREE_AND_FOUR } from './sections-late.ts';
import { TICK } from './tick.ts';

export { TICK };

export interface Tile {
  readonly label: string;
  readonly id: string;
  readonly abilityState?: AbilityState;
  /** Where the ball is heading (Speedster) or where its enemy is (Archer). */
  readonly toward?: Vec2;
  readonly repeat?: boolean;
  readonly defeated?: boolean;
  /** Health as a share of max (the Berserker's cracks); full by default. */
  readonly health?: number;
  readonly heal?: number;
  /** The heal's size as a share of max health (ADR 0028); 0.15 or more is a full-size pulse. */
  readonly healShare?: number;
  /** Rule cue strength (ADR 0028): 1 just shown, then fading. */
  readonly cue?: number;
  readonly flash?: number;
  /** Statuses (ADR 0009, 0012), drawn with their rings, as in a match. */
  readonly statuses?: readonly StatusKind[];
}

/** Ability state for a cooldown ball `charge` of the way to its next shot or strike. */
export const charged = (key: string, cooldown: number, charge: number): AbilityState => ({
  [key]: TICK + Math.round((1 - charge) * cooldown),
});

export const right: Vec2 = { x: 1, y: 0 };

/** A Sniper locked on along `aim`, `charge` of the way to its shot (the laser shows in the tile). */
const locked = (aim: Vec2, charge: number): AbilityState => ({
  nextChargeTick: 0,
  charge: { fireTick: TICK + Math.round((1 - charge) * CHARGE_TICKS), aim: { x: aim.x, y: aim.y } },
});
const upRight: Vec2 = { x: 0.8, y: -0.6 };
const downLeft: Vec2 = { x: -0.6, y: 0.8 };

export const SECTIONS: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Brawler: hits hard, no tricks',
    [
      { label: 'idle', id: 'brawler' },
      { label: 'hit flash', id: 'brawler', flash: 0.6 },
      { label: 'mirror B', id: 'brawler', repeat: true },
      { label: 'defeated', id: 'brawler', defeated: true },
    ],
  ],
  [
    'Speedster: one streak per stack, facing its travel',
    [
      ...[0, 1, 2, 3, 4, 5].map((stacks): Tile => ({
        label: `${stacks} stacks`,
        id: 'speedster',
        abilityState: { stacks },
        toward: upRight,
      })),
      {
        label: 'mirror B, 3',
        id: 'speedster',
        abilityState: { stacks: 3 },
        toward: right,
        repeat: true,
      },
    ],
  ],
  [
    'Vampire: collar and fangs; the collar edge flushes as the heal pulse shows',
    [
      { label: 'idle', id: 'vampire' },
      { label: 'healing', id: 'vampire', heal: 0.8, healShare: 0.15 },
      { label: 'heal fading', id: 'vampire', heal: 0.3, healShare: 0.15 },
      { label: 'mirror B', id: 'vampire', repeat: true },
    ],
  ],
  [
    'Archer: bow faces its target and draws back as the shot charges',
    [
      ...[0, 0.5, 1].map((charge): Tile => ({
        label: `charge ${charge * 100}%`,
        id: 'archer',
        abilityState: charged('nextShotTick', ARCHER_COOLDOWN, charge),
        toward: right,
      })),
      {
        label: 'aiming down-left, 70%',
        id: 'archer',
        abilityState: charged('nextShotTick', ARCHER_COOLDOWN, 0.7),
        toward: downLeft,
      },
      {
        label: 'mirror B, 50%',
        id: 'archer',
        abilityState: charged('nextShotTick', ARCHER_COOLDOWN, 0.5),
        toward: right,
        repeat: true,
      },
    ],
  ],
  [
    'Storm: the bolt brightens as the strike charges, then flickers',
    [
      ...[0, 0.5, 0.85, 1].map((charge): Tile => ({
        label: `charge ${charge * 100}%`,
        id: 'storm',
        abilityState: charged('nextStrikeTick', STORM_COOLDOWN, charge),
      })),
      {
        label: 'mirror B, 50%',
        id: 'storm',
        abilityState: charged('nextStrikeTick', STORM_COOLDOWN, 0.5),
        repeat: true,
      },
    ],
  ],
  [
    'Frost: a snowflake, finer at full size and bolder at small size',
    [
      { label: 'idle', id: 'frost' },
      { label: 'hit flash', id: 'frost', flash: 0.6 },
      { label: 'mirror B', id: 'frost', repeat: true },
      { label: 'defeated', id: 'frost', defeated: true },
    ],
  ],
  [
    'Thorns: a ring of spikes to the edge; fewer, fatter spikes at small size',
    [
      { label: 'idle', id: 'thorns' },
      { label: 'hit flash', id: 'thorns', flash: 0.6 },
      { label: 'mirror B', id: 'thorns', repeat: true },
      { label: 'defeated', id: 'thorns', defeated: true },
    ],
  ],
  [
    'Venom: a poison drop; the shine drops at small size',
    [
      { label: 'idle', id: 'venom' },
      { label: 'hit flash', id: 'venom', flash: 0.6 },
      { label: 'mirror B', id: 'venom', repeat: true },
      { label: 'defeated', id: 'venom', defeated: true },
    ],
  ],
  [
    'Berserker: cracks run in from the edge, more and heavier as its health drops; poisoned, they fade (rage numbed)',
    [
      ...[1, 0.75, 0.5, 0.25, 0.05].map((health): Tile => ({
        label: `${health * 100}% health`,
        id: 'berserker',
        health,
      })),
      { label: 'mirror B, 50%', id: 'berserker', health: 0.5, repeat: true },
      {
        label: 'poisoned, 25%: rage numbed',
        id: 'berserker',
        health: 0.25,
        statuses: ['poisoned'],
      },
    ],
  ],
  [
    'Sniper: a scope crosshair; while locked, its centre turns red and a laser runs to the wall',
    [
      { label: 'idle', id: 'sniper' },
      { label: 'just locked', id: 'sniper', abilityState: locked(right, 0) },
      { label: 'about to fire', id: 'sniper', abilityState: locked(right, 1) },
      { label: 'locked down-left', id: 'sniper', abilityState: locked(downLeft, 0.5) },
      { label: 'mirror B', id: 'sniper', repeat: true },
    ],
  ],
  [
    'Quake: rock strata broken by a fault line; its shockwaves are clean rings (below)',
    [
      { label: 'idle', id: 'quake' },
      { label: 'hit flash', id: 'quake', flash: 0.6 },
      { label: 'mirror B', id: 'quake', repeat: true },
      { label: 'defeated', id: 'quake', defeated: true },
    ],
  ],
  ...BATCH_THREE_AND_FOUR,
  [
    'Heals (ADR 0028): a green wash and a swelling ring, sized by the heal; any ball',
    [
      { label: 'big heal', id: 'vampire', heal: 0.75, healShare: 0.15 },
      { label: 'small heal', id: 'vampire', heal: 0.75, healShare: 0.03 },
      {
        label: 'shock-cut heal',
        id: 'vampire',
        heal: 0.75,
        healShare: 0.075,
        statuses: ['shocked'],
        cue: 0.75,
      },
      { label: 'another ball', id: 'brawler', heal: 0.75, healShare: 0.1 },
    ],
  ],
  [
    'Rule cue (ADR 0028): one spark for every interaction rule, the moment it acts',
    [
      { label: 'pop', id: 'archer', statuses: ['staggered'], cue: 0.9 },
      { label: 'settled', id: 'archer', statuses: ['staggered'], cue: 0.6 },
      { label: 'fading', id: 'archer', statuses: ['staggered'], cue: 0.2 },
      { label: 'numbed rage', id: 'berserker', health: 0.4, statuses: ['poisoned'], cue: 0.6 },
      { label: 'on yellow', id: 'speedster', cue: 0.6 },
    ],
  ],
  [
    'Shocked (ADR 0009): a dashed ring just outside the edge; it heals less',
    BALLS.map(({ id }): Tile => ({
      label: id,
      id,
      statuses: ['shocked'],
    })),
  ],
  [
    'Slowed (ADR 0012): a still ice ring with frost ticks; it cruises slower',
    [
      ...['brawler', 'speedster', 'vampire', 'archer', 'storm'].map((id): Tile => ({
        label: id,
        id,
        statuses: ['slowed'],
      })),
      { label: 'shocked + slowed', id: 'vampire', statuses: ['shocked', 'slowed'] },
    ],
  ],
  [
    'Poisoned (ADR 0012, 0014): a still ring of dots, like drops; it takes poison ticks',
    [
      ...['brawler', 'speedster', 'vampire', 'thorns', 'frost'].map((id): Tile => ({
        label: id,
        id,
        statuses: ['poisoned'],
      })),
      { label: 'all three', id: 'storm', statuses: ['shocked', 'slowed', 'poisoned'] },
    ],
  ],
  [
    'Staggered (ADR 0016): a broken ring of pale-stone arcs; it can’t aim',
    [
      ...['archer', 'storm', 'sniper', 'brawler'].map((id): Tile => ({
        label: id,
        id,
        statuses: ['staggered'],
      })),
      {
        label: 'all four',
        id: 'sniper',
        statuses: ['shocked', 'slowed', 'poisoned', 'staggered'],
      },
    ],
  ],
];

/**
 * A ball's ability state in the phone arena: mid-charge or mid-stack, so the designs show their
 * states rather than all sitting at rest.
 */
export function arenaAbilityState(ball: BallState): BallState['abilityState'] {
  switch (ball.definitionId) {
    case 'speedster':
      return { stacks: 3 };
    case 'archer':
      return charged('nextShotTick', ARCHER_COOLDOWN, 0.6);
    case 'storm':
      return charged('nextStrikeTick', STORM_COOLDOWN, 0.6);
    case 'sniper':
      return locked(downLeft, 0.6);
    case 'magnet':
      return { nextPullTick: TICK + 100, pullUntilTick: TICK + 10 };
    case 'ghost':
      return { phased: true, nextChangeTick: TICK + 10 };
    default:
      return ball.abilityState;
  }
}
