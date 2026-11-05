import type { MinionState } from '../sim/minions/types.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { ownerColor } from './ball-colors.ts';
import { theme } from './theme.ts';

/**
 * One minion as a little skeleton ball (ADR 0026): a bone-white skull, always upright so it reads
 * as a face, ringed in its owner's colour so it is clearly the Necromancer's: two big eye
 * sockets, a nose and a row of teeth. At phone size the ring, sockets and teeth are bolder. Drawn
 * in world units around the minion's centre.
 */
export function drawMinion(
  ctx: CanvasRenderingContext2D,
  minion: Pick<MinionState, 'position' | 'radius'>,
  ownerTint: string,
  simple: boolean,
): void {
  const { x, y } = minion.position;
  const r = minion.radius;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.minionBone;
  ctx.fill();
  ctx.lineWidth = r * (simple ? theme.minionRingSimple : theme.minionRing);
  ctx.strokeStyle = ownerTint;
  ctx.stroke();

  const eye = simple ? theme.minionEyeSimple : theme.minionEye;
  ctx.fillStyle = theme.minionSocket;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * eye.x * r, y + eye.y * r, eye.size * r, 0, Math.PI * 2);
    ctx.fill();
  }
  // The nose: a small upside-down triangle between and below the eyes.
  const nose = theme.minionNose;
  ctx.beginPath();
  ctx.moveTo(x - nose.half * r, y + nose.top * r);
  ctx.lineTo(x + nose.half * r, y + nose.top * r);
  ctx.lineTo(x, y + nose.bottom * r);
  ctx.closePath();
  ctx.fill();
  {
    // Teeth: a jaw line with short gaps, thicker at phone size. They make the face a skull.
    ctx.strokeStyle = theme.minionSocket;
    ctx.lineWidth = r * (simple ? theme.minionTeethLineSimple : theme.minionTeethLine);
    ctx.beginPath();
    ctx.moveTo(x - theme.minionJawHalf * r, y + theme.minionJaw * r);
    ctx.lineTo(x + theme.minionJawHalf * r, y + theme.minionJaw * r);
    for (const tooth of [-0.5, 0, 0.5]) {
      const tx = x + tooth * theme.minionJawHalf * r;
      ctx.moveTo(tx, y + (theme.minionJaw - 0.1) * r);
      ctx.lineTo(tx, y + (theme.minionJaw + 0.1) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Every minion in play, over the balls' level so a minion crossing a ball still shows. */
export function drawMinions(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
  cssPixelsPerUnit: number,
): void {
  for (const minion of world.minions) {
    const tint = ownerColor(world.balls, definitions, minion.ownerId);
    drawMinion(ctx, minion, tint, minion.radius * cssPixelsPerUnit < theme.minionSimpleBelowPx);
  }
}
