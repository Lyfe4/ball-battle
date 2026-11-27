// The renderer's tokens for the balls of ADR 0091, spread into its theme (theme.ts) and read from
// there.
//
// The Hunter: a steel jaw trap on its leather, set (jaws open) as its next snare comes and snapped
// shut the moment it lays one. Its snares lie on the floor as the same trap, open, faint until they
// arm; a ball a snare holds has the trap clamped round it, closing over trapSnapTicks.
//
// The Tortoise: a shell of plates (a lighter centre scute, seams in its accent) with a head and four
// feet in its skin colour that peek out while it moves and duck in when the shell cuts a hit (with
// the shared glance ring, glance-ring.ts) or a snare or tentacle holds it.
export const HUNTER_TORTOISE = {
  hunterSteel: '#e7e5e4',
  hunterJawWidth: 0.11,
  hunterToothEdge: 0.03,
  trapSnapTicks: 4,
  /** A held ball's trap sits this far outside its edge (world units), closing in from trapSnapGap. */
  trapClampGap: 4,
  trapSnapGap: 22,
  trapWidth: 6,
  tortoiseScute: '#b8c26e',
  tortoiseSkin: '#d8c48e',
  tortoiseSeam: 0.06,
} as const;
