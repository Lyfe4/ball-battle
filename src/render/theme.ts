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
