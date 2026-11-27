// Back through the guided first series (ADR 0090): Play's moves, as every series against the bot.
// Play opens its lineup in one move, the round-1 answer and the rounds are one entry, so one Back
// from any round lands on the lineup and one more on Play.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { fakeWindow } from './fake-history.ts';
import { FIRST_SERIES } from './first-series-setup.ts';
import { screenKeyOf } from './history-rules.ts';
import { writePlayParams } from './modes.ts';
import { createNavigation } from './navigation.ts';
import { parseRoute } from './route.ts';
import { writeSeriesModeParams } from './series-url.ts';

function app() {
  const history = fakeWindow('https://ballbattle.test/');
  const navigation = createNavigation(history.win, (url) =>
    screenKeyOf(parseRoute(url.searchParams, BALL_LOOKUP, false)),
  );
  return {
    navigation,
    back: () => {
      history.win.history.back();
    },
    at: () => new URL(history.href()).search,
    entries: history.entries,
  };
}

describe('Back through the first series', () => {
  it('goes one Back from its rounds to the lineup, one more to Play', () => {
    const { navigation, back, at, entries } = app();
    navigation.go((url) => {
      writePlayParams(url, FIRST_SERIES);
    });
    expect(at()).toBe('?mode=bo3&fmt=reveal&step=lineup');
    navigation.go((url) => {
      writeSeriesModeParams(url, 'reveal', 'answer');
    });
    navigation.go((url) => {
      writeSeriesModeParams(url, 'reveal', 'play');
    });
    expect(entries.length).toBeLessThanOrEqual(3);
    back();
    expect(at()).toBe('?mode=bo3&fmt=reveal&step=lineup');
    back();
    expect(at()).toBe('');
  });
});
