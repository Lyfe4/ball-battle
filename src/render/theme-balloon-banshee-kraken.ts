// The renderer's tokens for the three balls of ADR 0075, spread into its theme (theme.ts) and read
// from there.
//
// The Balloon: its gloss, its shadow on the floor (the only ball with one, fractions of r: offset,
// half-width, flattening) and the pop of a shot. The Banshee: the glow as she draws breath (from
// this many ticks before her wail), the wail's ring (its sweep takes the first share of its time),
// a fainter echo inside it, her face and her hair's strands. The Kraken: its suckers and its stubs
// while the tentacles are out, its glowing eyes and dark mantle, the ripples (their drift period
// and rings), and the tentacles: their width, taper to the tip, swell as they squeeze and suckers.
// They break the floor at krakenBase r, out of a dark hole (krakenHoleFill of their half-width) in
// a ring (krakenHoleShare), rise over the first share of the hold, then coil at krakenCoilRadius
// r, tightening by krakenCoilTighten, each sweeping its share of the turn and an overlap. Last,
// the line back to the Kraken.
export const BALLOON_BANSHEE_KRAKEN = {
  balloonGlossAlpha: 0.7,
  shadow: '#000000',
  shadowAlpha: 0.38,
  shadowOffsetX: 0.3,
  shadowOffsetY: 1.32,
  shadowWidth: 0.78,
  shadowSquash: 0.3,
  /**
   * How it drifts (drift.ts): its knot swings back by up to balloonSway radians at
   * balloonSwaySpeed, its shadow trails its drift by shadowLagSeconds of it (at most shadowLagMost
   * r) and stretches by up to shadowStretch; the drift follows its velocity over driftFollowMs.
   */
  shadowLagSeconds: 0.03,
  shadowLagMost: 0.32,
  shadowStretch: 0.12,
  driftFollowMs: 140,
  balloonSway: 0.34,
  balloonSwaySpeed: 760,
  popMs: 260,
  popFlight: 26,
  popGap: 8,
  popLength: 22,
  popWidth: 7,
  bansheeBreathTicks: 36,
  bansheeWailTicks: 30,
  bansheeBreathAlpha: 0.3,
  bansheeBreathGrowth: 0.55,
  bansheeWail: '#f5e1f7',
  bansheeFace: '#f7f1f7',
  bansheeStrandAlpha: 0.45,
  bansheeRingWidth: 12,
  bansheeSweepShare: 0.35,
  bansheeEchoAlpha: 0.45,
  bansheeEchoShare: 0.72,
  krakenSucker: '#cffafe',
  krakenOutAlpha: 0.35,
  krakenEye: '#d9f99d',
  krakenMantleAlpha: 0.5,
  krakenRipple: '#67e8f9',
  krakenRippleWidth: 6,
  krakenRippleAlpha: 0.85,
  krakenRippleTicks: 24,
  krakenRippleRings: 3,
  krakenTentacle: '#0891b2',
  krakenTentacleEdge: '#082f49',
  krakenTentacleWidth: 30,
  krakenTentacleEdgeWidth: 4,
  krakenTaper: 0.72,
  krakenSwell: 0.15,
  krakenSuckerShare: 0.3,
  krakenBase: 1.7,
  krakenHoleShare: 1.6,
  krakenHoleFill: 1.2,
  krakenCoilLead: 0.5,
  krakenCoilOverlap: 0.55,
  krakenCoilRadius: 0.86,
  krakenCoilTighten: 0.16,
  krakenRiseShare: 0.15,
  krakenAnchorAlpha: 0.45,
  krakenAnchorWidth: 6,
} as const;
