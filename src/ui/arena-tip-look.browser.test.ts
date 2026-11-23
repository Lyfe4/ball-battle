// The arena tip's timing (ADR 0036 addendum of 2026-11-23): the ring and its "i" tag about 3 s,
// fading in their last 600 ms; the caption about 7 s with no tip after it, fading at the end, or
// until the next tip, never before 4 s; and a zone's ring fades as soon as the zone strikes.
import { afterEach, describe, expect, it } from 'vitest';
import { createTips, type TipStorage } from '../app/tips.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { SimEvent, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { LEAVE_MS } from './arena-tip-ring.ts';
import { createArenaTips, HINT_MS, NEXT_AFTER_MS, RING_MS } from './arena-tips.ts';

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

/** A Bomber against `other`, played until its first bomb lands: that tick's world and events. */
function firstBomb(other = 'brawler'): { world: WorldState; events: readonly SimEvent[] } {
  let world = createWorld(1, [
    getDefinition(BALL_LOOKUP, 'bomber'),
    getDefinition(BALL_LOOKUP, other),
  ]);
  for (let tick = 0; tick < 900; tick++) {
    const result = step(world, BALL_LOOKUP);
    world = result.world;
    if (result.events.some((event) => event.type === 'zoneSpawned')) {
      return { world, events: result.events };
    }
  }
  throw new Error('no bomb');
}

function setUp() {
  const container = document.createElement('div');
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.append(container);
  const caption = document.createElement('p');
  document.body.append(caption);
  const tips = createArenaTips(container, caption, BALL_LOOKUP, createTips(storage));
  tips.start(true);
  const ring = () => container.querySelector<HTMLElement>('.tip-ring');
  const tag = () => container.querySelector<HTMLElement>('.tip-tag');
  const look = () => ({
    ring: ring()?.hidden === false,
    ringLeaving: ring()?.classList.contains('tip-ring-leave') === true,
    tag: tag()?.hidden === false ? tag()?.textContent : undefined,
    caption: caption.hidden ? undefined : caption.querySelector('strong')?.textContent,
    captionLeaving: caption.classList.contains('arena-caption-leave'),
  });
  return { tips, caption, look };
}

describe('the arena tip’s timing', () => {
  it('shows the ring and its tag about 3 s and the caption about 7 s, each fading at its end', () => {
    const { world, events } = firstBomb();
    const { tips, caption, look } = setUp();
    tips.apply(events, world, 0);
    tips.update(world, 0);
    expect(look()).toStrictEqual({
      ring: true,
      ringLeaving: false,
      tag: 'iBombs',
      caption: 'Bomber: Bombs',
      captionLeaving: false,
    });
    // The caption's card: the tip's "i", the ball's drawing, its title and its sentence.
    expect(caption.querySelector('.tip-i')?.textContent).toBe('i');
    expect(caption.querySelector('canvas.arena-caption-mark')).not.toBeNull();
    // The bomb stays on the floor for this test: only time moves.
    tips.update(world, RING_MS - LEAVE_MS - 1);
    expect(look().ringLeaving).toBe(false);
    tips.update(world, RING_MS - LEAVE_MS);
    expect(look()).toMatchObject({ ring: true, ringLeaving: true, tag: 'iBombs' });
    tips.update(world, RING_MS);
    expect(look()).toMatchObject({ ring: false, tag: undefined, caption: 'Bomber: Bombs' });
    tips.update(world, HINT_MS - LEAVE_MS - 1);
    expect(look()).toMatchObject({ caption: 'Bomber: Bombs', captionLeaving: false });
    tips.update(world, HINT_MS - LEAVE_MS);
    expect(look()).toMatchObject({ caption: 'Bomber: Bombs', captionLeaving: true });
    tips.update(world, HINT_MS);
    expect(look().caption).toBeUndefined();
    expect(tips.isActive(HINT_MS)).toBe(false);
  });

  it('gives the caption to the next tip after 4 s, not before', () => {
    const { world, events } = firstBomb();
    const { tips, look } = setUp();
    tips.apply(events, world, 0);
    tips.update(world, 0);
    // Another ability shows while the Bomber's caption is up: the Brawler is hit by a Thorns-like
    // spike (a ball of the same world, retyped), queued behind it.
    const [bomber, other] = world.balls;
    if (bomber === undefined || other === undefined) throw new Error('two balls');
    const thorny: WorldState = {
      ...world,
      balls: [bomber, { ...other, definitionId: 'thorns' }],
    };
    const spikes: SimEvent = {
      type: 'damage',
      tick: world.tick,
      targetId: bomber.id,
      sourceId: other.id,
      cause: 'ability',
      amount: 4,
      healthAfter: 30,
      multiplier: 1,
      survivedLethal: false,
      via: 'onDamageTaken',
    };
    tips.apply([spikes], thorny, 1000);
    tips.update(thorny, NEXT_AFTER_MS - 1);
    expect(look().caption).toBe('Bomber: Bombs');
    tips.update(thorny, NEXT_AFTER_MS);
    expect(look()).toMatchObject({
      caption: 'Thorns: Spikes',
      captionLeaving: false,
      ring: true,
      tag: 'iSpikes',
    });
  });

  it('lets a zone’s ring fade as soon as the zone strikes, the caption staying', () => {
    const { world, events } = firstBomb();
    const { tips, look } = setUp();
    tips.apply(events, world, 0);
    tips.update(world, 0);
    const struck: WorldState = { ...world, zones: [] };
    tips.update(struck, 500);
    expect(look()).toMatchObject({ ring: true, ringLeaving: true, caption: 'Bomber: Bombs' });
    tips.update(struck, 500 + LEAVE_MS);
    expect(look()).toMatchObject({ ring: false, tag: undefined, caption: 'Bomber: Bombs' });
  });
});
