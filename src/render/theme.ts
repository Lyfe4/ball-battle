/**
 * Visual tokens for the canvas renderer. Sizes are in world units, so they scale with the arena.
 * Page-level colours live as CSS custom properties in src/style.css.
 */
export const theme = {
  arenaFill: '#161a23',
  arenaBorder: '#2d3446',
  arenaBorderWidth: 8,
  ballOutline: 'rgba(0, 0, 0, 0.35)',
  ballOutlineWidth: 4,
  /** Used if a ball's definition is missing, so a bad id is visible rather than invisible. */
  unknownBall: '#ff00ff',
  /** Defeated balls stay on the field, faded. */
  defeatedAlpha: 0.25,
  /**
   * A ball whose kind already appeared earlier in the match (ball B in a mirror match) is drawn
   * lighter, with a ring, so the two can be told apart. The HUD uses the same shade.
   */
  repeatLighten: 0.45,
  repeatRing: '#ffffff',
  repeatRingWidth: 3,
  /** Overlay colour for the damage flash; its opacity follows the flash strength. */
  flash: '#ffffff',
  flashMaxAlpha: 0.85,
  /** Ring that grows and fades around a ball when it heals. */
  healRing: '#4ade80',
  healRingWidth: 6,
  healRingGrowth: 28,
  /**
   * A heal a status reduced (ADR 0009): a dim ring that shrinks in, the opposite of the heal ring
   * that still shows for what was restored, so it reads as "healed, but less".
   */
  healReducedRing: '#94a3b8',
  healReducedWidth: 4,
  healReducedShrink: 14,
  healReducedMs: 320,
  /**
   * A shocked ball (ADR 0009): a thin dashed ring just outside its edge, in a pale storm blue. The
   * dashes step along every few sim ticks for a faint crackle, and hold still with reduced motion.
   */
  shockRing: '#bfdbfe',
  shockRingWidth: 3,
  shockRingAlpha: 0.7,
  shockRingGap: 7,
  shockDash: [9, 7] as readonly number[],
  shockStepTicks: 4,
  /**
   * A slowed ball (ADR 0012): a thin solid ring in pale ice, with short frost ticks pointing
   * outwards. Still, like ice. Further out than the shock ring when a ball has both.
   */
  slowRing: '#e0f2fe',
  slowRingWidth: 3,
  slowRingAlpha: 0.75,
  slowTicks: 12,
  slowTickLength: 7,
  /**
   * A poisoned ball (ADR 0012, 0014): a still ring of round dots in pale lime, like drops. Outside
   * the shock and slow rings when a ball has more than one.
   */
  poisonRing: '#d9f99d',
  poisonRingWidth: 5,
  poisonRingAlpha: 0.8,
  poisonDotGap: 11,
  /** Each further status ring sits this much further out than the one inside it. */
  statusRingSpacing: 9,
  /**
   * Ball designs (src/render/ball-designs): flat shapes in the ball's own colour plus one accent
   * per ball, keyed by definition id. White is only for small highlights.
   */
  ballAccents: {
    brawler: '#7f1d1d',
    speedster: '#1c1917',
    vampire: '#1e1029',
    archer: '#164e63',
    storm: '#1e3a8a',
    frost: '#0c4a6e',
    thorns: '#14532d',
    venom: '#1a2e05',
    berserker: '#431407',
    sniper: '#1e1b4b',
    quake: '#292524',
  } as Readonly<Record<string, string>>,
  /** Accent for a ball without its own entry. */
  defaultAccent: '#111827',
  /** Line weight of design markings, as a fraction of the ball's radius, so it holds at any size. */
  markLine: 0.09,
  /**
   * Below this radius on screen, in CSS pixels, designs draw their simplified version: fine detail
   * dropped, main shape thicker. About a phone-sized arena; desktop balls stay above it.
   */
  simpleDesignBelowPx: 24,
  /** Small highlights: the Vampire's fangs, the Storm's bolt. */
  highlight: '#ffffff',
  /** The Vampire's collar edge flushes this colour when it heals. */
  vampireHeal: '#e11d48',
  /** The Storm's bolt brightens from this alpha as it charges, then flickers near the strike. */
  stormBoltMinAlpha: 0.25,
  stormFlickerFrom: 0.85,
  stormFlickerTicks: 3,
  stormFlickerDim: 0.45,
  /**
   * The Sniper's locked aim: a thin laser line from its edge to the wall, brightening as the shot
   * nears. The same red lights the centre of its scope.
   */
  sniperLaser: '#f87171',
  laserWidth: 3,
  laserMinAlpha: 0.25,
  laserMaxAlpha: 0.85,
  /**
   * A shockwave (the Quake's zones): a clean ring that sweeps from part-way out to the zone's
   * edge as it fades, instead of a flash and a bolt.
   */
  shockwaveRing: '#e7e5e4',
  shockwaveWidth: 9,
  shockwaveStart: 0.35,
  /** Projectiles are drawn as a short streak behind a round head, in the owner's colour. */
  projectileTrail: 30,
  projectileTrailWidth: 4,
  /** Burst of short rays where a projectile hits. */
  sparkColor: '#f59e0b',
  sparkRays: 8,
  sparkInner: 10,
  sparkOuter: 46,
  sparkWidth: 5,
  /**
   * Hazard zones (e.g. the Storm's), drawn under the balls in the owner's colour: a faint area,
   * an inner disk that grows to the edge as the strike nears, and a pulsing outline.
   */
  zoneAreaAlpha: 0.08,
  zoneFillAlpha: 0.3,
  zoneOutlineWidth: 4,
  zonePulsePeriodTicks: 12,
  zonePulseMinAlpha: 0.35,
  zonePulseMaxAlpha: 0.95,
  /** A zone going off: a flash over its area and a lightning bolt from the top of the arena. */
  strikeFlash: '#ffffff',
  strikeFlashMaxAlpha: 0.6,
  boltColor: '#f0f9ff',
  boltWidth: 7,
  boltSegments: 9,
  boltJitter: 45,

  /**
   * Battle feel (ADR 0007). Durations are effect-time milliseconds unless they say real; sizes are
   * world units. Damage thresholds are per ball per tick (a Speedster's hit plus its stack bonus
   * counts as one impact). Measured over 100 seeds per matchup: under a third of non-knockout hits
   * are heavy in any matchup (most in Storm mirrors, where every lightning hit is), none in Archer
   * or Vampire mirrors.
   */
  heavyHitDamage: 26,
  /** Damage that counts as a full-strength impact for particles and squash. */
  fullImpactDamage: 28,
  hitStopMinMs: 45,
  hitStopMaxMs: 80,
  knockoutHitStopMs: 110,
  /**
   * Screen shake on knockouts only, small and capped. Shaking on big hits too fired on up to 44%
   * of hits in a Storm mirror, which read as busy.
   */
  shakeKnockoutOffset: 7,
  shakeMs: 240,
  shakeHz: 26,
  /** Squash along the impact normal, recovering over squashMs. Wall bounces squash less. */
  squashImpact: 0.14,
  squashWall: 0.06,
  squashMs: 150,
  /** The part of a health bar just lost: holds, then drains down to the new health. */
  healthGhost: 'rgba(255, 255, 255, 0.7)',
  ghostHoldMs: 300,
  ghostDrainMs: 450,
  /** Impact particles: a few dots, more for a harder hit, never more than particleCap alive. */
  particleColor: '#fde68a',
  particleMin: 2,
  particleMax: 6,
  particleSpeed: 380,
  particleRadius: 5,
  particleMs: 360,
  particleCap: 40,
  /** Knockout: brief slow-mo (real ms), the loser breaks into shards, the winner pulses. */
  knockoutSlowMoScale: 0.35,
  knockoutSlowMoRealMs: 500,
  shardCount: 7,
  shardSpeed: 240,
  shardMs: 750,
  winnerRing: '#ffffff',
  winnerRingWidth: 5,
  winnerRingGrowth: 36,
  winnerPulses: 2,
  winnerPulseMs: 900,
  /** The result text appears this long after a knockout, once the sequence has played. */
  resultDelayMs: 950,
  /** Match intro (real ms, under 1.5 s): each ball pops in, then a short hold before the first tick. */
  introMs: 1100,
  introPopMs: 420,
  introStaggerMs: 160,
  introOvershoot: 0.12,

  healthBarHeight: 12,
  healthBarGap: 10,
  healthBarMinWidth: 70,
  healthTrack: 'rgba(0, 0, 0, 0.6)',
  healthHigh: '#22c55e',
  healthMid: '#eab308',
  healthLow: '#f97316',

  /** Caps the backing-store resolution; beyond 2x the extra pixels cost more than they show. */
  maxPixelRatio: 2,
} as const;
