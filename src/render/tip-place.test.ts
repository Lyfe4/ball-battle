// Where an arena tip's tag sits (ADR 0036 addendum of 2026-11-23): inside the court, on the side
// with room, clear of balls and health bars, no flip-flop, smooth on the fastest ball in play, and
// with reduced motion it moves at once rather than gliding.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { createWorld } from '../sim/world.ts';
import { healthBarRect, type Rect } from './health-bar.ts';
import {
  chooseSide,
  createGlide,
  createTagFollower,
  scoreOf,
  type Circle,
  type TagInput,
} from './tip-place.ts';

const COURT = 1000;
const tag = { w: 120, h: 40, court: COURT };
const at = (
  x: number,
  y: number,
  balls: readonly Circle[] = [],
  bars: readonly Rect[] = [],
): TagInput => ({ ...tag, ring: { x, y, r: 40 }, balls, bars });
const inside = (p: { x: number; y: number }) =>
  p.x >= 0 && p.y >= 0 && p.x + tag.w <= COURT && p.y + tag.h <= COURT;
const overlaps = (p: { x: number; y: number }, bar: Rect) =>
  p.x < bar.x + bar.width && p.x + tag.w > bar.x && p.y < bar.y + bar.height && p.y + tag.h > bar.y;

/** A real ball at `x, y` and its health bar as the court draws it. */
function ballAt(x: number, y: number): { circle: Circle; bar: Rect } {
  const [ball] = createWorld(1, [
    getDefinition(BALL_LOOKUP, 'brawler'),
    getDefinition(BALL_LOOKUP, 'brawler'),
  ]).balls;
  if (ball === undefined) throw new Error('no ball');
  const placed = { ...ball, position: { x, y } };
  return { circle: { x, y, r: ball.radius }, bar: healthBarRect(placed, COURT) };
}

