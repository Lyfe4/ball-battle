// The renderer's tokens for the balls of ADR 0077, spread into its theme (theme.ts) and read from
// there.
//
// The Mirage: its wavy rim (waves round the edge and how far they reach, fractions of r), the haze
// bands across it that fill as its copy comes back, and its copy on the court: drawn at copyAlpha,
// its outline wobbling by copyWobble r with waves turning every copyWobbleTicks, shimmering in over
// copyShimmerTicks. A popped copy bursts into rings of haze (world units) over copyPopMs.
//
// The Jouster: its pennant stripe and lance (fractions of r), lowered over lanceLowerTicks before a
// charge, and the streak behind a charge. A head-on lance hit throws splinters and a big ×3 over
// lanceHitMs and holds the fight for lanceHitStopMs; a glancing one only sparks over glanceSparkMs.
//
// The Vampire's Thirst: its cape flares and a short red streak trails it while it is thirsty,
// settling over thirstSettleTicks at the end.
export const MIRAGE_JOUSTER = {
  mirageRimWaves: 14,
  mirageRimReach: 0.022,
  mirageHaze: '#fff1f2',
  mirageHazeEmptyAlpha: 0.25,
  copyAlpha: 0.5,
  copyEdge: '#fff1f2',
  copyEdgeWidth: 0.1,
  copyWobble: 0.045,
  copyWobbleWaves: 11,
  copyWobbleSamples: 4,
  copyWobbleTicks: 40,
  copyShimmerTicks: 18,
  copyPopMs: 420,
  copyPopRings: 3,
  copyPopReach: 70,
  copyPopWidth: 7,
  lanceLowerTicks: 60,
  lance: '#ffffff',
  lanceGuard: '#422006',
  jousterPennant: '#fef3c7',
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
