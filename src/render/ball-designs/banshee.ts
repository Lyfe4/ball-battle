// The Banshee's look (ADR 0075): a pale wailing face whose mouth follows its wail. Closed while it
// waits, it opens as it draws breath and gapes on the wail, then closes as the ring dies away. It
// moves only as the sim's clock does. One set of proportions in fractions of r at every size.
import { FIRST_WAIL_TICK, nextWailTickOf, WAIL_EVERY_TICKS } from '../../sim/balls/banshee.ts';
import type { BallState } from '../../sim/types.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Where it is in its wail, read from its state on `tick`: each 0 to 1. */
export interface WailMoment {
  /** Drawing breath: 0 until theme.bansheeBreathTicks before the wail, rising to 1 at it. */
  readonly breath: number;
  /** The wail itself: 1 on the tick it wails, falling to 0 over theme.bansheeWailTicks. */
  readonly wail: number;
}

/** Its breath and wail on `tick`, from its next wail tick (no wail before its first). */
export function wailMoment(nextWailTick: number, tick: number): WailMoment {
  const until = nextWailTick - tick;
  const breath =
    until <= theme.bansheeBreathTicks ? 1 - Math.max(0, until) / theme.bansheeBreathTicks : 0;
  const since = tick - (nextWailTick - WAIL_EVERY_TICKS);
  const wailed = nextWailTick > FIRST_WAIL_TICK && since >= 0;
  const wail = wailed ? Math.max(0, 1 - since / theme.bansheeWailTicks) : 0;
  return { breath, wail };
}

/** A Banshee's moment, read from any ball (undefined for other balls). */
export function wailMomentOf(ball: BallState, tick: number): WailMoment | undefined {
  const next = nextWailTickOf(ball);
  return next === undefined ? undefined : wailMoment(next, tick);
}

/** The face, as fractions of r: two tall hollow eyes and a round mouth. */
const EYE = { x: 0.25, y: -0.2, rx: 0.1, ry: 0.17 } as const;
const MOUTH = { y: 0.3, rx: 0.13, rest: 0.06, breath: 0.17, wail: 0.3 } as const;

/**
 * A spectral face: two tall dark eyes and a mouth that is a slit while it waits, opens as it draws
 * breath and gapes on the wail, closing again as its ring dies away.
 */
export const bansheeDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, tick }) {
    const { breath, wail } = wailMomentOf(ball, tick) ?? { breath: 0, wail: 0 };
    p.fillStyle = accent;
    for (const side of [-1, 1]) {
      p.save();
      p.translate(side * EYE.x * r, EYE.y * r);
      p.scale(EYE.rx / EYE.ry, 1);
      p.beginPath();
      p.arc(0, 0, EYE.ry * r, 0, Math.PI * 2);
      p.fill();
      p.restore();
    }
    const open = Math.max(
      MOUTH.rest + (MOUTH.breath - MOUTH.rest) * breath,
      MOUTH.rest + (MOUTH.wail - MOUTH.rest) * wail,
    );
    const width = MOUTH.rx + 0.05 * Math.max(breath, wail);
    p.save();
    p.translate(0, MOUTH.y * r);
    p.scale(1, open / width);
    p.beginPath();
    p.arc(0, 0, width * r, 0, Math.PI * 2);
    p.fill();
    p.restore();
  },
};
