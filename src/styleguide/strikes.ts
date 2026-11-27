// The style guide's strikes (ADR 0043, 0091): a Storm strike and a Quake shockwave fading, and a
// Hunter's snare springing, with and without reduced motion. Dev only.
import { drawWorld, NO_EFFECTS } from '../render/draw.ts';
import { drawStrikes } from '../render/zones.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { createWorld } from '../sim/world.ts';
import { canvasFor } from './canvas.ts';
import { TICK } from './sections.ts';

/** A Storm strike and a Quake shockwave at three points of its fade, side by side. */
export function strikesFigure(): HTMLElement {
  const cssSize = 340;
  const { canvas, ctx } = canvasFor(cssSize);
  const world = createWorld(1, [
    getDefinition(BALL_LOOKUP, 'storm'),
    getDefinition(BALL_LOOKUP, 'quake'),
  ]);
  const [storm, quake] = world.balls;
  if (storm === undefined || quake === undefined) throw new Error('expected two balls');
  const balls = [
    { ...storm, position: { x: 250, y: 260 } },
    { ...quake, position: { x: 760, y: 760 } },
  ];
  const shown = { ...world, tick: TICK, balls };
  const view = { canvasPixels: canvas.width, cssPixels: cssSize };
  drawWorld(ctx, shown, BALL_LOOKUP, view, NO_EFFECTS);
  const strike = (zoneId: string, ownerId: string, x: number, y: number, strength: number) => ({
    zoneId,
    ownerId,
    position: { x, y },
    radius: 180,
    strength,
  });
  drawStrikes(
    ctx,
    shown,
    [
      strike('zone-0', storm.id, 250, 260, 0.8),
      strike('zone-1', quake.id, 760, 260, 0.9),
      strike('zone-2', quake.id, 250, 760, 0.5),
      strike('zone-3', quake.id, 760, 760, 0.2),
    ],
    BALL_LOOKUP,
    false,
  );
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = 'Storm strike; shockwave at 90%, 50% and 20% strength';
  figure.append(canvas, caption);
  return figure;
}

/** A Hunter's snare springing (ADR 0091): the trap snap at four points of its fade, then calm. */
export function snapsFigure(reducedMotion: boolean): HTMLElement {
  const cssSize = 340;
  const { canvas, ctx } = canvasFor(cssSize);
  const world = createWorld(1, [
    getDefinition(BALL_LOOKUP, 'hunter'),
    getDefinition(BALL_LOOKUP, 'frost'),
  ]);
  const [hunter, frost] = world.balls;
  if (hunter === undefined || frost === undefined) throw new Error('expected two balls');
  const balls = [
    { ...hunter, position: { x: 500, y: 500 } },
    { ...frost, position: { x: 900, y: 900 } },
  ];
  const shown = { ...world, tick: TICK, balls };
  drawWorld(
    ctx,
    shown,
    BALL_LOOKUP,
    { canvasPixels: canvas.width, cssPixels: cssSize },
    NO_EFFECTS,
  );
  const snap = (x: number, y: number, strength: number) => ({
    zoneId: `snap-${String(strength)}`,
    ownerId: hunter.id,
    position: { x, y },
    radius: 150,
    strength,
  });
  drawStrikes(
    ctx,
    shown,
    [snap(250, 250, 0.95), snap(750, 250, 0.75), snap(250, 750, 0.5), snap(750, 750, 0.2)],
    BALL_LOOKUP,
    reducedMotion,
  );
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = `Hunter's snare springing at 95%, 75%, 50% and 20% strength${reducedMotion ? ', reduced motion' : ''}`;
  figure.append(canvas, caption);
  return figure;
}
