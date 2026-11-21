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
    'Mirage: a rose ball with a soft wavy rim and calm eyes that glance at its copy; two bands of haze fill as its copy comes back, full while it shows. The copy (half opacity, a wobbling outline, no face, no bar) and its pop show in the phone arena',
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
    'Jouster: tournament gold with a pale pennant stripe and a white lance wedge pointing where it heads, carried raised and turned aside, lowered over the second before a charge until it points dead ahead past its edge; a gold streak behind a charge (see the phone arena)',
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
