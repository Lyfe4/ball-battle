// PROTOTYPE ONLY (proto/ball-looks-2): what the gallery shows for each ball: its old look, its new
// look, a line on each and a Free play opponent.
import { BALL_DESIGNS } from '../render/ball-designs/index.ts';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { oldBomberDesign } from './old/bomber.ts';
import { oldNecromancerDesign } from './old/necromancer.ts';
import { oldVampireDesign } from './old/vampire.ts';

export interface Look {
  readonly label: string;
  readonly design: BallDesign;
  readonly why: string;
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
    id: 'bomber',
    old: oldBomberDesign,
    against: 'speedster',
    status: 'Round 3: the classic bomb, its stick fuse burning down to the next drop.',
    looks: current(
      'bomber',
      'The bomb and stick fuse as before, but the fuse burns down: whole just after a drop, shorter as the spark creeps down to the bomb, and whole again after it drops. Floor bombs unchanged.',
    ),
  },
  {
    id: 'necromancer',
    old: oldNecromancerDesign,
    against: 'archer',
    status: 'Approved (A, Skull).',
    looks: current(
      'necromancer',
      'The next skull forms in its hood, bone-white round the glowing eyes, growing to full as the summon nears; while its skull is out the hood is empty and the eyes dim.',
    ),
  },
  {
    id: 'vampire',
    old: oldVampireDesign,
    against: 'archer',
    status: 'Approved.',
    looks: current(
      'vampire',
      'Its fangs show its thirst: short at full health (a bump heals it nothing), longer as it loses health, reaching over the collar with a drop of blood on each tip once a full bump’s heal would all go back in.',
    ),
  },
];
