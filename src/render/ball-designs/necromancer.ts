import { FIRST_SUMMON_TICK, SUMMON_TICKS, nextSummonTickOf } from '../../sim/balls/necromancer.ts';
import { theme } from '../theme.ts';
import { chargeFraction } from './state.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** The hood, as fractions of r: its rounded crown and point, and how far down and out it falls. */
const HOOD = { crown: 0.46, crownY: -0.04, point: -0.72, flare: 0.64, bottom: 0.66 } as const;
/** Eyes glowing out of the hood, as fractions of r. One size at every size on screen. */
const EYES = { x: 0.19, y: 0.06, radius: 0.11 } as const;
/** The skull forming in the hood, grown to full: centre, size, sockets and jaw. */
const SKULL = {
  from: 0.45,
  y: 0.1,
  radius: 0.36,
  socket: 0.15,
  jawY: 0.25,
  jawHalf: 0.16,
  teeth: 0.07,
} as const;

/**
 * How far its next skull has come, 0 to 1, or undefined while one is out. Its summon comes every
 * SUMMON_TICKS whether or not one is out, but a summon while one is out raises nothing (MAX_MINIONS
 * is 1): the next skull comes on the first summon after the last is gone, so the countdown only
 * means something while none is out.
 */
export function summonProgress(view: DesignView): number | undefined {
  if (view.minionsOut > 0) return undefined;
  const next = nextSummonTickOf(view.ball) ?? FIRST_SUMMON_TICK;
  return chargeFraction(next, view.tick, SUMMON_TICKS);
}

function hood(p: Painter, r: number): void {
  p.beginPath();
  // Falling from the crown and flaring out at the shoulders, like a cloak.
  p.moveTo(-HOOD.flare * r, HOOD.bottom * r);
  p.lineTo(-HOOD.crown * r, HOOD.crownY * r);
  p.arc(0, HOOD.crownY * r, HOOD.crown * r, Math.PI, Math.PI * 1.5 - 0.45);
  p.lineTo(0, HOOD.point * r);
  p.arc(0, HOOD.crownY * r, HOOD.crown * r, Math.PI * 1.5 + 0.45, 0);
  p.lineTo(HOOD.flare * r, HOOD.bottom * r);
  p.closePath();
  p.fill();
}

function eyes(p: Painter, r: number, lit: boolean): void {
  const alpha = p.globalAlpha;
  p.globalAlpha = alpha * (lit ? 1 : theme.necromancerDimEyesAlpha);
  p.fillStyle = theme.necromancerEyes;
  p.beginPath();
  for (const side of [-1, 1]) {
    p.moveTo(side * EYES.x * r + EYES.radius * r, EYES.y * r);
    p.arc(side * EYES.x * r, EYES.y * r, EYES.radius * r, 0, Math.PI * 2);
  }
  p.fill();
  p.globalAlpha = alpha;
}

/**
 * A pointed hood in the dark accent with two glowing eyes inside: the one who raises the skeleton
 * minions (ADR 0026). A bone-white skull forms in the hood as its next summon nears, fading in from
 * half size to a full face round its glowing eyes, the very skull it then sends out. While its skull
 * is out the hood is empty and the eyes dim; when that skull is gone a new one starts forming,
 * part-grown if the next summon is already near.
 */
export const necromancerDesign: BallDesign = {
  facing: 'none',
  draw(p, view) {
    const { radius: r, accent } = view;
    const progress = summonProgress(view);
    p.fillStyle = accent;
    hood(p, r);
    const forming = progress ?? 0;
    if (forming > 0) {
      // It fades in from a skull half its size, so it never starts as a speck between the eyes.
      const s = SKULL.from + (1 - SKULL.from) * forming;
      const alpha = p.globalAlpha;
      p.globalAlpha = alpha * Math.min(1, forming * 2);
      p.fillStyle = theme.minionBone;
      p.beginPath();
      p.arc(0, SKULL.y * r, SKULL.radius * s * r, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = theme.minionSocket;
      p.beginPath();
      for (const side of [-1, 1]) {
        p.moveTo(side * EYES.x * r + SKULL.socket * s * r, EYES.y * r);
        p.arc(side * EYES.x * r, EYES.y * r, SKULL.socket * s * r, 0, Math.PI * 2);
      }
      p.fill();
      p.strokeStyle = theme.minionSocket;
      p.lineWidth = SKULL.teeth * s * r;
      p.lineCap = 'round';
      p.beginPath();
      p.moveTo(-SKULL.jawHalf * s * r, (SKULL.y + SKULL.jawY * s) * r);
      p.lineTo(SKULL.jawHalf * s * r, (SKULL.y + SKULL.jawY * s) * r);
      p.stroke();
      p.globalAlpha = alpha;
    }
    eyes(p, r, progress !== undefined);
  },
};
