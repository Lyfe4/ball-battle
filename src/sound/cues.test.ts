import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { step } from '../sim/step.ts';
import { blue, red, run, withBalls } from '../sim/test-support.ts';
import { createWorld } from '../sim/world.ts';
import { cuesOf, type FightCue } from './cues.ts';

/** Every cue a whole match makes, by kind, played tick by tick as the arena plays it. */
function heard(a: string, b: string, seed = 7): Map<FightCue, number> {
  const definitions = [a, b].map((id) => {
    const definition = BALL_LOOKUP.get(id);
    if (definition === undefined) throw new Error(id);
    return definition;
  });
  let world = createWorld(seed, definitions);
  const counts = new Map<FightCue, number>();
  for (let tick = 0; tick < 60 * 60 && world.match.status === 'running'; tick += 1) {
    const result = step(world, BALL_LOOKUP);
    for (const cue of cuesOf(result.events, world, result.world)) {
      expect(cue.strength).toBeGreaterThanOrEqual(0);
      expect(cue.strength).toBeLessThanOrEqual(1);
      expect(Math.abs(cue.pan)).toBeLessThanOrEqual(0.5);
      counts.set(cue.kind, (counts.get(cue.kind) ?? 0) + 1);
    }
    world = result.world;
  }
  return counts;
}

describe('cuesOf', () => {
  it('hears bumps and the knockout of any match', () => {
    const counts = heard('brawler', 'frost');
    expect(counts.get('bump') ?? 0).toBeGreaterThan(3);
    expect(counts.get('knockout')).toBe(1);
    expect(counts.get('endBell') ?? 0, 'a knockout is its own end').toBe(0);
  });

  it('rings the end bell once when the time runs out, which has no knockout to hear', () => {
    // Too much health to knock out in a minute: the match goes to the time limit.
    const start = withBalls(createWorld(3, [red, blue]), [{ health: 1e6 }, { health: 1e6 }]);
    let world = start;
    const kinds: FightCue[] = [];
    while (world.match.status === 'running') {
      const { world: next, events } = run(world, 1);
      kinds.push(...cuesOf(events, world, next).map((cue) => cue.kind));
      world = next;
    }
    expect(world.match).toMatchObject({ reason: 'timeLimit' });
    expect(kinds.filter((kind) => kind === 'endBell')).toHaveLength(1);
    expect(kinds).not.toContain('knockout');
  });

  it('rings the end bell for a draw, beside its knockouts', () => {
    const world = createWorld(3, [red, blue]);
    const draw = { kind: 'draw' } as const;
    const [a = '', b = ''] = world.balls.map((ball) => ball.id);
    const kinds = cuesOf(
      [
        { type: 'ballDefeated', tick: 1, ballId: a, defeatedById: b },
        { type: 'ballDefeated', tick: 1, ballId: b, defeatedById: a },
        { type: 'matchEnded', tick: 1, result: draw, reason: 'knockout' },
      ],
      world,
      world,
    ).map((cue) => cue.kind);
    expect(kinds).toStrictEqual(['knockout', 'knockout', 'endBell']);
  });

  it('gives the Archer its own shot and arrow hit', () => {
    const counts = heard('archer', 'brawler');
    expect(counts.get('arrowFire') ?? 0).toBeGreaterThan(2);
    expect(counts.get('arrowHit') ?? 0).toBeGreaterThan(0);
    expect(counts.get('hit') ?? 0).toBe(0);
  });

  it('hears the Hex lay its curse and the curse burst', () => {
    const counts = heard('hex', 'brawler');
    expect(counts.get('curse') ?? 0).toBeGreaterThan(0);
    expect(counts.get('curseBurst') ?? 0).toBeGreaterThan(0);
  });

  it('hears the Battery store a strike and let it out on a bump instead of a plain bump', () => {
    const counts = heard('battery', 'storm');
    expect(counts.get('store') ?? 0).toBeGreaterThan(0);
    expect(counts.get('release') ?? 0).toBeGreaterThan(0);
  });

  it('hears the Slime split once', () => {
    expect(heard('slime', 'brawler').get('split')).toBe(1);
  });

  it('keeps ability sounds to their own balls', () => {
    const counts = heard('brawler', 'thorns');
    for (const kind of ['arrowFire', 'curse', 'store', 'release', 'split'] as const) {
      expect(counts.get(kind) ?? 0).toBe(0);
    }
  });
});
