// The rule cue (ADR 0028, 0041): one small spark, the same for every interaction rule, beside the
// ball whose ability caused the rule (Storm's shock, Quake's shockwave, Venom's poison), not the
// ball it acted on: the spark says "this ball's ability just countered the other ball". Drawn as a
// path, never a font glyph, so it looks the same on every device. Pure geometry and the causer here;
// drawn in draw-cues.ts, and as SVG in the symbol legend.
import type { RuleAppliedEvent, RuleId } from '../sim/rules.ts';
import type { StatusKind } from '../sim/status.ts';
import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** The status whose effect each rule is: its source is the ball that caused the rule. */
export const RULE_STATUS: Readonly<Record<RuleId, StatusKind>> = {
  healCut: 'shocked',
  aimHeld: 'staggered',
  rageNumbed: 'poisoned',
};

/**
 * The ball whose ability caused `event`: the source of the status the rule is about. That status is
 * still on the ball on the rule's tick, since a status expires at the start of its expiry tick.
 * Without it (no world to read), the other ball of the one-on-one, or failing that the ball itself.
 */
export function ruleCauserId(event: RuleAppliedEvent, balls: readonly BallState[]): string {
  const affected = balls.find((ball) => ball.id === event.ballId);
  const status = affected?.statuses.find((entry) => entry.kind === RULE_STATUS[event.rule]);
  if (status !== undefined) return status.sourceId;
  return balls.find((ball) => ball.id !== event.ballId)?.id ?? event.ballId;
}

/**
 * The spark's outline: a four-point star of unit size around (0, 0), points up, right, down and
 * left, with its inner corners at `theme.ruleCueWaist`. Shared by the canvas and the legend's SVG.
 */
export function ruleCuePoints(): readonly (readonly [number, number])[] {
  const w = theme.ruleCueWaist;
  return [
    [0, -1],
    [w, -w],
    [1, 0],
    [w, w],
    [0, 1],
    [-w, w],
    [-1, 0],
    [-w, -w],
  ];
}

/** Scale of the spark's pop at `strength` (1 just shown, 0 gone): up past 1, then settles. */
export function cueScale(strength: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const p = 1 - strength;
  if (p < 0.15) return (p / 0.15) * theme.ruleCuePop;
  if (p < 0.3) return theme.ruleCuePop - ((p - 0.15) / 0.15) * (theme.ruleCuePop - 1);
  return 1;
}

/** Opacity at `strength`: full, then fading over the last 40%. */
export function cueAlpha(strength: number): number {
  return Math.min(1, strength / 0.4);
}
