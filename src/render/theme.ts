/**
 * Visual tokens for the canvas renderer. Sizes are in world units, so they scale with the arena.
 * Page-level colours live as CSS custom properties in src/styles/tokens.css.
 */
export const theme = {
  /**
   * The court (ADR 0032): a deep indigo floor inside a chunky rounded rim. Flat fills only, so a
   * frame costs two rounded rectangles. The floor carries no markings (ADR 0033): every circle on
   * it is a game signal (a warning, a shockwave, a heal), so a decorative one would compete with
   * them. Every ball's colour keeps at least 3:1 against the floor (arena-contrast.test.ts): the
   * pale ones (Frost, Ghost, Storm) by their lightness, the dark ones (Necromancer, Quake) by the
   * floor's darkness.
   */
  arenaFill: '#1d1640',
  arenaBorder: '#3a2f6e',
  arenaBorderWidth: 22,
  /**
   * The court's corner radius, in world units. No larger than a ball's radius, so a ball wedged
   * in a corner is still drawn wholly on the court and never over the rim.
   */
  arenaCornerRadius: 50,
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
  /**
   * Any heal, on any ball (ADR 0028): a green wash over the ball and a ring that swells out from
   * its edge. Both scale with the heal as a share of max health, reaching full size at
   * `healFullShare`, so small heals stay subtle and a heal a status cut reads as a smaller one.
   */
  healRing: '#4ade80',
  healRingWidth: 7,
  healRingGrowth: 34,
  healWashAlpha: 0.3,
  healFullShare: 0.15,
  /** The smallest a heal pulse is drawn, as a share of full size, so even a 1-point heal shows. */
  healMinSize: 0.3,
  /** How far outside a ball's edge its first status ring sits. */
  statusRingGap: 7,
  /**
   * A slowed ball (ADR 0012): a thin solid ring in pale ice, with short frost ticks pointing
   * outwards. Still, like ice.
   */
  slowRing: '#e0f2fe',
  slowRingWidth: 3,
  slowRingAlpha: 0.75,
  slowTicks: 12,
  slowTickLength: 7,
  /**
   * A poisoned ball (ADR 0012, 0014): a still ring of round dots in pale lime, like drops. Outside
   * the slow ring when a ball has both.
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
    magnet: '#4c0519',
    ghost: '#2e1065',
    necromancer: '#0f1a07',
    chrono: '#3b2410',
    titan: '#052e16',
    inferno: '#7c2d12',
    boomerang: '#134e4a',
    bomber: '#2e0627',
    spartan: '#1c0a02',
    bloom: '#831843',
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
  shockwaveWidth: 6,
  shockwaveStart: 0.35,
  /**
   * The Magnet (ADR 0026): a horseshoe as thick as this share of r (heavier at phone size), with
   * pale tips that glow while it pulls. The pull itself is a dashed line to its enemy.
   */
  magnetShoe: 0.24,
  magnetShoeSimple: 0.32,
  magnetTip: '#e5e7eb',
  magnetPullTip: '#fde68a',
  magnetPullLine: '#fda4af',
  magnetPullWidth: 4,
  magnetPullAlpha: 0.6,
  magnetPullDash: [14, 12] as readonly number[],
  /**
   * A phased ball (ADR 0026) or a faded Ghost (ADR 0045) is drawn see-through, with a broken
   * outline, so a viewer can see why hits miss it. Its status rings and health bar stay solid.
   */
  phasedAlpha: 0.38,
  phasedOutline: '#ede9fe',
  phasedOutlineWidth: 4,
  phasedDash: [10, 8] as readonly number[],
  /**
   * The Chrono (ADR 0034): clock hands as thick as this share of r at small size, and the face
   * faded to this while its rewind recharges (ADR 0045). The rewind itself: a dotted trail from where it was
   * knocked out to where it lands, and a fading ghost of it at the spot it left.
   */
  chronoHandSimple: 0.14,
  chronoRechargingAlpha: 0.45,
  rewindTrail: '#fde68a',
  rewindTrailWidth: 6,
  rewindTrailDash: [4, 12] as readonly number[],
  rewindMs: 900,
  rewindGhostAlpha: 0.5,
  /** The Titan's crest, as a share of r (heavier at small size). */
  titanCrest: 0.12,
  /** The Titan's visor slit, as a fraction of r: it widens as the Titan grows and hits harder. */
  titanVisor: [0.2, 0.36] as readonly [number, number],
  titanCrestSimple: 0.18,
  /**
   * The Inferno (ADR 0034): its flame's pale heart and how far the tip flickers (a share of r). Its
   * burning patches: a warm disc under the balls, brighter just after a burn, fading as it burns
   * out.
   */
  infernoHeart: '#fef08a',
  infernoFlicker: 0.04,
  burnFill: '#ff7a1a',
  burnAlpha: 0.34,
  burnPulseAlpha: 0.6,
  burnEdge: '#ffd166',
  burnEdgeWidth: 4,
  burnPulseTicks: 6,
  /**
   * Batch 5 (ADR 0043). The Boomerang's mark and its boomerang in flight: a bent bar as thick as
   * this share of r (heavier at small size), spinning a full turn every few ticks while it flies.
   */
  boomerangArm: 0.2,
  boomerangArmSimple: 0.28,
  boomerangSpinTicks: 10,
  boomerangFlightScale: 3.4,
  /** The Bomber's bomb: its fuse spark, which flickers with the sim tick. */
  bomberSpark: '#fde68a',
  /**
   * Its bombs on the floor: a dark body ringed in the owner's colour, a fuse arc around it that
   * burns down to the blast, and a faint dashed circle for the blast's reach. Dim until armed.
   */
  bombBody: '#1c1917',
  bombRingWidth: 5,
  bombFuseWidth: 6,
  bombFuse: '#fde68a',
  bombReachAlpha: 0.5,
  bombReachDash: [10, 12] as readonly number[],
  bombAreaAlpha: 0.07,
  bombUnarmedAlpha: 0.45,
  /** A bomb going off: a warm flash over its reach and a ring sweeping out to its edge. */
  blastFlash: '#fed7aa',
  blastFlashMaxAlpha: 0.7,
  blastRing: '#fb923c',
  blastRingWidth: 15,
  /**
   * A hit glancing off a defence (the Spartan's shield, the Ghost's fade, ADR 0045, 0047): a bright
   * gold ring just outside the ball, already in pieces, flying out and fading.
   */
  glanceRing: '#fde047',
  glanceRingWidth: 7,
  glanceRingGap: 5,
  glanceMs: 450,
  glanceShards: 6,
  glanceShardFlight: 30,
  /** The Bloom's flower: petals that open wide while it rests and regrows, and a pale centre. */
  bloomCentre: '#fef9c3',
  /**
   * The Spartan (on its crimson body): a bronze helmet, planted shield and spear, and a cream crest
   * that stands out on the crimson and on the floor where it passes the ball's edge.
   */
  spartanBronze: '#e0a83e',
  spartanCrest: '#fef3c7',
  /** The Necromancer's eyes, glowing out of its hood. */
  necromancerEyes: '#bef264',
  /**
   * Minions (ADR 0026): a bone-white skull ringed in the owner's colour, with dark eye sockets and
   * nose. Fractions of the minion's radius. Below `minionSimpleBelowPx` of radius on screen (a
   * phone) the teeth go, and the eyes and ring grow so the face still reads.
   */
  minionBone: '#e7e5e4',
  minionSocket: '#1c1917',
  minionRing: 0.14,
  minionRingSimple: 0.22,
  minionEye: { x: 0.36, y: -0.1, size: 0.22 },
  minionEyeSimple: { x: 0.36, y: -0.14, size: 0.27 },
  minionNose: { half: 0.12, top: 0.14, bottom: 0.32 },
  minionJaw: 0.56,
  minionJawHalf: 0.42,
  minionTeethLine: 0.1,
  minionTeethLineSimple: 0.14,
  minionSimpleBelowPx: 12,
  /** Projectiles are drawn as a short streak behind a round head, in the owner's colour. */
  projectileTrail: 30,
  projectileTrailWidth: 4,
  /** The Spartan's spear in flight: its shaft behind the head, in world units, and its head's length as a multiple of the shot's radius. */
  spearLength: 124,
  spearShaftWidth: 14,
  spearHeadLength: 3.6,
  /** The head's half-width, as a multiple of the shot's radius. */
  spearHeadWidth: 1.5,
  /** A dark edge round the spear, so the bronze shaft and head hold on the dark floor. */
  spearOutline: '#1c0a02',
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
  healthGhost: 'rgba(255, 248, 238, 0.7)',
  ghostHoldMs: 300,
  ghostDrainMs: 450,
  /** Impact particles: a few dots, more for a harder hit, never more than particleCap alive. */
  particleColor: '#ffe07a',
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
  winnerRing: '#ffd23f',
  winnerRingWidth: 5,
  winnerRingGrowth: 36,
  winnerPulses: 2,
  winnerPulseMs: 900,
  /** The result text appears this long after a knockout, once the sequence has played. */
  resultDelayMs: 950,
  /**
   * The Winner sticker (ADR 0032) lands this long before the result, after the slow-mo and the
   * shards: in a series round on a phone the round screen takes over at the result, so the
   * sticker's moment is the time between.
   */
  winnerStickerLeadMs: 750,
  /**
   * How long the sticker's moment lasts from when it lands (ADR 0033): its pop (480 ms), the
   * confetti (650 ms) and a beat to read the name. The series round screen, which dims the arena
   * on a desktop and replaces it on a phone, waits for it.
   */
  winnerCelebrationMs: 1400,
  /** Match intro (real ms, under 1.5 s): each ball pops in, then a short hold before the first tick. */
  introMs: 1100,
  introPopMs: 420,
  introStaggerMs: 160,
  introOvershoot: 0.12,

  /**
   * Health bars are chunky pills (ADR 0032): a dark track with the fill inset by `healthBarInset`,
   * so the bar has a dark edge on any ball and any floor.
   */
  healthBarHeight: 18,
  healthBarInset: 4,
  healthBarGap: 10,
  healthBarMinWidth: 76,
  healthTrack: '#0d0a1a',

  /**
   * The source chip (ADR 0036): a disc in the attacker's colour beside a health pill when unseen
   * damage lands (poison, a burning patch, reflected spikes), outlined like the pill.
   */
  sourceChipRadius: 13,
  sourceChipGap: 8,
  sourceChipOutlineWidth: 5,
  sourceChipPop: 0.3,
  healthHigh: '#5ee385',
  healthMid: '#ffd23f',
  healthLow: '#ff8a4c',

  /** Caps the backing-store resolution; beyond 2x the extra pixels cost more than they show. */
  maxPixelRatio: 2,
} as const;
