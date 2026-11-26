// Back from a friend's sheet's challenge (ADR 0085 addendum of 2026-11-26): Play by turns opens the
// send screen on its lineup (the rules step in place, never an entry of its own), and a live
// challenge's lobby takes the setup's place (challenge-send.ts), so one Back is Friends either way.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { fakeWindow } from './fake-history.ts';
import { screenKeyOf } from './history-rules.ts';
import { createNavigation } from './navigation.ts';
import { writeChallengeParams, writeSendParams } from './online-url.ts';
import { parseRoute, writeShellParams } from './route.ts';

function shell() {
  const history = fakeWindow('https://ballbattle.test/');
  const navigation = createNavigation(history.win, (url) =>
    screenKeyOf(parseRoute(url.searchParams, BALL_LOOKUP, false, true, true)),
  );
  navigation.go((url) => {
    writeShellParams(url, 'friends');
  });
  return {
    navigation,
    back: () => {
      history.win.history.back();
    },
    at: () => new URL(history.href()).search,
  };
}

const send = (url: URLSearchParams) => {
  writeSendParams(url, 'reveal', 3);
};

describe('Back from a friend’s sheet’s challenge', () => {
  it('returns from the lineup by turns to Friends', () => {
    const { navigation, back, at } = shell();
    navigation.go(send);
    expect(at()).toBe('?view=send&fmt=reveal&mode=bo3');
    back();
    expect(at()).toBe('?view=friends');
  });

  it('returns from a live challenge’s lobby to Friends, not the setup', () => {
    const { navigation, back, at } = shell();
    navigation.go(send);
    navigation.replace((url) => {
      writeChallengeParams(url, 'tok');
    });
    expect(at()).toBe('?challenge=tok');
    back();
    expect(at()).toBe('?view=friends');
  });
});
