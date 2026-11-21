// The style guide's tiles for the Mirage and the Jouster, and the thirsty Vampire (ADR 0077), in
// each state their look shows. sections.ts lists them with the rest; the Mirage's copy, the
// charge's streak and the thirsty Vampire's streak show in the phone arena.
import { CHARGE_EVERY_TICKS, CHARGE_TICKS } from '../sim/balls/jouster.ts';
import { COPY_BACK_TICKS, COPY_OFFSET } from '../sim/balls/mirage.ts';
import { THIRST_TICKS } from '../sim/balls/vampire.ts';
import type { AbilityState, BallState } from '../sim/types.ts';
import type { Tile } from './sections.ts';
import { TICK } from './tick.ts';

/** A Mirage whose copy is out (to one side), or gone and `share` of the way back. */
const copyOut: AbilityState = { copyOn: true, copyDx: COPY_OFFSET, copyDy: 0, backAt: TICK - 40 };
const coming = (share: number): AbilityState => ({
  copyOn: false,
  copyDx: COPY_OFFSET,
  copyDy: 0,
  backAt: TICK + Math.round((1 - share) * COPY_BACK_TICKS),
});

/** A Jouster this many ticks before its next charge, or charging. */
const beforeCharge = (inTicks: number): AbilityState => ({
  nextCharge: TICK + inTicks,
  chargeEnds: 0,
  charging: false,
});
const charging: AbilityState = {
  nextCharge: TICK + CHARGE_EVERY_TICKS - 10,
  chargeEnds: TICK + CHARGE_TICKS - 10,
  charging: true,
};
const thirsty: AbilityState = { thirstyUntil: TICK + THIRST_TICKS - 10 };

export const BATCH_EIGHT: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Mirage: a mirage on hot sand, no face: a glassy ball with dunes on a horizon, heat waves wavering over them and a see-through lower half holding the dunes’ upside-down reflection, whole while its copy shows, gone when it pops and fading back as it returns. The copy (the same shimmering ball at half opacity with a wobbling outline, no bar) and its pop show in the phone arena',
    [
      { label: 'copy out', id: 'mirage', abilityState: copyOut },
      { label: 'just popped', id: 'mirage', abilityState: coming(0.05) },
      { label: 'half back', id: 'mirage', abilityState: coming(0.5) },
      { label: 'hit flash', id: 'mirage', flash: 0.6 },
      { label: 'mirror B', id: 'mirage', repeat: true },
      { label: 'defeated', id: 'mirage', defeated: true },
    ],
  ],
  [
    'Jouster: a tournament knight: a shield quartered in gold and blue, a closed steel great helm with an eye slit and a breathing cross, a red feather plume, and a spiral-striped lance with a cone guard, upright at its right while raised, swung down over the second before a charge until it points dead ahead past its edge; a gold streak behind a charge (see the phone arena)',
    [
      { label: 'raised', id: 'jouster', abilityState: beforeCharge(120) },
      { label: 'lowering', id: 'jouster', abilityState: beforeCharge(30) },
      { label: 'charging', id: 'jouster', abilityState: charging },
      { label: 'hit flash', id: 'jouster', flash: 0.6 },
      { label: 'mirror B', id: 'jouster', repeat: true },
      { label: 'defeated', id: 'jouster', defeated: true },
    ],
  ],
  [
    'Vampire, thirsty: hit from afar, its cape flares (the lapels rise high, lined red) and a short red streak trails it for a second (see the phone arena)',
    [
      { label: 'calm', id: 'vampire' },
      { label: 'thirsty', id: 'vampire', abilityState: thirsty },
    ],
  ],
];

/** The three in the phone arena: the Mirage with its copy out, the Jouster charging, the Vampire thirsty. */
export function batchEightState(ball: BallState): BallState {
  if (ball.definitionId === 'mirage') return { ...ball, abilityState: copyOut };
  if (ball.definitionId === 'jouster') return { ...ball, abilityState: charging };
  if (ball.definitionId === 'vampire') return { ...ball, abilityState: thirsty };
  return ball;
}
