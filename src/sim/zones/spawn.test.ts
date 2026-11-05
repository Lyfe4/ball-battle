import { describe, expect, it } from 'vitest';
import { applyActions, sceneOf, type Scene } from '../abilities/apply-actions.ts';
import { indexDefinitions } from '../definitions.ts';
import { red } from '../test-support.ts';
import type { AbilityAction, BallState } from '../types.ts';
import { createWorld } from '../world.ts';

const definitions = indexDefinitions([red]);
const [base] = createWorld(1, [red, red]).balls;
if (base === undefined) throw new Error('expected a ball');
const owner: BallState = { ...base, position: { x: 500, y: 500 } };

const zone = (
  position: { x: number; y: number },
  overrides: Partial<Omit<Extract<AbilityAction, { kind: 'spawnZone' }>, 'kind'>> = {},
): AbilityAction => ({
  kind: 'spawnZone',
  position,
  radius: 100,
  damage: 20,
  delayTicks: 40,
  ...overrides,
});

function spawn(actions: readonly AbilityAction[], scene: Partial<Scene> = {}, tick = 10) {
  return applyActions(
    { ...sceneOf([owner]), ...scene },
    owner.id,
    actions,
    definitions,
    tick,
    1000,
  );
}

describe('spawnZone', () => {
  it('adds a zone with the next id that strikes delayTicks from now', () => {
    const result = spawn([zone({ x: 300, y: 600 })], { nextZoneId: 7 }, 10);
    expect(result.nextZoneId).toBe(8);
    expect(result.zones).toStrictEqual([
      {
        id: 'zone-7',
        ownerId: owner.id,
        position: { x: 300, y: 600 },
        radius: 100,
        damage: 20,
        spawnTick: 10,
        strikeTick: 50,
      },
    ]);
    expect(result.events).toStrictEqual([
      {
        type: 'zoneSpawned',
        tick: 10,
        zoneId: 'zone-7',
        ownerId: owner.id,
        position: { x: 300, y: 600 },
        radius: 100,
        strikeTick: 50,
      },
    ]);
  });

  it('gives every zone its own id, in order', () => {
    const result = spawn([zone({ x: 300, y: 300 }), zone({ x: 700, y: 700 })], { nextZoneId: 2 });
    expect(result.zones.map((spawned) => spawned.id)).toStrictEqual(['zone-2', 'zone-3']);
    expect(result.nextZoneId).toBe(4);
  });

  it('clamps the centre so the whole circle is inside the arena', () => {
    const requests = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { x: -500, y: 500 },
      { x: 500, y: 5000 },
      { x: 1000, y: 0 },
      { x: 50, y: 960 },
    ];
    const result = spawn(requests.map((position) => zone(position)));
    expect(result.zones.map((spawned) => spawned.position)).toStrictEqual([
      { x: 100, y: 100 },
      { x: 900, y: 900 },
      { x: 100, y: 500 },
      { x: 500, y: 900 },
      { x: 900, y: 100 },
      { x: 100, y: 900 },
    ]);
    for (const { position, radius } of result.zones) {
      expect(position.x - radius).toBeGreaterThanOrEqual(0);
      expect(position.y - radius).toBeGreaterThanOrEqual(0);
      expect(position.x + radius).toBeLessThanOrEqual(1000);
      expect(position.y + radius).toBeLessThanOrEqual(1000);
    }
  });

  it('spawns nothing for a defeated owner', () => {
    const result = spawn([zone({ x: 500, y: 500 })], { balls: [{ ...owner, health: 0 }] });
    expect(result.zones).toStrictEqual([]);
    expect(result.nextZoneId).toBe(0);
    expect(result.events).toStrictEqual([]);
  });

  it('rejects zones only a bug could produce', () => {
    const centre = { x: 500, y: 500 };
    for (const bad of [
      zone({ x: Number.NaN, y: 500 }),
      zone(centre, { radius: 0 }),
      zone(centre, { radius: 501 }),
      zone(centre, { damage: -1 }),
      zone(centre, { damage: Infinity }),
      zone(centre, { delayTicks: 0 }),
      zone(centre, { delayTicks: 1.5 }),
    ]) {
      expect(() => spawn([bad])).toThrow(/invalid zone/);
    }
    // Exactly half the arena still fits.
    expect(spawn([zone(centre, { radius: 500 })]).zones).toHaveLength(1);
  });
});
