import { DT, STANDARD_BALL_RADIUS, TICK_RATE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { AbilityAction, BallState } from '../types.ts';

/** A wall of the square arena: 0 left (x = 0), 1 right, 2 top (y = 0), 3 bottom. */
export type WallSide = 0 | 1 | 2 | 3;

/** A web on one wall, centred `at` along it, spun on `since` and gone on `until`. */
export type Web = Readonly<{ side: WallSide; at: number; since: number; until: number }>;

export type SpiderState = Readonly<{
  webs: readonly Web[];
  /** The tick each enemy was last caught, so one bounce catches once. */
  caught: Readonly<Record<string, number>>;
}>;

/** A web reaches this far along its wall on each side of where the Spider touched it. */
export const WEB_HALF_LENGTH = 140;
/** At most this many webs at once; a new one replaces the oldest. */
export const MOST_WEBS = 6;
/** A web lasts this long (12 s). */
export const WEB_TICKS = 720;
/** A ball that bounces off a web takes this much damage. */
export const WEB_NIP = 3;
/** ... and is slowed (the Frost's slow, ADR 0012) for this long (6.5 s). */
export const WEB_SLOW_TICKS = 390;
/** One bounce catches once: a ball caught this recently is not caught again. */
const CATCH_GAP_TICKS = 10;

/** A Spider's webs, read from any ball state (undefined for other balls). */
export function websOf(ball: BallState): readonly Web[] | undefined {
  const webs = ball.abilityState['webs'];
  return Array.isArray(webs) ? (webs as readonly Web[]) : undefined;
}

/** The walls `ball` touches (within `slack`), with where along each wall. */
function wallsTouched(
  ball: BallState,
  size: number,
  slack: number,
): { side: WallSide; at: number }[] {
  const { x, y } = ball.position;
  const reach = ball.radius + slack;
  const touched: { side: WallSide; at: number }[] = [];
  if (x <= reach) touched.push({ side: 0, at: y });
  if (x >= size - reach) touched.push({ side: 1, at: y });
  if (y <= reach) touched.push({ side: 2, at: x });
  if (y >= size - reach) touched.push({ side: 3, at: x });
  return touched;
}

/** How fast `ball` is leaving `side` (0 or less: not moving away from it). */
function speedAwayFrom(ball: BallState, side: WallSide): number {
  const { x, y } = ball.velocity;
  return side === 0 ? x : side === 1 ? -x : side === 2 ? y : -y;
}

/** The gap between `ball`'s edge and `side`. */
function gapTo(ball: BallState, side: WallSide, size: number): number {
  const { x, y } = ball.position;
  const edge = side === 0 ? x : side === 1 ? size - x : side === 2 ? y : size - y;
  return edge - ball.radius;
}

/** True when `ball` has just bounced off `web`: at its wall, inside its reach, moving away. */
function bouncedOff(ball: BallState, web: Web, size: number): boolean {
  const away = speedAwayFrom(ball, web.side);
  const along = web.side < 2 ? ball.position.y : ball.position.x;
  return (
    away > 0 &&
    gapTo(ball, web.side, size) <= away * DT + 0.5 &&
    Math.abs(along - web.at) < WEB_HALF_LENGTH
  );
}

/**
 * Webs (ADR 0049): every wall it bounces off gets a web where it touched, reaching
 * WEB_HALF_LENGTH each way. An enemy that bounces off a webbed stretch of wall is nipped for
 * WEB_NIP and slowed for WEB_SLOW_TICKS. At most MOST_WEBS at once, each lasting WEB_TICKS; a web
 * spun again on the same stretch is moved and renewed, not doubled. A phased ball slips through.
 */
export const spider = defineBall<SpiderState>({
  id: 'spider',
  name: 'Spider',
  description: 'Webs every wall it touches: a ball that bounces off a web is slowed and nipped.',
  color: '#d4d4d8',
  ability: { name: 'Webs', shownBy: { kind: 'hookDamage', hook: 'onTick' } },
  howItWorks: [
    'Each wall it bounces off gets a web where it touched.',
    `A ball that bounces off a web takes ${String(WEB_NIP)} and is slowed for ${String(WEB_SLOW_TICKS / TICK_RATE)} s.`,
    `Up to ${String(MOST_WEBS)} webs at once, each lasting ${String(WEB_TICKS / TICK_RATE)} s.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 71,
  contactDamage: 18,
  initialAbilityState: { webs: [], caught: {} },
  hooks: {
    onWallHit: ({ world, self }) => {
      const size = world.arena.size;
      let webs = self.abilityState.webs.filter((web) => web.until > world.tick);
      const { x, y } = self.velocity;
      const speed = Math.sqrt(x * x + y * y);
      for (const { side, at } of wallsTouched(self, size, speed * DT + 1)) {
        // A web on the same stretch is spun again (moved and renewed), not doubled.
        webs = webs.filter((web) => web.side !== side || Math.abs(web.at - at) >= WEB_HALF_LENGTH);
        webs.push({ side, at, since: world.tick, until: world.tick + WEB_TICKS });
      }
      if (webs.length > MOST_WEBS) webs = webs.slice(webs.length - MOST_WEBS);
      return [{ kind: 'setAbilityState', state: { ...self.abilityState, webs } }];
    },
    onTick: ({ world, self, isPhased }) => {
      const size = world.arena.size;
      const webs = self.abilityState.webs.filter((web) => web.until > world.tick);
      const actions: AbilityAction<SpiderState>[] = [];
      const caught: Record<string, number> = { ...self.abilityState.caught };
      for (const ball of world.balls) {
        if (ball.id === self.id || ball.health <= 0 || isPhased(ball)) continue;
        if ((caught[ball.id] ?? -CATCH_GAP_TICKS) > world.tick - CATCH_GAP_TICKS) continue;
        if (!webs.some((web) => bouncedOff(ball, web, size))) continue;
        caught[ball.id] = world.tick;
        actions.push(
          { kind: 'damage', targetId: ball.id, amount: WEB_NIP },
          {
            kind: 'applyStatus',
            targetId: ball.id,
            status: 'slowed',
            durationTicks: WEB_SLOW_TICKS,
          },
        );
      }
      if (actions.length === 0 && webs.length === self.abilityState.webs.length) return [];
      return [{ kind: 'setAbilityState', state: { webs, caught } }, ...actions];
    },
  },
});
