import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { fakeWindow } from './fake-history.ts';
import { moveFor, screenKeyOf, type ScreenKey } from './history-rules.ts';
import { createNavigation } from './navigation.ts';
import {
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writeMatchUrl,
  writePickParams,
} from './route.ts';
import { writeSeriesModeParams } from './series-url.ts';

const keyOf = (url: URL) => screenKeyOf(parseRoute(url.searchParams, BALL_LOOKUP, false));
const query = (href: string) => new URL(href).search;
const pair = { a: 'brawler', b: 'quake' };

/** The app's navigation over a fake history, starting at the bare URL, with Back as a browser's. */
function app() {
  const history = fakeWindow('https://ballbattle.test/');
  const navigation = createNavigation(history.win, keyOf);
  return {
    navigation,
    back: () => {
      history.win.history.back();
    },
    at: () => query(history.href()),
    entries: history.entries,
  };
}

describe('screenKeyOf', () => {
  const key = (search: string) => keyOf(new URL(`https://ballbattle.test/${search}`));
  it('puts a series’ answer, rounds and result on one key, and its setup steps on their own', () => {
    expect(key('?mode=bo3')).toBe('series-rules');
    expect(key('?mode=bo3&fmt=reveal&step=lineup')).toBe('series-lineup');
    expect(key('?mode=bo3&fmt=reveal&step=answer')).toBe('series');
    expect(key('?mode=bo3&fmt=reveal&step=play')).toBe('series');
    const decided = `?mode=bo3&la=brawler,archer,vampire&lb=frost,speedster,thorns&seed=1&v=${String(RULESET_VERSION)}`;
    expect(key(decided)).toBe('series');
  });

  it('puts the manual’s two tabs on one key and every ball’s entry on another', () => {
    expect(key('?view=manual')).toBe('manual');
    expect(key('?view=manual&tab=chart')).toBe('manual');
    expect(key('?view=manual&ball=frost')).toBe('manual-entry');
    expect(key('?view=manual&ball=quake')).toBe('manual-entry');
  });
});

describe('moveFor', () => {
  const cases: readonly (readonly [ScreenKey, ScreenKey, ScreenKey | undefined, string])[] = [
    ['manual', 'manual', 'home', 'replace'],
    ['manual-entry', 'manual-entry', 'manual', 'replace'],
    ['pick', 'pick', 'home', 'replace'],
    ['series', 'series', 'series-lineup', 'replace'],
    ['match', 'pick', 'pick', 'return'],
    ['series', 'series-lineup', 'series-lineup', 'return'],
    ['home', 'pick', undefined, 'push'],
    ['manual', 'manual-entry', 'home', 'push'],
    ['series-lineup', 'series', 'series-rules', 'push'],
  ];
  it.each(cases)('%s → %s (came from %s): %s', (from, to, previous, move) => {
    expect(moveFor(from, to, previous)).toBe(move);
  });
});

describe('Back through whole flows', () => {
  it('leaves the manual from the matchup chart in one Back', () => {
    const { navigation, back, at } = app();
    navigation.go((url) => {
      writeManualParams(url);
    });
    navigation.go((url) => {
      writeManualParams(url, { chart: true });
    });
    expect(at()).toBe('?view=manual&tab=chart');
    back();
    expect(at()).toBe('');
  });

  it('goes from a ball’s entry back to the index, however many balls were opened from it', () => {
    const { navigation, back, at } = app();
    navigation.go((url) => {
      writeManualParams(url, { chart: true });
    });
    for (const ball of ['vampire', 'speedster', 'archer']) {
      navigation.go((url) => {
        writeManualParams(url, { ball });
      });
    }
    expect(at()).toBe('?view=manual&ball=archer');
    back();
    expect(at()).toBe('?view=manual&tab=chart');
  });

  it('keeps one setup and one match however often Change balls is used', () => {
    const { navigation, back, at, entries } = app();
    navigation.go((url) => {
      writePickParams(url, pair);
    });
    for (let round = 0; round < 3; round += 1) {
      navigation.go((url) => {
        writeMatchUrl(url, pair, 7 + round);
      });
      navigation.go((url) => {
        writePickParams(url, { a: 'frost', b: 'quake' });
      });
    }
    // Change balls went back to the setup, rewritten with the match's balls.
    expect(at()).toBe('?view=pick&a=frost&b=quake');
    expect(entries.length).toBeLessThanOrEqual(3);
    back();
    expect(at()).toBe('');
  });

  it('makes a series one entry: Back from any round lands on the lineup, never the answer', () => {
    const { navigation, back, at } = app();
    navigation.go((url) => {
      writeSeriesModeParams(url);
    });
    navigation.go((url) => {
      writeSeriesModeParams(url, 'reveal', 'lineup');
    });
    navigation.go((url) => {
      writeSeriesModeParams(url, 'reveal', 'answer');
    });
    navigation.go((url) => {
      writeSeriesModeParams(url, 'reveal', 'play');
    });
    back();
    expect(at()).toBe('?mode=bo3&fmt=reveal&step=lineup');
    back();
    expect(at()).toBe('?mode=bo3');
  });

  it('goes back to the lineup for New series rather than stacking another', () => {
    const { navigation, back, at } = app();
    navigation.go((url) => {
      writeSeriesModeParams(url, 'showdown', 'lineup');
    });
    navigation.go((url) => {
      writeSeriesModeParams(url, 'showdown', 'play');
    });
    navigation.go((url) => {
      writeSeriesModeParams(url, 'blind', 'lineup');
    });
    // The pending rewrite applies the format the new series keeps.
    expect(at()).toBe('?mode=bo3&step=lineup');
    back();
    expect(at()).toBe('');
  });

  it('stacks real moves: home, setup, match, and Back undoes one at a time', () => {
    const { navigation, back, at } = app();
    navigation.go((url) => {
      writePickParams(url, pair);
    });
    navigation.go((url) => {
      writeMatchUrl(url, pair, 3);
    });
    navigation.go(writeHomeParams);
    back();
    expect(at()).toContain('seed=3');
    back();
    expect(at()).toBe('?view=pick&a=brawler&b=quake');
  });
});
