// PROTOTYPE ONLY (proto/ball-looks): what the gallery shows for each ball: its old look, its new
// look or looks (the Titan has three faces to choose from), a line on each and a Free play opponent.
import { BALL_DESIGNS } from '../render/ball-designs/index.ts';
import { TITAN_LOOKS } from '../render/ball-designs/titan.ts';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { oldBatteryDesign } from './old/battery.ts';
import { oldBerserkerDesign } from './old/berserker.ts';
import { oldBoomerangDesign } from './old/boomerang.ts';
import { oldSpeedsterDesign } from './old/speedster.ts';
import { oldThornsDesign } from './old/thorns.ts';
import { oldTitanDesign } from './old/titan.ts';

export interface Look {
  readonly label: string;
  readonly design: BallDesign;
  readonly why: string;
  /** Added to its Free play link, to fight with this look (`titan=boulder`). */
  readonly query?: string;
}

export interface Entry {
  readonly id: string;
  readonly old: BallDesign;
  readonly looks: readonly Look[];
  readonly against: string;
  /** Where it stands after the first review. */
  readonly status: string;
}

function current(id: string, why: string): readonly Look[] {
  const design = BALL_DESIGNS.get(id);
  if (design === undefined) throw new Error(`no design for ${id}`);
  return [{ label: 'new', design, why }];
}

export const ENTRIES: readonly Entry[] = [
  {
    id: 'titan',
    old: oldTitanDesign,
    against: 'brawler',
    status: 'Pick one of three stone colossus variations (1, 2 or 3). Each grows below.',
    looks: [
      {
        label: '1 · Lintel',
        design: TITAN_LOOKS.lintel,
        query: 'titan=lintel',
        why: '1, Lintel: a flat stone lintel of a brow that gets heavier as it grows, two narrow slit eyes deep in its shadow, and a mouth cut across a broad, shadowed jaw.',
      },
      {
        label: '2 · Glower',
        design: TITAN_LOOKS.glower,
        query: 'titan=glower',
        why: '2, Glower: the brow dips into a deep V that deepens as it grows, small square eyes glare from under it, and two stubby stone tusks rise from a dark underbite of a jaw.',
      },
      {
        label: '3 · Weathered',
        design: TITAN_LOOKS.weathered,
        query: 'titan=weathered',
        why: '3, Weathered: two rounded brow bones, heavier as it grows, round eyes deep beneath them, and a mouth cut straight across a broad jaw with a cleft chin.',
      },
    ],
  },
  {
    id: 'battery',
    old: oldBatteryDesign,
    against: 'storm',
    status: 'Changed after review: one smooth fill.',
    looks: current(
      'battery',
      'An empty battery outline from the start; yellow charge fills it smoothly in proportion to what it has stored (a third of each big hit, up to 40), and drains on its bump. No cells.',
    ),
  },
  {
    id: 'berserker',
    old: oldBerserkerDesign,
    against: 'venom',
    status: 'Approved.',
    looks: current(
      'berserker',
      'Three seams, one per hit of rage it can store: each hit it takes cracks one open with a hot glow, full they meet white-hot in the middle, and the bump that lets it out closes them.',
    ),
  },
  {
    id: 'speedster',
    old: oldSpeedsterDesign,
    against: 'brawler',
    status: 'Approved.',
    looks: current(
      'speedster',
      'A five-bar speed gauge wrapped round the back of its dart: every wall bounce lights a bar, a bump empties them, and the empty bars stay faint so it always reads as “3 of 5”, at every size.',
    ),
  },
  {
    id: 'thorns',
    old: oldThornsDesign,
    against: 'brawler',
    status: 'Approved.',
    looks: current(
      'thorns',
      'Its spikes now break out of its edge, so its silhouette is the warning (the only spiky ball); it stores nothing, so the look never changes.',
    ),
  },
  {
    id: 'boomerang',
    old: oldBoomerangDesign,
    against: 'spartan',
    status: 'Approved.',
    looks: current(
      'boomerang',
      'It holds its boomerang only while it has it: thrown, the ball shows a faint empty shape until the catch, so you never see two boomerangs at once.',
    ),
  },
];
