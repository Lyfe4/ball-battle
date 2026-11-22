// The arena's ability hints (ADR 0036): one at a time, and a hint that waits its turn is never lost.
// A Slime's "Split!" often queues behind the Thorns' "Spikes!" (the bump that splits it is the bump
// that pricks it); if the half it points at is knocked out before its turn, it shows over the other
// half, and with nothing of its side left it is given back for a later fight. (Before, it was marked
// seen and never shown: on a fresh device in 3.5% of Slime vs Thorns fights.)
import { afterEach, describe, expect, it } from 'vitest';
import { createTips, type TipStorage } from '../app/tips.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { BallState, SimEvent, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { createArenaTips, HINT_MS } from './arena-tips.ts';

const memory = new Map<string, string>();
const storage: TipStorage = () => ({
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
  removeItem: (key) => void memory.delete(key),
});

afterEach(() => {
  document.body.replaceChildren();
  memory.clear();
});

/** A Slime that has just split (its lead and the half split off it) against the Thorns. */
function splitWorld(): { world: WorldState; lead: BallState; half: BallState; thorns: BallState } {
  const base = createWorld(1, [
    getDefinition(BALL_LOOKUP, 'slime'),
    getDefinition(BALL_LOOKUP, 'thorns'),
  ]);
  const [lead, thorns] = base.balls;
  if (lead === undefined || thorns === undefined) throw new Error('expected two balls');
  const half: BallState = { ...lead, id: 'ball-half', side: lead.id, position: { x: 700, y: 700 } };
  return { world: { ...base, balls: [lead, thorns, half] }, lead, half, thorns };
}

function events(lead: BallState, half: BallState, thorns: BallState): SimEvent[] {
  return [
    {
      type: 'damage',
      tick: 10,
      targetId: lead.id,
      sourceId: thorns.id,
      cause: 'ability',
      amount: 4,
      healthAfter: 30,
      multiplier: 1,
      survivedLethal: false,
      via: 'onDamageTaken',
    },
    {
      type: 'split',
      tick: 10,
      ballId: lead.id,
      newBallId: half.id,
      position: lead.position,
      newPosition: half.position,
    },
  ];
}

const knockedOut = (world: WorldState, ids: readonly string[]): WorldState => ({
  ...world,
  balls: world.balls.map((ball) => (ids.includes(ball.id) ? { ...ball, health: 0 } : ball)),
});

function setUp() {
  const container = document.createElement('div');
  document.body.append(container);
  const caption = document.createElement('p');
  document.body.append(caption);
  const tips = createArenaTips(container, caption, BALL_LOOKUP, createTips(storage));
  tips.start(true);
  const shown = () => (caption.hidden ? undefined : caption.textContent);
  return { tips, shown };
}

describe('arena hints', () => {
  it('shows a waiting hint over the other half when the ball it named is knocked out', () => {
    const { world, lead, half, thorns } = splitWorld();
    const { tips, shown } = setUp();
    tips.apply(events(lead, half, thorns), world, 0);
    tips.update(world, 0);
    expect(shown()).toContain('Spikes');
    // Its turn comes after its lead half is out.
    const later = knockedOut(world, [lead.id]);
    tips.update(later, HINT_MS);
    expect(shown()).toContain('Split');
  });

  it('gives a hint back when nothing of its side is left by its turn, to show next fight', () => {
    const { world, lead, half, thorns } = splitWorld();
    const { tips, shown } = setUp();
    tips.apply(events(lead, half, thorns), world, 0);
    tips.update(world, 0);
    tips.update(knockedOut(world, [lead.id, half.id]), HINT_MS);
    expect(shown()).toBeUndefined();
    expect(createTips(storage).takeHint('slime')).toBe(true);
    expect(createTips(storage).takeHint('thorns')).toBe(false);
  });

  it('gives back a hint still waiting when the fight ends', () => {
    const { world, lead, half, thorns } = splitWorld();
    const { tips } = setUp();
    tips.apply(events(lead, half, thorns), world, 0);
    tips.update(world, 0);
    tips.start(true);
    expect(createTips(storage).takeHint('slime')).toBe(true);
  });
});
