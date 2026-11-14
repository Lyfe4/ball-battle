// Online play's URLs and Back (ADR 0025, 0052): what each opens, that a build without online play
// opens home instead, and the history a friend challenge leaves behind on both phones.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { fakeWindow } from './fake-history.ts';
import { screenKeyOf } from './history-rules.ts';
import { createNavigation } from './navigation.ts';
import {
  parseOnlineRoute,
  writeChallengeParams,
  writeOnlineSeriesParams,
  writeSendParams,
} from './online-url.ts';
import { parseRoute, writeModesParams } from './route.ts';

const SERIES = '0e5c8d7a-1b2c-4d3e-8f90-123456789abc';
const TOKEN = 'WAxqQRi-cu8gT10UyGTlCQ';
const params = (search: string) => new URLSearchParams(search);
const online = (search: string) => parseRoute(params(search), BALL_LOOKUP, false, true);

describe('online URLs', () => {
  it('open a series, a challenge’s card or lineup, and sending one', () => {
    expect(online(`?online=${SERIES}`)).toStrictEqual({ screen: 'online', series: SERIES });
    expect(online(`?challenge=${TOKEN}`)).toStrictEqual({
      screen: 'challenge',
      token: TOKEN,
      step: 'card',
    });
    expect(online(`?challenge=${TOKEN}&step=lineup`)).toMatchObject({ step: 'lineup' });
    expect(online('?view=send&fmt=showdown&mode=bo5')).toStrictEqual({
      screen: 'send',
      format: 'showdown',
      bestOf: 5,
    });
  });

  it('write what they read', () => {
    const cases: readonly ((p: URLSearchParams) => void)[] = [
      (p) => {
        writeOnlineSeriesParams(p, SERIES);
      },
      (p) => {
        writeChallengeParams(p, TOKEN, 'lineup');
      },
      (p) => {
        writeSendParams(p, 'blind', 3);
      },
    ];
    for (const write of cases) {
      const written = new URLSearchParams('?a=x&mode=bo3&view=modes');
      write(written);
      expect(parseOnlineRoute(written)).toBeDefined();
      expect([...written.keys()]).not.toContain('a');
    }
  });

  it('name nothing when malformed: a bad id or token opens home', () => {
    expect(online('?online=not-a-uuid')).toStrictEqual({ screen: 'home' });
    expect(online('?challenge=short')).toStrictEqual({ screen: 'home' });
  });

  it('open home in a build without online play', () => {
    for (const search of [`?online=${SERIES}`, `?challenge=${TOKEN}`, '?view=send&fmt=reveal']) {
      expect(parseRoute(params(search), BALL_LOOKUP, false, false)).toStrictEqual({
        screen: 'home',
      });
    }
  });
});

describe('Back through a friend challenge', () => {
  const keyOf = (url: URL) => screenKeyOf(online(url.search));
  function app(start: string) {
    const history = fakeWindow(`https://ballbattle.test/${start}`);
    const navigation = createNavigation(history.win, keyOf);
    return {
      navigation,
      back: () => {
        history.win.history.back();
      },
      at: () => new URL(history.href()).search,
    };
  }

  it('sender: Other modes, the lineup, then its link in the lineup’s place; Back is Other modes', () => {
    const sender = app('?view=modes');
    sender.navigation.go((p) => {
      writeSendParams(p, 'reveal', 3);
    });
    sender.navigation.replace((p) => {
      writeChallengeParams(p, TOKEN);
    });
    sender.back();
    const modes = new URLSearchParams();
    writeModesParams(modes);
    expect(sender.at()).toBe(`?${modes.toString()}`);
  });

  it('friend: the card, the lineup, then the series in the lineup’s place; Back is the card', () => {
    const friend = app(`?challenge=${TOKEN}`);
    friend.navigation.go((p) => {
      writeChallengeParams(p, TOKEN, 'lineup');
    });
    friend.navigation.replace((p) => {
      writeOnlineSeriesParams(p, SERIES);
    });
    expect(friend.at()).toBe(`?online=${SERIES}`);
    friend.back();
    expect(friend.at()).toBe(`?challenge=${TOKEN}`);
  });

  it('gives each online screen its own key', () => {
    const keys = [
      `?online=${SERIES}`,
      `?challenge=${TOKEN}`,
      `?challenge=${TOKEN}&step=lineup`,
      '?view=send&fmt=reveal',
    ].map((search) => keyOf(new URL(`https://ballbattle.test/${search}`)));
    expect(keys).toStrictEqual(['online', 'challenge', 'challenge-lineup', 'send']);
  });
});
