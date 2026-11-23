// Where an arena tip's tag (the "i" and its label) sits beside its ring, in world units over the
// court (0..court on each axis), ADR 0036 addendum of 2026-11-23. Pure maths, tested without a DOM.
// - Four places, one by each of the ring's diagonal corners, so the tag never covers the ring.
// - Each is scored: any part outside the court costs most, then covering a ball or a health bar,
//   then a mild preference (above right first, the way a label reads).
// - Hysteresis: the tag keeps its place until another scores clearly better (SWITCH_MARGIN), so a
//   target by a wall or a passing ball doesn't flip it back and forth.
// - Smooth: the tag rides exactly on its target (as smooth as the ball itself, at any speed) and
//   only its offset from the target eases on presentation time, so a change of place glides. With
//   reduced motion it moves at once instead (`easeMs` 0).
// - Always inside: the final box is clamped into the court.
import type { Rect } from './health-bar.ts';

export type TagSide = 'above-right' | 'above-left' | 'below-right' | 'below-left';

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface TagInput {
  /** The ring: its centre and radius. */
  readonly ring: Circle;
  /** The tag's size. */
  readonly w: number;
  readonly h: number;
  /** The court's inner size. */
  readonly court: number;
  /** Balls the tag keeps clear of where it can (every ball but the one the ring is on). */
  readonly balls: readonly Circle[];
  /** Health bars it keeps clear of where it can (every ball's, the ring's own included). */
  readonly bars: readonly Rect[];
}

const SIDES: readonly TagSide[] = ['above-right', 'above-left', 'below-right', 'below-left'];
/** A mild order of preference, smaller than any real reason to move. */
const PREFERENCE: Readonly<Record<TagSide, number>> = {
  'above-right': 0,
  'above-left': 0.05,
  'below-right': 0.1,
  'below-left': 0.15,
};
/** The ring's diagonal corner, as a share of its radius (cos 45°, rounded up a little). */
const CORNER = 0.72;
/** A part of the tag outside the court, per whole tag: far worse than anything else. */
const OUTSIDE_COST = 10;
/** Covering a ball, per radius of overlap; covering a bar, per whole tag of overlap. */
const COVER_COST = 3;
/** Clear space kept round a ball or a bar, in world units. */
const COVER_PAD = 6;
/** How much better another place must score before the tag moves. */
export const SWITCH_MARGIN = 0.5;
/** How quickly the tag's offset reaches a new place, in ms of presentation time (time constant). */
export const EASE_MS = 140;

/** The tag's top-left corner at `side`, before clamping. */
export function cornerOf(side: TagSide, input: TagInput): Point {
  const d = input.ring.r * CORNER;
  return {
    x: side.endsWith('right') ? input.ring.x + d : input.ring.x - d - input.w,
    y: side.startsWith('above') ? input.ring.y - d - input.h : input.ring.y + d,
  };
}

/** `corner` moved the least distance that puts the whole tag inside the court. */
export function clampInto(corner: Point, input: Pick<TagInput, 'w' | 'h' | 'court'>): Point {
  const clamp = (value: number, size: number) =>
    Math.min(Math.max(value, 0), Math.max(input.court - size, 0));
  return { x: clamp(corner.x, input.w), y: clamp(corner.y, input.h) };
}

/** How far a ball reaches into the tag at `corner`, per radius (0 when clear). */
function ballCover(ball: Circle, corner: Point, input: TagInput): number {
  const nearX = Math.min(Math.max(ball.x, corner.x), corner.x + input.w);
  const nearY = Math.min(Math.max(ball.y, corner.y), corner.y + input.h);
  const dx = ball.x - nearX;
  const dy = ball.y - nearY;
  const reach = ball.r + COVER_PAD - Math.sqrt(dx * dx + dy * dy);
  return Math.max(reach, 0) / Math.max(ball.r, 1);
}

/** How much of the tag at `corner` a bar (padded) covers, as a share of the tag (0 when clear). */
function barCover(bar: Rect, corner: Point, input: TagInput): number {
  const across = (start: number, size: number, from: number, length: number) =>
    Math.max(
      Math.min(start + size, from + length + COVER_PAD) - Math.max(start, from - COVER_PAD),
      0,
    );
  const w = across(corner.x, input.w, bar.x, bar.width);
  const h = across(corner.y, input.h, bar.y, bar.height);
  // Any touch counts in full at least once over: a bar half hidden is as bad as one hidden.
  return w * h > 0 ? 1 + (w * h) / (input.w * input.h) : 0;
}

