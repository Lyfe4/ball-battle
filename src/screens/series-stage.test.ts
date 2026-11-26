import { describe, expect, it } from 'vitest';
import type { Screen } from '../app/route.ts';
import { createSeriesStage } from './series-stage.ts';

/** A stage that records its attributes, and a series of each kind whose state the test sets. */
function setup(screen: Screen) {
  const attributes = new Set<string>();
  const stage = {
    toggleAttribute(name: string, on?: boolean) {
      if (on === true) attributes.add(name);
      else attributes.delete(name);
      return on === true;
    },
  };
  const online = {
    playing: () => true,
    roundOnArena: () => false,
    yourSide: (): 'a' | 'b' | undefined => 'b',
  };
  const offline = { isPlaying: () => true, roundOnArena: () => false };
  const series = createSeriesStage(stage, () => screen, online, offline);
  return { attributes, online, offline, series };
}

describe('the stage behind a series', () => {
  it('shows no arena behind a live series until one of its rounds is on it', () => {
    const { attributes, online, series } = setup('online');
    series.markRound(true);
    expect([...attributes].sort()).toStrictEqual(['data-no-round', 'data-round-over']);
    online.roundOnArena = () => true;
    series.markRoundOnArena();
    expect([...attributes]).toStrictEqual(['data-round-over']);
  });

  it('reads the offline series on its own screen, and marks nothing off a series screen', () => {
    const offline = setup('series');
    offline.series.markRound(false);
    expect([...offline.attributes]).toStrictEqual(['data-no-round']);
    offline.offline.roundOnArena = () => true;
    offline.series.markRound(false);
    expect([...offline.attributes]).toStrictEqual([]);
    const home = setup('home');
    home.series.markRound(false);
    expect([...home.attributes]).toStrictEqual([]);
    expect(home.series.isSetup()).toBe(false);
  });

  it('is a setup screen while a series screen has no series being played', () => {
    const { offline, series } = setup('series');
    expect(series.isSetup()).toBe(false);
    offline.isPlaying = () => false;
    expect(series.isSetup()).toBe(true);
  });
});

describe('the player’s side', () => {
  it('is the server’s seat online, side a against the bot, and none in Free play', () => {
    expect(setup('online').series.yourSide()).toBe('b');
    expect(setup('series').series.yourSide()).toBe('a');
    expect(setup('match').series.yourSide()).toBeUndefined();
  });
});