describe('the tip tag’s place', () => {
  it('sits above right in open court', () => {
    expect(chooseSide(at(500, 500), undefined)).toBe('above-right');
  });

  it('flips to the side with room by a wall or in a corner', () => {
    expect(chooseSide(at(960, 500), undefined)).toBe('above-left');
    expect(chooseSide(at(500, 30), undefined)).toBe('below-right');
    expect(chooseSide(at(970, 20), undefined)).toBe('below-left');
  });

  it('keeps clear of another ball where it can', () => {
    const ball = { x: 580, y: 440, r: 40 };
    expect(scoreOf('above-right', at(500, 500, [ball]))).toBeGreaterThan(1);
    expect(chooseSide(at(500, 500, [ball]), undefined)).toBe('above-left');
  });

  it('keeps clear of a health bar, its own ball’s included, where it can', () => {
    // The ring's own ball's bar sits above it: above right would cover it.
    const own = ballAt(500, 500);
    const placed = createTagFollower().place(at(500, 500, [], [own.bar]), 0);
    expect(overlaps(placed, own.bar)).toBe(false);
    // Another ball's bar just above right of the ring, the ball itself out of the way.
    const other = ballAt(640, 470);
    const input = at(500, 500, [], [other.bar]);
    const clear = createTagFollower().place(input, 0);
    expect(overlaps(clear, other.bar)).toBe(false);
    // With no bars, the same ring takes above right: the bar is what moved it.
    expect(chooseSide(at(500, 500), undefined)).toBe('above-right');
  });

  it('is always wholly inside the court, wherever the ring is', () => {
    const follower = createTagFollower();
    for (let x = 0; x <= COURT; x += 25) {
      for (let y = 0; y <= COURT; y += 25) {
        expect(inside(follower.place(at(x, y), x * 40 + y))).toBe(true);
      }
    }
  });

  it('does not flip back and forth while a ball passes near its threshold', () => {
    // Find where a ball passing above the ring changes the best side (with no history)...
    const near = (x: number) => [{ x, y: 430, r: 40 }];
    let tie = 0;
    for (let x = 300; x <= 700 && tie === 0; x += 0.5) {
      if (
        chooseSide(at(500, 500, near(x)), undefined) !==
        chooseSide(at(500, 500, near(x - 0.5)), undefined)
      ) {
        tie = x;
      }
    }
    expect(tie).toBeGreaterThan(300);
    // ...then weave the ball a few units either side of it, frame after frame.
    const follower = createTagFollower();
    let flips = 0;
    let last = '';
    for (let frame = 0; frame < 600; frame++) {
      const placed = follower.place(
        at(500, 500, near(tie + (frame % 2 === 0 ? -4 : 4))),
        frame * 16,
      );
      if (last !== '' && placed.side !== last) flips++;
      last = placed.side;
    }
    expect(flips).toBeLessThanOrEqual(1);
  });

  it('rides smoothly on the fastest ball in play (1506 units a second, a Slime half)', () => {
    // At 60 frames a second, round and round the court past another ball, bouncing off the walls:
    // the tag moves with the ball, stays inside, and a change of side eases, never jumping.
    const follower = createTagFollower();
    const speed = 1506 / 60;
    const other = ballAt(500, 500);
    let pos = { x: 200, y: 300 };
    let vel = { x: speed * 0.8, y: speed * 0.6 };
    let before: { x: number; y: number } | undefined;
    let beforeRing = pos;
    let worst = 0;
    let flips = 0;
    let side = '';
    for (let frame = 0; frame < 1200; frame++) {
      pos = { x: pos.x + vel.x, y: pos.y + vel.y };
      if (pos.x < 40 || pos.x > COURT - 40) vel = { x: -vel.x, y: vel.y };
      if (pos.y < 40 || pos.y > COURT - 40) vel = { x: vel.x, y: -vel.y };
      const input = at(pos.x, pos.y, [other.circle], [other.bar]);
      const placed = follower.place(input, frame * (1000 / 60));
      expect(inside(placed)).toBe(true);
      if (before !== undefined) {
        // How far the tag moved beyond the ring's own move this frame.
        const dx = placed.x - before.x - (pos.x - beforeRing.x);
        const dy = placed.y - before.y - (pos.y - beforeRing.y);
        worst = Math.max(worst, Math.sqrt(dx * dx + dy * dy));
      }
      if (side !== '' && placed.side !== side) flips++;
      side = placed.side;
      before = placed;
      beforeRing = pos;
    }
    // A side change crosses up to ~2 tag widths, eased over EASE_MS: about 30 units a frame at most,
    // plus where the court's edge clamps it. A jump would be the whole crossing (~250) at once.
    expect(worst).toBeLessThan(45);
    // About one side change per wall or ball it nears, never one per frame.
    expect(flips).toBeLessThan(80);
  });

  it('with reduced motion, moves to its new side at once instead of gliding', () => {
    const still = createTagFollower(() => 0);
    const glides = createTagFollower();
    for (const follower of [still, glides]) follower.place(at(500, 500), 0);
    // The ring reaches the right wall: the tag's place is now above left.
    const wall = at(960, 500);
    const fromStill = still.place(wall, 16);
    const fromGlide = glides.place(wall, 16);
    expect(fromStill.side).toBe('above-left');
    expect(fromStill.x).toBeCloseTo(960 - 40 * 0.72 - tag.w);
    expect(fromGlide.x).toBeGreaterThan(fromStill.x + 50);
  });

  it('glides when what the ring is on changes, and is exact otherwise', () => {
    const glide = createGlide();
    expect(glide.at({ x: 100, y: 100 }, 'copy', 0)).toStrictEqual({ x: 100, y: 100 });
    expect(glide.at({ x: 120, y: 100 }, 'copy', 16)).toStrictEqual({ x: 120, y: 100 });
    // The copy fades and the ring goes to the ball 300 units away: starts where it was, closes in.
    expect(glide.at({ x: 420, y: 100 }, 'ball', 32)).toStrictEqual({ x: 120, y: 100 });
    const later = glide.at({ x: 420, y: 100 }, 'ball', 32 + 140 * 5);
    expect(Math.abs(later.x - 420)).toBeLessThan(3);
    // With reduced motion it is on the ball at once.
    const still = createGlide(() => 0);
    still.at({ x: 120, y: 100 }, 'copy', 0);
    expect(still.at({ x: 420, y: 100 }, 'ball', 16)).toStrictEqual({ x: 420, y: 100 });
  });
});
