// Back along the one vs Friend path (ADR 0089 addendum of 2026-11-27). "Who do you want to play?"
// is a sheet, never an entry: its button moves on from wherever it was opened (Play, Friends, a
// card), so one Back from the waiting screen (which cancels it) or the lineup by turns returns
// there. A guest's lineup by turns or 16+ question on the send screen is replaced by the waiting
// screen, so Back never returns to it. An old link to the vs Friend setup is replaced by Play.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { fakeWindow } from './fake-history.ts';
import { screenKeyOf } from './history-rules.ts';
import { createNavigation } from './navigation.ts';
import { writeChallengeParams, writeSendParams } from './online-url.ts';
import { parseRoute, writeHomeParams, writeShellParams } from './route.ts';

function from(start: 'friends' | 'home') {
  const history = fakeWindow('https://ballbattle.test/');
  const navigation = createNavigation(history.win, (url) =>
    screenKeyOf(parseRoute(url.searchParams, BALL_LOOKUP, false, true, true)),
  );
  // A visit's first move, as the page makes it: Friends, then Play in its place for Play.
  navigation.go((url) => {
    writeShellParams(url, 'friends');
  });
  if (start === 'home') navigation.go(writeHomeParams);
  return {
    navigation,
    back: () => {
      history.win.history.back();
    },
    at: () => new URL(history.href()).search,
  };
}

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const send = (url: URLSearchParams) => {
  writeSendParams(url, 'reveal', 3);
};
const waiting = (url: URLSearchParams) => {
  writeChallengeParams(url, TOKEN);
};

describe('Back along the one vs Friend path', () => {
  it('returns from the waiting screen to Play, or Friends, wherever the sheet was opened', () => {
    for (const start of ['home', 'friends'] as const) {
      const { navigation, back, at } = from(start);
      const opened = at();
      // The sheet's button: the waiting screen, a step on from where the sheet showed.
      navigation.go(waiting);
      expect(at()).toBe(`?challenge=${TOKEN}`);
      back();
      expect(at()).toBe(opened);
    }
  });

  it('returns from the lineup by turns to Friends, and from the sent card too', () => {
    const { navigation, back, at } = from('friends');
    navigation.go(send);
    expect(at()).toBe('?view=send&fmt=reveal&mode=bo3');
    // Sent with its lineup: the card takes the lineup's place.
    navigation.replace(waiting);
    back();
    expect(at()).toBe('?view=friends');
  });

  it('puts Play in an old setup link’s place: Back never returns to it', () => {
    const { navigation, back, at } = from('friends');
    navigation.go(send);
    navigation.replace((url) => {
      writeHomeParams(url);
    });
    expect(at()).toBe('');
    back();
    expect(at()).toBe('?view=friends');
  });
});