/** Lower is better. */
export function scoreOf(side: TagSide, input: TagInput): number {
  const corner = cornerOf(side, input);
  const inside = clampInto(corner, input);
  const outside =
    (Math.abs(inside.x - corner.x) * input.h + Math.abs(inside.y - corner.y) * input.w) /
    (input.w * input.h);
  // Balls and bars are judged against where the tag will really be: clamped.
  const balls = input.balls.reduce((sum, ball) => sum + ballCover(ball, inside, input), 0);
  const bars = input.bars.reduce((sum, bar) => sum + barCover(bar, inside, input), 0);
  return outside * OUTSIDE_COST + (balls + bars) * COVER_COST + PREFERENCE[side];
}

/** The best place, keeping `current` unless another is better by SWITCH_MARGIN. */
export function chooseSide(input: TagInput, current: TagSide | undefined): TagSide {
  let best: TagSide = 'above-right';
  let bestScore = Infinity;
  for (const side of SIDES) {
    const score = scoreOf(side, input);
    if (score < bestScore) {
      best = side;
      bestScore = score;
    }
  }
  if (current === undefined || best === current) return best;
  return bestScore < scoreOf(current, input) - SWITCH_MARGIN ? best : current;
}

export interface TagFollower {
  /** The tag's top-left corner this frame, at presentation time `nowMs`. */
  place(input: TagInput, nowMs: number): Point & { readonly side: TagSide };
  /** A new tip: the next place starts at its side, with no glide. */
  reset(): void;
}

/** `easeMs`: the glide's time constant; 0 (reduced motion) moves at once. */
export function createTagFollower(easeMs: () => number = () => EASE_MS): TagFollower {
  let side: TagSide | undefined;
  let offset: Point | undefined;
  let lastMs = 0;
  return {
    place(input, nowMs) {
      side = chooseSide(input, side);
      const wanted = clampInto(cornerOf(side, input), input);
      const target = { x: wanted.x - input.ring.x, y: wanted.y - input.ring.y };
      const ease = easeMs();
      if (offset === undefined || ease <= 0) {
        offset = target;
      } else {
        // Exponential easing towards the place's offset: frame-rate independent, never overshoots.
        const k = 1 - Math.exp(-Math.max(nowMs - lastMs, 0) / ease);
        offset = {
          x: offset.x + (target.x - offset.x) * k,
          y: offset.y + (target.y - offset.y) * k,
        };
      }
      lastMs = nowMs;
      const at = clampInto({ x: input.ring.x + offset.x, y: input.ring.y + offset.y }, input);
      return { ...at, side };
    },
    reset() {
      side = undefined;
      offset = undefined;
    },
  };
}

export interface Glide {
  /**
   * Where to draw a ring whose target is at `at` this frame: when what it is on changes (`key`: the
   * Mirage's copy fading, a Slime half taking over), it glides from where it was instead of
   * jumping; otherwise exactly `at`.
   */
  at(at: Point, key: string, nowMs: number): Point;
  reset(): void;
}

export function createGlide(easeMs: () => number = () => EASE_MS): Glide {
  let key: string | undefined;
  let last: Point | undefined;
  let lag: Point = { x: 0, y: 0 };
  let lastMs = 0;
  return {
    at(at, nextKey, nowMs) {
      const ease = easeMs();
      if (ease <= 0) {
        lag = { x: 0, y: 0 };
      } else if (key !== undefined && nextKey !== key && last !== undefined) {
        lag = { x: last.x - at.x, y: last.y - at.y };
      } else {
        const k = Math.exp(-Math.max(nowMs - lastMs, 0) / ease);
        lag = { x: lag.x * k, y: lag.y * k };
      }
      key = nextKey;
      lastMs = nowMs;
      last = { x: at.x + lag.x, y: at.y + lag.y };
      return last;
    },
    reset() {
      key = undefined;
      last = undefined;
      lag = { x: 0, y: 0 };
    },
  };
}
