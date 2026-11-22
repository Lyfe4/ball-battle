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
  writeStartParams,
} from './online-url.ts';
import { parseRoute } from './route.ts';

const START = '11111111-2222-4333-8444-555555555555';
const NEXT = '33333333-2222-4333-8444-555555555555';
const SERIES = '0e5c8d7a-1b2c-4d3e-8f90-123456789abc';
const TOKEN = 'WAxqQRi-cu8gT10UyGTlCQ';
const params = (search: string) => new URLSearchParams(search);
const online = (search: string) => parseRoute(params(search), BALL_LOOKUP, false, true);

describe('online URLs', () => {
  it('open a series, a challenge’s card, sending one and the lineups picked together', () => {
    expect(online(`?online=${SERIES}`)).toStrictEqual({ screen: 'online', series: SERIES });
    expect(online(`?challenge=${TOKEN}`)).toStrictEqual({ screen: 'challenge', token: TOKEN });
    expect(online('?view=send&fmt=showdown&mode=bo5')).toStrictEqual({
      screen: 'send',
      format: 'showdown',
      bestOf: 5,
    });
    expect(online(`?start=${START}`)).toStrictEqual({ screen: 'start', id: START });
    expect(online('?start=nope')).toMatchObject({ screen: 'home' });
  });

  it('open the card or the setup from the last release’s lineup URLs (ADR 0080)', () => {
    expect(online(`?challenge=${TOKEN}&step=lineup`)).toStrictEqual({
      screen: 'challenge',
      token: TOKEN,
    });
    expect(online(`?view=send&fmt=reveal&mode=bo3&rematch=${SERIES}`)).toStrictEqual({
      screen: 'send',
      format: 'reveal',
      bestOf: 3,
    });
  });

  it('write what they read', () => {
    const cases: readonly ((p: URLSearchParams) => void)[] = [
      (p) => {
        writeOnlineSeriesParams(p, SERIES);
      },
      (p) => {
        writeChallengeParams(p, TOKEN);
      },
      (p) => {
        writeSendParams(p, 'blind', 3);
      },
      (p) => {
        writeStartParams(p, START);
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

  it('sender: the vs Friend setup sends, then the lobby; its lineups take the lobby’s place', () => {
    const sender = app('?view=send&fmt=reveal&mode=bo3');
    sender.navigation.go((p) => {
      writeChallengeParams(p, TOKEN);
    });
    sender.navigation.replace((p) => {
      writeStartParams(p, START);
    });
    sender.back();
    expect(sender.at()).toBe('?view=send&fmt=reveal&mode=bo3');
  });

  it('reads the vs Friend setup from one view, an old link’s step ignored', () => {
    expect(online('?view=send&fmt=showdown&mode=bo5&step=setup')).toStrictEqual({
      screen: 'send',
      format: 'showdown',
      bestOf: 5,
    });
    expect(online('?view=send&fmt=reveal')).toStrictEqual({
      screen: 'send',
      format: 'reveal',
      bestOf: 3,
    });
    const written = new URLSearchParams();
    writeSendParams(written, 'reveal', 5);
    expect(written.toString()).toBe('view=send&fmt=reveal&mode=bo5');
  });

  it('walks the vs Friend setup as vs Bot’s: choices rewrite it, Back keeps them (ADR 0055)', () => {
    const { navigation, back, at } = app('');
    navigation.go((url) => {
      writeSendParams(url, 'reveal', 3);
    });
    navigation.go((url) => {
      writeSendParams(url, 'showdown', 5);
    });
    navigation.go((url) => {
      writeChallengeParams(url, TOKEN);
    });
    expect(at()).toBe(`?challenge=${TOKEN}`);
    back();
    expect(at()).toBe('?view=send&fmt=showdown&mode=bo5');
    back();
    expect(at()).toBe('');
  });

  it('friend: the card, the lineups in its place, then the series in theirs; Back leaves', () => {
    const friend = app('');
    friend.navigation.go((p) => {
      writeChallengeParams(p, TOKEN);
    });
    friend.navigation.replace((p) => {
      writeStartParams(p, START);
    });
    expect(friend.at()).toBe(`?start=${START}`);
    friend.navigation.replace((p) => {
      writeOnlineSeriesParams(p, SERIES);
    });
    expect(friend.at()).toBe(`?online=${SERIES}`);
    friend.back();
    expect(friend.at()).toBe('');
  });

  it('rematch: the end screen, the lineups one step in, the new match in their place', () => {
    const both = app(`?online=${SERIES}`);
    both.navigation.go((p) => {
      writeStartParams(p, START);
    });
    expect(both.at()).toBe(`?start=${START}`);
    both.navigation.replace((p) => {
      writeOnlineSeriesParams(p, NEXT);
    });
    both.back();
    expect(both.at()).toBe(`?online=${SERIES}`);
  });

  it('gives each online screen its own key', () => {
    const keys = [
      `?online=${SERIES}`,
      `?challenge=${TOKEN}`,
      '?view=send&fmt=reveal',
      `?start=${START}`,
    ].map((search) => keyOf(new URL(`https://ballbattle.test/${search}`)));
    expect(keys).toStrictEqual(['online', 'challenge', 'send', 'start']);
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
