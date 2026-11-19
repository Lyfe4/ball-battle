// PROTOTYPE ONLY (proto/ball-looks): the states each redesigned ball cycles through in the gallery,
// one step a second or so, each with a caption. Never part of the game.
import type { Serializable } from '../sim/types.ts';
import { titanRadius } from '../sim/balls/titan.ts';
import { COOLDOWN_TICKS } from '../sim/balls/boomerang.ts';

export interface GalleryState {
  readonly caption: string;
  readonly abilityState?: Readonly<Record<string, Serializable>>;
  readonly radius?: number;
  /** Damage flash, 0 to 1, to show a hit landing. */
  readonly flash?: number;
  /** Which way it is moving, in radians (the Speedster faces it). */
  readonly angle?: number;
  /** True while its own projectile (a boomerang) is in the air. */
  readonly shotOut?: boolean;
  /** The world's tick, for designs that read it. */
  readonly tick: number;
}

interface Step {
  readonly caption: string;
  readonly state?: Readonly<Record<string, Serializable>>;
  readonly hit?: boolean;
  readonly angle?: number | undefined;
}

const STEP_TICKS = 66;

function stepper(steps: readonly Step[], tick: number): GalleryState {
  const index = Math.floor(tick / STEP_TICKS) % steps.length;
  const step = steps[index] ?? steps[0];
  const local = tick % STEP_TICKS;
  return {
    caption: step?.caption ?? '',
    tick,
    ...(step?.state === undefined ? {} : { abilityState: step.state }),
    ...(step?.angle === undefined ? {} : { angle: step.angle }),
    flash: step?.hit === true ? Math.max(0, 1 - local / 14) * 0.7 : 0,
  };
}

const berserker: readonly Step[] = [
  { caption: 'Calm: rage 0 of 3. Three closed seams.', state: { rage: 0 } },
  { caption: 'Takes a hit: rage 1. One crack opens.', state: { rage: 1 }, hit: true },
  { caption: 'Takes a hit: rage 2.', state: { rage: 2 }, hit: true },
  { caption: 'Takes a hit: rage 3, full. White-hot.', state: { rage: 3 }, hit: true },
  { caption: 'Full: its next bump lets it out (+9).', state: { rage: 3 } },
  {
    caption: 'Bumps: rage spent. The hit back in that bump opens one again.',
    state: { rage: 1 },
    hit: true,
  },
  { caption: 'Takes a hit: rage 2.', state: { rage: 2 }, hit: true },
  { caption: 'Bumps a ball that does no harm back: all close.', state: { rage: 0 } },
];

const speedsterAngles: readonly number[] = [0.4, -0.5, 2.6, -2.4, 0.9, 2.2, -1.2];
const speedster: readonly Step[] = [
  { caption: 'No stacks: 0 of 5, base speed.', state: { stacks: 0 }, angle: speedsterAngles[0] },
  ...[1, 2, 3, 4, 5].map((stacks) => ({
    caption: `Wall bounce: ${String(stacks)} of 5, ${String(stacks * 10)}% faster${stacks === 5 ? ' (full)' : ''}.`,
    state: { stacks },
    angle: speedsterAngles[stacks],
  })),
  { caption: 'Full: next bump deals +10.', state: { stacks: 5 }, angle: speedsterAngles[5] },
  {
    caption: 'Bumps a ball: stacks spent, back to 0.',
    state: { stacks: 0 },
    hit: true,
    angle: speedsterAngles[6],
  },
];

const thorns: readonly Step[] = [
  { caption: 'Spiked edge. Nothing stored, no timer.' },
  { caption: 'Takes a bump: the attacker is hurt back.', hit: true },
];

const battery: readonly Step[] = [
  { caption: 'Empty: 0 of 40 stored.', state: { stored: 0 } },
  { caption: 'A strike of 22 lands as 15: stores 7.', state: { stored: 7 }, hit: true },
  { caption: 'Another strike: 14 stored.', state: { stored: 14 }, hit: true },
  { caption: 'A blast of 40 lands as 27: stores 13, 27 stored.', state: { stored: 27 }, hit: true },
  { caption: 'Another big hit: full, 40 (the most).', state: { stored: 40 }, hit: true },
  { caption: 'Full: its next bump adds +40.', state: { stored: 40 } },
  { caption: 'Bumps: lets it all out, empty again.', state: { stored: 0 }, hit: true },
];

/** The Titan grows over its first 667 ticks; shown at twice speed, then held at its largest. */
function titan(tick: number): GalleryState {
  const growTicks = 667;
  const t = (tick * 2) % (growTicks + 240);
  const radius = titanRadius(Math.min(t, growTicks));
  const seconds = Math.min(t, growTicks) / 60;
  return {
    caption:
      t >= growTicks
        ? 'Fully grown: 1.8× as wide, bump 1.85× as hard. Five rings.'
        : `${seconds.toFixed(1)} s into a fight (shown at 2× speed): radius ${radius.toFixed(0)}.`,
    radius,
    tick,
  };
}

/** One throw every COOLDOWN_TICKS: out for about 45 ticks, then in hand. */
function boomerang(tick: number): GalleryState {
  const local = tick % COOLDOWN_TICKS;
  const thrownAt = tick - local;
  const out = local < 45;
  const caption = out
    ? 'Thrown: an empty hand until it comes back.'
    : 'Caught: in hand until its next throw.';
  return {
    caption,
    abilityState: { nextThrowTick: thrownAt + COOLDOWN_TICKS },
    shotOut: out,
    tick,
  };
}

export const TIMELINES: Readonly<Record<string, (tick: number) => GalleryState>> = {
  titan,
  berserker: (tick) => stepper(berserker, tick),
  speedster: (tick) => stepper(speedster, tick),
  thorns: (tick) => stepper(thorns, tick),
  boomerang,
  battery: (tick) => stepper(battery, tick),
};
