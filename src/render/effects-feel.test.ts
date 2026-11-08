import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { DamageEvent, SimEvent } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { createEffects } from './effects.ts';
import { wallBounces } from './impact.ts';
import { theme } from './theme.ts';

const hit = (amount: number, healthAfter: number, tick = 10): DamageEvent => ({
  type: 'damage',
  tick,
  targetId: 'ball-1',
  sourceId: 'ball-0',
  cause: 'contact',
  amount,
  healthAfter,
  multiplier: 1,
  survivedLethal: false,
});

const collision = (tick: number): SimEvent => ({
  type: 'collision',
  tick,
  ballIds: ['ball-0', 'ball-1'],
  point: { x: 500, y: 500 },
  normal: { x: 0, y: 1 },
  impulse: 800,
});

const knockout = (tick: number): SimEvent[] => [
  collision(tick),
  hit(20, 0, tick),
  { type: 'ballDefeated', tick, ballId: 'ball-1', defeatedById: 'ball-0' },
  { type: 'matchEnded', tick, result: { kind: 'win', winnerId: 'ball-0' }, reason: 'knockout' },
];

describe('battle feel effects', () => {
  it('keeps a ghost of lost health that holds, drains, and carries over a second hit', () => {
    const effects = createEffects();
    effects.apply([hit(10, 50)], 0);
    expect(effects.ghost('ball-1', 50, 0)).toBe(60);
    // A second hit during the hold keeps the ghost at the health before the first.
    effects.apply([hit(10, 40)], 100);
    expect(effects.ghost('ball-1', 40, 100)).toBe(60);
    const end = 100 + theme.ghostHoldMs + theme.ghostDrainMs;
    expect(effects.ghost('ball-1', 40, end)).toBe(40);
  });

  it('squashes a ball along the hit, and on a wall bounce', () => {
    const effects = createEffects();
    effects.apply([collision(10), hit(theme.fullImpactDamage, 30)], 0);
    expect(effects.squash('ball-1', 0)).toStrictEqual({
      normal: { x: 0, y: 1 },
      along: 1 - theme.squashImpact,
      across: 1 + theme.squashImpact / 2,
    });
    expect(effects.squash('ball-1', theme.squashMs)).toBeUndefined();
    effects.bounced([{ ballId: 'ball-0', normal: { x: 1, y: 0 } }], 0);
    expect(effects.squash('ball-0', 0)?.along).toBe(1 - theme.squashWall);
  });

  it('plays the knockout sequence before showing the result', () => {
    const effects = createEffects();
    effects.apply(knockout(300), 0);
    expect(effects.knockouts(0)).toHaveLength(1);
    expect(effects.winner(0)?.ballId).toBe('ball-0');
    expect(effects.shake(10)).not.toStrictEqual({ x: 0, y: 0 });
    expect(effects.resultVisible(theme.resultDelayMs - 1)).toBe(false);
    expect(effects.isActive(theme.resultDelayMs - 1)).toBe(true);
    expect(effects.resultVisible(theme.resultDelayMs)).toBe(true);
    // Still listed once the shards are gone, so the broken ball stays hidden.
    expect(effects.knockouts(theme.shardMs * 2)).toHaveLength(1);
  });

  it('adds up heals in the same instant into one pulse, and starts afresh later', () => {
    const effects = createEffects();
    const healed = (amount: number): SimEvent => ({
      type: 'healed',
      tick: 40,
      ballId: 'ball-0',
      sourceId: 'ball-0',
      amount,
      healthAfter: 30,
    });
    effects.apply([healed(3), healed(2)], 0);
    expect(effects.healAmount('ball-0')).toBe(5);
    effects.apply([healed(4)], 100);
    expect(effects.healAmount('ball-0')).toBe(4);
  });

  it('lets the Winner sticker play out before a screen may dim or cover the arena', () => {
    // ADR 0033: the round screen used to come 750 ms after the sticker landed, mid-confetti.
    const effects = createEffects();
    effects.apply(knockout(300), 0);
    const landsAt = theme.resultDelayMs - theme.winnerStickerLeadMs;
    expect(effects.stickerVisible(landsAt - 1)).toBe(false);
    expect(effects.stickerVisible(landsAt)).toBe(true);
    const over = landsAt + theme.winnerCelebrationMs;
    // The result itself shows on time; only the celebration's end waits.
    expect(effects.resultVisible(theme.resultDelayMs)).toBe(true);
    expect(effects.celebrationOver(theme.resultDelayMs)).toBe(false);
    expect(effects.celebrationOver(over - 1)).toBe(false);
    expect(effects.isActive(over - 1)).toBe(true);
    expect(effects.celebrationOver(over)).toBe(true);
  });

  it('gives a time-limit win its whole celebration, and a draw none', () => {
    const effects = createEffects();
    const win: SimEvent = {
      type: 'matchEnded',
      tick: 3600,
      result: { kind: 'win', winnerId: 'ball-0' },
      reason: 'timeLimit',
    };
    effects.apply([win], 50);
    expect(effects.stickerVisible(50)).toBe(true);
    expect(effects.celebrationOver(50 + theme.winnerCelebrationMs - 1)).toBe(false);
    expect(effects.celebrationOver(50 + theme.winnerCelebrationMs)).toBe(true);

    const draw = createEffects();
    draw.apply([{ ...win, result: { kind: 'draw' } }], 50);
    expect(draw.stickerVisible(50)).toBe(false);
    expect(draw.celebrationOver(50)).toBe(true);
  });

  it('shows a time-limit result at once', () => {
    const effects = createEffects();
    effects.apply(
      [{ type: 'matchEnded', tick: 3600, result: { kind: 'draw' }, reason: 'timeLimit' }],
      50,
    );
    expect(effects.resultVisible(50)).toBe(true);
    expect(effects.winner(50)).toBeUndefined();
  });

  it('drops shake, squash, particles and shards with reduced motion', () => {
    const effects = createEffects();
    effects.setReducedMotion(true);
    effects.apply(knockout(300), 0);
    expect(effects.shake(10)).toStrictEqual({ x: 0, y: 0 });
    expect(effects.squash('ball-1', 0)).toBeUndefined();
    expect(effects.particles(0)).toStrictEqual([]);
    expect(effects.knockouts(0)).toStrictEqual([]);
    // The flash and the result delay still apply.
    expect(effects.flash('ball-1', 0)).toBe(1);
    expect(effects.resultVisible(0)).toBe(false);
  });

  it('caps particles however many hits land at once', () => {
    const effects = createEffects();
    const events = Array.from({ length: 50 }, (_, i) => [collision(i), hit(30, 10, i)]).flat();
    effects.apply(events, 0);
    expect(effects.particles(0).length).toBeLessThanOrEqual(theme.particleCap);
  });

  it('keeps every effect list bounded over whole matches', () => {
    for (const [a, b] of [
      ['storm', 'storm'],
      ['archer', 'archer'],
      ['brawler', 'speedster'],
    ] as const) {
      const effects = createEffects();
      let world = createWorld(8, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
      let most = 0;
      while (world.match.status === 'running') {
        const result = step(world, BALL_LOOKUP);
        const now = (result.world.tick * 1000) / 60;
        effects.apply(result.events, now);
        effects.bounced(wallBounces(world, result.world), now);
        world = result.world;
        most = Math.max(
          most,
          effects.particles(now).length + effects.sparks(now).length + effects.strikes(now).length,
        );
      }
      expect(most).toBeGreaterThan(0);
      expect(most).toBeLessThanOrEqual(theme.particleCap + 10);
    }
  });
});
