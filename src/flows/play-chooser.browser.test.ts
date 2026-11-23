// The Play tab's chooser (ADR 0081) in a build with online play: vs Bot and vs Friend in the one
// chosen look, starting on vs Bot every time the tab opens; against a friend, Play opens the send
// screen and Change rules steps aside (it would open the same screen); against the bot, Play and
// Change rules do as they always did.
import { describe, expect, it } from 'vitest';
import { back, button, settle, visible } from './page-support.ts';
import { onScreen, openAs } from './shell-routes-support.ts';

const choice = (name: string) => button(name);
const pressed = () =>
  visible('.home-chooser [aria-pressed="true"]').map((node) => node.textContent.trim());
const playMeta = () => visible('.home-play-meta')[0]?.textContent;
const play = () => visible('.home-play')[0];

describe('the Play tab’s chooser', () => {
  it('starts on vs Bot, and against a friend Play opens the send screen', async () => {
    await openAs({ online: true, accounts: false }, '');
    await onScreen('home');
    expect(visible('.home-chooser button').map((node) => node.textContent.trim())).toStrictEqual([
      'vs Bot',
      'vs Friend',
    ]);
    expect(pressed()).toStrictEqual(['vs Bot']);
    expect(playMeta()).toBe('Best of 3 · Reveal · vs Normal bot');
    expect(visible('.home-link').map((link) => link.textContent)).toStrictEqual([
      'Change rules',
      'Free play',
    ]);

    choice('vs Friend').click();
    await settle();
    expect(pressed()).toStrictEqual(['vs Friend']);
    expect(playMeta()).toBe('Live · send a friend a link');
    expect(play()?.getAttribute('aria-label')).toBe('Play a friend live: send them a link');
    expect(visible('.home-link').map((link) => link.textContent)).toStrictEqual(['Free play']);
    // Choosing adds no history step: it is a choice on this screen.
    expect(location.search).toBe('');

    play()?.click();
    await onScreen('send');
    expect(location.search).toBe('?view=send&fmt=reveal&mode=bo3');
    await back();
    await onScreen('home');
    expect(pressed()).toStrictEqual(['vs Bot']);
    expect(playMeta()).toBe('Best of 3 · Reveal · vs Normal bot');
  });

  it('against the bot, Change rules opens its setup on Play’s choices', async () => {
    button('Change rules').click();
    await settle();
    expect(location.search).toBe('?mode=bo3&fmt=reveal');
    await back();
    await onScreen('home');
    expect(document.activeElement).toBe(play());
  });
});
