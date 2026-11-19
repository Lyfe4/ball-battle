// PROTOTYPE ONLY (proto/ball-looks-2): what the gallery shows for each ball: its old look, its new
// look or looks (the Necromancer has two to choose from), a line on each and a Free play opponent.
import { BALL_DESIGNS } from '../render/ball-designs/index.ts';
import { NECROMANCER_LOOKS } from '../render/ball-designs/necromancer.ts';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { oldBomberDesign } from './old/bomber.ts';
import { oldNecromancerDesign } from './old/necromancer.ts';
import { oldVampireDesign } from './old/vampire.ts';

export interface Look {
  readonly label: string;
  readonly design: BallDesign;
  readonly why: string;
  /** Added to its Free play link, to fight with this look (`necro=ring`). */
  readonly query?: string;
}

export interface Entry {
  readonly id: string;
  readonly old: BallDesign;
  readonly looks: readonly Look[];
  readonly against: string;
  readonly status: string;
}

function current(id: string, why: string): readonly Look[] {
  const design = BALL_DESIGNS.get(id);
  if (design === undefined) throw new Error(`no design for ${id}`);
  return [{ label: 'new', design, why }];
}

export const ENTRIES: readonly Entry[] = [
  {
    id: 'necromancer',
    old: oldNecromancerDesign,
    against: 'archer',
    status: 'Two looks to pick from (A or B).',
    looks: [
      {
        label: 'A · Skull',
        design: NECROMANCER_LOOKS.skull,
        query: 'necro=skull',
        why: 'A, Skull: the next skull forms in its hood, bone-white round the glowing eyes, growing to full as the summon nears; while its skull is out the hood is empty and the eyes dim.',
      },
      {
        label: 'B · Ring',
        design: NECROMANCER_LOOKS.ring,
        query: 'necro=ring',
        why: 'B, Ring: the hood as before, with a green ring inside the rim that fills clockwise to the next summon; while its skull is out the ring stays empty and the eyes dim.',
      },
    ],
  },
  {
    id: 'bomber',
    old: oldBomberDesign,
    against: 'speedster',
    status: 'One design.',
    looks: current(
      'bomber',
      'Its fuse is a yellow ring round the bomb that burns down clockwise to the next drop, the spark running back to the cap; the bomb it drops carries the same ring on the floor, burning to its blast.',
    ),
  },
  {
    id: 'vampire',
    old: oldVampireDesign,
    against: 'archer',
    status: 'One design.',
    looks: current(
      'vampire',
      'Its fangs show its thirst: short at full health (a bump heals it nothing), longer as it loses health, reaching over the collar with a drop of blood on each tip once a full bump’s heal would all go back in.',
    ),
  },
];
