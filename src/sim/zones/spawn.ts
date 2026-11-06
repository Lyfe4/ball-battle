import type { StatusRequest } from '../status.ts';
import type { BallState, SimEvent, Vec2, ZoneState } from '../types.ts';

export interface ZoneRequest {
  readonly position: Vec2;
  readonly radius: number;
  readonly damage: number;
  readonly delayTicks: number;
  readonly status?: StatusRequest;
  /** Keeps the zone after its first strike, pulsing again on a fixed rhythm (ADR 0034). */
  readonly linger?: ZoneLinger;
}

/**
 * A lasting zone (ADR 0034): after its first strike it stays for `ticks` more, striking again every
 * `pulseEveryTicks`, so a ball that stays inside is hit again. Both are whole numbers, at least 1.
 */
export interface ZoneLinger {
  readonly ticks: number;
  readonly pulseEveryTicks: number;
}

export interface ZoneSpawnResult {
  readonly zone: ZoneState;
  readonly event: SimEvent;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function assertValid(owner: BallState, request: ZoneRequest, arenaSize: number): void {
  const { position, radius, damage, delayTicks } = request;
  const valid =
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(radius) &&
    radius > 0 &&
    radius * 2 <= arenaSize &&
    Number.isFinite(damage) &&
    damage >= 0 &&
    Number.isInteger(delayTicks) &&
    delayTicks >= 1 &&
    (request.status === undefined ||
      (Number.isInteger(request.status.durationTicks) && request.status.durationTicks >= 1)) &&
    (request.linger === undefined ||
      (Number.isInteger(request.linger.ticks) &&
        request.linger.ticks >= 1 &&
        Number.isInteger(request.linger.pulseEveryTicks) &&
        request.linger.pulseEveryTicks >= 1));
  if (!valid) {
    throw new Error(`An ability of "${owner.id}" tried to spawn an invalid zone`);
  }
}

/**
 * Creates a zone for `owner` that strikes `delayTicks` after `tick`, and keeps pulsing until
 * `linger.ticks` after that when it lingers (ADR 0034). Its centre is clamped on each axis to
 * [radius, arenaSize - radius], so the whole circle is inside the arena (ADR 0006).
 */
export function spawnZone(
  owner: BallState,
  request: ZoneRequest,
  id: string,
  arenaSize: number,
  tick: number,
): ZoneSpawnResult {
  assertValid(owner, request, arenaSize);
  const { radius } = request;
  const max = arenaSize - radius;
  const zone: ZoneState = {
    id,
    ownerId: owner.id,
    position: {
      x: clamp(request.position.x, radius, max),
      y: clamp(request.position.y, radius, max),
    },
    radius,
    damage: request.damage,
    spawnTick: tick,
    strikeTick: tick + request.delayTicks,
    ...(request.status === undefined ? {} : { status: request.status }),
    ...(request.linger === undefined
      ? {}
      : {
          endTick: tick + request.delayTicks + request.linger.ticks,
          pulseEveryTicks: request.linger.pulseEveryTicks,
        }),
  };
  return {
    zone,
    event: {
      type: 'zoneSpawned',
      tick,
      zoneId: id,
      ownerId: owner.id,
      position: zone.position,
      radius,
      strikeTick: zone.strikeTick,
    },
  };
}
