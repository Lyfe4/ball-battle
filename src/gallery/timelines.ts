// PROTOTYPE ONLY (proto/ball-looks-2): the states each redesigned ball cycles through in the
// gallery, as the sim plays them, each with a caption. Never part of the game.
import type { Serializable } from '../sim/types.ts';
import { DROP_TICKS } from '../sim/balls/bomber.ts';
import { SUMMON_TICKS } from '../sim/balls/necromancer.ts';
import { lifestealFor, vampire } from '../sim/balls/vampire.ts';

export interface GalleryState {
  readonly caption: string;
  readonly abilityState?: Readonly<Record<string, Serializable>>;
  /** Damage flash, 0 to 1, to show a hit landing. */
  readonly flash?: number;
  /** Heal effect, 1 just healed down to 0. */
  readonly heal?: number;
  readonly health?: number;
  /** True while its own minion (the Necromancer's skull) is in play. */
  readonly minionOut?: boolean;
  /** The world's tick, for designs that read it. */
  readonly tick: number;
}

export interface Timeline {
  /** Ticks in one cycle; the gallery's slider runs over them. */
  readonly length: number;
  readonly at: (tick: number) => GalleryState;
  /** Ticks that show each state settled, for the strips view and screenshots. */
  readonly samples: readonly number[];
}

const seconds = (ticks: number): string => (ticks / 60).toFixed(1);

/** One drop every DROP_TICKS: the fuse ring burns down from whole to the drop. */
const bomber: Timeline = {
  length: DROP_TICKS,
  samples: [1, 55, 110, 165, 205, 219],
  at(tick) {
    const t = Math.floor(tick) % DROP_TICKS;
    const next = DROP_TICKS;
    const left = next - t;
    const caption =
      t < 12
        ? `Drops a bomb (its own fuse full on the floor); its fuse ring is whole again: next in ${seconds(left)} s.`
        : `Next bomb in ${seconds(left)} s: the spark burns back to the cap.`;
    return { caption, abilityState: { nextDropTick: next }, tick: t };
  },
};

/**
 * The Necromancer's skull out and back, as the sim plays it: a summon every SUMMON_TICKS, raising
 * nothing while its skull is out. Summons at 55 and 220; the skull pops on an enemy at 190.
 */
const NECRO_LENGTH = 300;
const necromancer: Timeline = {
  length: NECRO_LENGTH,
  samples: [10, 30, 54, 100, 192, 205, 219, 240],
  at(tick) {
    const t = Math.floor(tick) % NECRO_LENGTH;
    const next = (Math.floor(t / SUMMON_TICKS) + 1) * SUMMON_TICKS;
    const out = (t >= SUMMON_TICKS && t < 190) || t >= 220;
    let caption: string;
    if (t < SUMMON_TICKS)
      caption = `No skull out: the next forms in the hood, out in ${seconds(next - t)} s.`;
    else if (t < SUMMON_TICKS + 14)
      caption = 'Summons: the skull goes out, the hood empties and its eyes dim.';
    else if (t < 190)
      caption = `Skull out: every ${seconds(SUMMON_TICKS)} s summon raises nothing while it is (next try in ${seconds(next - t)} s).`;
    else if (t < 220)
      caption = `Its skull bit an enemy: a new one forms, already part-grown, out in ${seconds(next - t)} s.`;
    else caption = 'Summons again: skull out.';
    return {
      caption,
      abilityState: { nextSummonTick: next },
      minionOut: out,
      tick: t,
    };
  },
};

/** The Vampire losing health and drinking it back: each step a second or so. */
const FULL_HEAL = lifestealFor(vampire.contactDamage);
const MAX = vampire.maxHealth;
const STEP = 70;
const VAMPIRE_STEPS: readonly {
  health: number;
  caption: string;
  hit?: boolean;
  healed?: boolean;
}[] = [
  { health: MAX, caption: `Full health (${String(MAX)}): sated. A bump would heal it nothing.` },
  {
    health: 32,
    hit: true,
    caption: 'Hit to 32: missing 7, a third of a bump’s heal. Fangs lengthen.',
  },
  { health: 25, hit: true, caption: 'Hit to 25: missing 14, two thirds of a bump’s heal.' },
  {
    health: 14,
    hit: true,
    caption: `Hit to 14: missing ${String(MAX - 14)}, so a full bump’s ${String(FULL_HEAL)} would all go back in. Fully bared, dripping.`,
  },
  {
    health: 14 + FULL_HEAL,
    healed: true,
    caption: `Bumps: heals ${String(FULL_HEAL)} (90% of 23), to 35. Fangs draw back.`,
  },
  { health: 20, hit: true, caption: 'Hit to 20: missing 19, nearly fully bared.' },
  {
    health: MAX,
    healed: true,
    caption: 'Bumps: heals 19 of a possible 21 (never past full). Sated.',
  },
];
const vampireTimeline: Timeline = {
  length: VAMPIRE_STEPS.length * STEP,
  samples: VAMPIRE_STEPS.map((_, index) => index * STEP + 50),
  at(tick) {
    const t = Math.floor(tick) % (VAMPIRE_STEPS.length * STEP);
    const index = Math.floor(t / STEP);
    const step = VAMPIRE_STEPS[index] ?? VAMPIRE_STEPS[0];
    const local = t % STEP;
    const fade = Math.max(0, 1 - local / 30);
    return {
      caption: step?.caption ?? '',
      health: step?.health ?? MAX,
      flash: step?.hit === true ? fade * 0.7 : 0,
      heal: step?.healed === true ? fade : 0,
      tick: t,
    };
  },
};

export const TIMELINES: Readonly<Record<string, Timeline>> = {
  necromancer,
  bomber,
  vampire: vampireTimeline,
};
