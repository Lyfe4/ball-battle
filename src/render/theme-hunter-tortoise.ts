// The renderer's tokens for the balls of ADR 0091, spread into its theme (theme.ts) and read from
// there.
//
// The Hunter: a hunter under a wolf pelt (the pelt, the wolf's paler muzzle, amber eyes, fangs and
// dark inner ears, its lines hunterLine r wide), its own face in shadow but for two glinting eyes.
// Its snares lie on the floor as a steel jaw trap, open, faint until they arm; a ball a snare holds
// has the trap clamped round it, closing over trapSnapTicks. A snare that springs snaps shut where it
// lay, shaking, with dust and splinters in the pelt's browns: never a bolt like the Storm's.
//
// The Tortoise: a shell of plates (a lighter centre scute, seams in its accent) with a head and four
// feet in its skin colour that peek out while it moves and duck in when the shell cuts a hit (with
// the shared glance ring, glance-ring.ts) or a snare or tentacle holds it.
export const HUNTER_TORTOISE = {
  hunterPelt: '#a8907e',
  hunterMuzzle: '#cbb6a3',
  hunterFang: '#f4eee4',
  hunterShadow: '#24160f',
  hunterEyeGlint: '#fff0b8',
  hunterEyeSpark: '#ffffff',
  hunterWolfEye: '#f5b041',
  hunterInnerEar: '#5c4a3f',
  hunterLine: 0.06,
  hunterSteel: '#e7e5e4',
  hunterJawWidth: 0.11,
  hunterToothEdge: 0.03,
  trapSnapTicks: 4,
  /** A held ball's trap sits this far outside its edge (world units), closing in from trapSnapGap. */
  trapClampGap: 4,
  trapSnapGap: 22,
  trapWidth: 6,
  /*
   * A sprung snare (snares.ts, drawTrapSnap), over a strike's STRIKE_MS: the trap at this share of
   * the strike's radius (its floor size) snaps shut over trapSnapShut of it, shakes trapShake of its
   * reach a side for the first half, and throws trapDustCount bits of dust and splinters out in the
   * pelt's leather browns to trapDustReach of its reach. With reduced motion: no shake, no travel.
   */
  trapSnapReach: 0.62,
  trapSnapShut: 0.3,
  trapShake: 0.08,
  trapDustCount: 8,
  trapDustReach: 2.1,
  trapDustSize: 0.14,
  /** The puff of dust round the trap as it shuts: its alpha at the start, in the pelt's brown. */
  trapPuffAlpha: 0.3,
  tortoiseScute: '#b8c26e',
  tortoiseSkin: '#d8c48e',
  tortoiseSeam: 0.06,
} as const;
