// A screen's reads paced on the poke (ADR 0082, PR 6): today's cadence while the socket is down;
// up, the safety read or just after the next deadline; a `match` poke and every change of state
// read at once; and the socket wanted only while the screen paces.
import { describe, expect, it } from 'vitest';
import type { PokeEvent } from '../api/poke.ts';
import type { PokeHub, PokeListener } from './poke-hub.ts';
import { createPokePace, DEADLINE_MARGIN_MS } from './poke-pace.ts';

function fakeHub() {
  const listeners = new Set<PokeListener>();
  let wants = 0;
  const hub: PokeHub & { up: boolean } = {
    up: false,
    want() {
      wants += 1;
      return () => {
        wants -= 1;
      };
    },
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: () => undefined,
  };
  return {
    hub,
    wants: () => wants,
    poke: (event: PokeEvent) => {
      for (const listener of listeners) listener.onPoke?.(event);
    },
    state(up: boolean) {
      hub.up = up;
      for (const listener of listeners) listener.onState?.(up);
    },
  };
}

describe('a screen’s reads on the poke', () => {
  it('keeps today’s cadence while the socket is down, or with no hub at all', () => {
    const { hub } = fakeHub();
    expect(createPokePace(hub, 10_000, () => undefined).delay(1_000, 5_000)).toBe(1_000);
    expect(createPokePace(undefined, 10_000, () => undefined).delay(2_000)).toBe(2_000);
  });

  it('waits for the safety read, or just after the next deadline, while up', () => {
    const fake = fakeHub();
    const pace = createPokePace(fake.hub, 10_000, () => undefined);
    fake.state(true);
    expect(pace.delay(1_000)).toBe(10_000);
    expect(pace.delay(1_000, null)).toBe(10_000);
    expect(pace.delay(1_000, 4_000)).toBe(4_000 + DEADLINE_MARGIN_MS);
    expect(pace.delay(1_000, 60_000)).toBe(10_000);
    // A deadline passed and not yet settled: today's cadence until it is.
    expect(pace.delay(1_000, -200)).toBe(1_000);
  });

  it('reads at once on a match poke and on every change of state, never on an inbox poke', () => {
    const fake = fakeHub();
    let reads = 0;
    createPokePace(fake.hub, 10_000, () => {
      reads += 1;
    });
    fake.poke('inbox');
    expect(reads).toBe(0);
    fake.poke('match');
    fake.state(true);
    fake.state(false);
    expect(reads).toBe(3);
  });

  it('wants the socket only until stopped, and then hears nothing', () => {
    const fake = fakeHub();
    let reads = 0;
    const pace = createPokePace(fake.hub, 10_000, () => {
      reads += 1;
    });
    expect(fake.wants()).toBe(1);
    pace.stop();
    pace.stop();
    expect(fake.wants()).toBe(0);
    fake.state(true);
    fake.poke('match');
    expect(reads).toBe(0);
    expect(pace.delay(1_000)).toBe(1_000);
  });
});
