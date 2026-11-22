// Online play's URLs and Back (ADR 0025, 0052): what each opens, that a build without online play
// opens home instead, and the history a friend challenge leaves behind on both phones.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { fakeWindow } from './fake-history.ts';
import { screenKeyOf } from './history-rules.ts';
import { createNavigation } from './navigation.ts';
import {
  parseOnlineRoute,
  writeSignInParams,
  writeChallengeParams,
  writeOnlineSeriesParams,
  writeSendParams,
} from './online-url.ts';
import { parseRoute } from './route.ts';

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
      step: 'lineup',
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

  it('sender: the vs Friend setup, the lineup, then its link in the lineup’s place; Back is the setup', () => {
    const sender = app('?view=send&fmt=reveal&mode=bo3&step=setup');
    sender.navigation.go((p) => {
      writeSendParams(p, 'reveal', 3);
    });
    sender.navigation.replace((p) => {
      writeChallengeParams(p, TOKEN);
    });
    sender.back();
    expect(sender.at()).toBe('?view=send&fmt=reveal&mode=bo3&step=setup');
  });

  it('reads the vs Friend setup and its lineup from one view, the lineup by default (old links)', () => {
    expect(online('?view=send&fmt=showdown&mode=bo5&step=setup')).toStrictEqual({
      screen: 'send',
      format: 'showdown',
      bestOf: 5,
      step: 'setup',
    });
    expect(online('?view=send&fmt=reveal')).toStrictEqual({
      screen: 'send',
      format: 'reveal',
      bestOf: 3,
      step: 'lineup',
    });
    const written = new URLSearchParams();
    writeSendParams(written, 'reveal', 5, 'setup');
    expect(written.toString()).toBe('view=send&fmt=reveal&mode=bo5&step=setup');
  });

  it('walks the vs Friend setup as vs Bot’s: choices rewrite it, Back keeps them (ADR 0055)', () => {
    const { navigation, back, at } = app('');
    navigation.go((url) => {
      writeSendParams(url, 'reveal', 3, 'setup');
    });
    navigation.go((url) => {
      writeSendParams(url, 'showdown', 5, 'setup');
    });
    navigation.go((url) => {
      writeSendParams(url, 'showdown', 5);
    });
    expect(at()).toBe('?view=send&fmt=showdown&mode=bo5');
    back();
    expect(at()).toBe('?view=send&fmt=showdown&mode=bo5&step=setup');
    back();
    expect(at()).toBe('');
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

describe('the sign-in screen (ADR 0079)', () => {
  const parse = (search: string, accounts = true) =>
    parseOnlineRoute(new URLSearchParams(search), accounts);

  it('is a screen only in builds with accounts', () => {
    expect(parse('view=signin')).toStrictEqual({ screen: 'signin', google: undefined });
    expect(parse('view=signin', false)).toBeUndefined();
  });

  it('reads a Google result it knows, and ignores anything else', () => {
    expect(parse('view=signin&google=switch')).toStrictEqual({
      screen: 'signin',
      google: 'switch',
    });
    expect(parse('view=signin&google=hacked')).toStrictEqual({
      screen: 'signin',
      google: undefined,
    });
  });

  it('is written without a result, so Back and a reload show it afresh', () => {
    const params = new URLSearchParams('view=signin&google=signed_in&x=1');
    writeSignInParams(params);
    expect(params.toString()).toBe('view=signin');
  });
});
