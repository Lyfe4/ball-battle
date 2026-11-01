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
  /** Caps the backing-store resolution; beyond 2x the extra pixels cost more than they show. */
  maxPixelRatio: 2,
} as const;
