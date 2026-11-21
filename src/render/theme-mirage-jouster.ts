// The renderer's tokens for the balls of ADR 0077, spread into its theme (theme.ts) and read from
// there.
//
// The Mirage: its warm sand, its cool pool and the pool's white ripples, the dunes' reflection in
// it, its heat shimmers (each rising off the dunes over mirageHeatTicks), its gloss, and its copy on
// the court, the same design: drawn at copyAlpha,
// its outline wobbling by copyWobble r with waves turning every copyWobbleTicks, shimmering in over
// copyShimmerTicks. A popped copy bursts into rings of haze (world units) over copyPopMs.
//
// The Jouster: a knight. Its lance (white, red spiral stripes, a steel cone guard) is lowered over
// lanceLowerTicks before a charge; its great helm is steel, its plume red and its shield quartered
// in its gold and a heraldic blue; and the streak behind a charge. A head-on lance hit throws splinters and a big ×3 over
// lanceHitMs and holds the fight for lanceHitStopMs; a glancing one only sparks over glanceSparkMs.
//
// The Vampire's Thirst: its cape flares and a short red streak trails it while it is thirsty,
// settling over thirstSettleTicks at the end.
export const MIRAGE_JOUSTER = {
  mirageHaze: '#ffffff',
  mirageSand: '#f8cf8f',
  miragePool: '#c7ecfa',
  mirageReflection: 0.45,
  mirageRippleWidth: 0.07,
  mirageHeatTicks: 90,
  mirageHeatWidth: 0.06,
  mirageHeatAlpha: 0.75,
  mirageGlossAlpha: 0.6,
  mirageGlossWidth: 0.08,
  copyAlpha: 0.62,
  copyEdge: '#fff1f2',
  copyEdgeWidth: 0.1,
  copyWobble: 0.045,
  copyWobbleWaves: 11,
  copyWobbleSamples: 3,
  copyWobbleTicks: 40,
  copyShimmerTicks: 18,
  copyPopMs: 420,
  copyPopRings: 3,
  copyPopReach: 70,
  copyPopWidth: 7,
  lanceLowerTicks: 60,
  lance: '#ffffff',
  lanceStripe: '#dc2626',
  jousterSteel: '#cbd5e1',
  jousterPlume: '#dc2626',
  jousterHeraldry: '#1d4ed8',
  chargeStreak: '#fde68a',
  chargeStreakAlpha: 0.55,
  /** Streaks behind a charge or a thirsty Vampire: lines, their spread and length (fractions of r). */
  streakLines: 3,
  streakSpread: 0.45,
  streakLength: 1.5,
  streakWidth: 0.13,
  lanceHitMs: 520,
  lanceHitStopMs: 90,
  splinters: 7,
  splinter: '#fef3c7',
  splinterReach: 95,
  splinterLength: 24,
  splinterWidth: 7,
  lanceTimesText: '×3',
  lanceTimesSize: 92,
  lanceTimesRise: 46,
  lanceTimesFill: '#ffffff',
  lanceTimesEdge: '#422006',
  glanceSparkMs: 200,
  glanceSparks: 4,
  glanceSpark: '#fde047',
  glanceSparkReach: 30,
  glanceSparkLength: 12,
  thirstStreak: '#ef4444',
  thirstStreakAlpha: 0.7,
  thirstSettleTicks: 12,
  thirstFlare: 0.34,
  thirstLining: '#dc2626',
} as const;
