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
  repeatRingWidth: 4,
  /** Overlay colour for the damage flash; its opacity follows the flash strength. */
  flash: '#ffffff',
  flashMaxAlpha: 0.85,
  /** Ring that grows and fades around a ball when it heals. */
  healRing: '#4ade80',
  healRingWidth: 6,
  healRingGrowth: 28,
  /** Ability pips (e.g. Speedster stacks), drawn across the middle of the ball. */
  pipRadius: 7,
  pipSpacing: 15,
  pipFilled: '#111827',
  pipEmpty: 'rgba(17, 24, 39, 0.25)',
  /** Charging arc around a ball with a cooldown (e.g. the Archer), filling as it recharges. */
  chargeArcGap: 7,
  chargeArcWidth: 5,
  chargeArcEmpty: 'rgba(255, 255, 255, 0.12)',
  chargeArcFilled: 'rgba(255, 255, 255, 0.75)',
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
  boltGlow: '#93c5fd',
  boltGlowBlur: 18,
  boltWidth: 7,
  boltSegments: 9,
  boltJitter: 45,

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
