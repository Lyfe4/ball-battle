// Settings (ADR 0040) through the real page: the tip switches and the speed are saved on the device
// and read back on the next visit, the in-fight speed and the menu show the same choice, the
// Fight! card's "Don't show these again" is the menu's cards switch, and "Show all tips again"
// turns both switches back on.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { loadSpeed, SPEED_STORAGE_KEY } from '../app/speed.ts';
import {
  createTips,
  READY_CARD_STORAGE_KEY,
  READY_SEEN_STORAGE_KEY,
  TIPS_STORAGE_KEY,
} from '../app/tips.ts';
import { button, settle, until, visible } from './page-support.ts';

const storage = () => window.localStorage;
const panel = () => document.getElementById('settings-panel');
const switchNamed = (name: string) =>
  [...(panel()?.querySelectorAll<HTMLElement>('[role="switch"]') ?? [])].find((node) =>
    node.textContent.includes(name),
  );
const checked = (name: string) => switchNamed(name)?.getAttribute('aria-checked');

describe('settings', () => {
  it('saves both tip switches and the speed, shared with the fight and the Fight! card', async () => {
    for (const key of [TIPS_STORAGE_KEY, READY_CARD_STORAGE_KEY, READY_SEEN_STORAGE_KEY]) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(SPEED_STORAGE_KEY, '1');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?view=pick&a=venom&b=titan';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    // Both switches start on; turned off, they are saved for the next visit.
    visible('.settings-toggle')[0]?.click();
    expect([checked('Ability hints'), checked('What to watch cards')]).toStrictEqual([
      'true',
      'true',
    ]);
    switchNamed('Ability hints')?.click();
    switchNamed('What to watch cards')?.click();
    expect([checked('Ability hints'), checked('What to watch cards')]).toStrictEqual([
      'false',
      'false',
    ]);
    const nextVisit = createTips(storage);
    expect([nextVisit.enabled(), nextVisit.readyCards()]).toStrictEqual([false, false]);

    // "Show all tips again": both on, saved too.
    button('Show all tips again').click();
    expect([checked('Ability hints'), checked('What to watch cards')]).toStrictEqual([
      'true',
      'true',
    ]);
    const afterReset = createTips(storage);
    expect([afterReset.enabled(), afterReset.readyCards()]).toStrictEqual([true, true]);

    // Speed from the menu: the in-fight buttons follow, and it is saved.
    panel()?.querySelector<HTMLElement>('[aria-label="2 times speed"]')?.click();
    expect(loadSpeed(storage)).toBe(2);
    expect(
      document
        .querySelector('#hud-speed [aria-label="2 times speed"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    button('Close settings').click();

    // The Fight! card's "Don't show these again" is the menu's cards switch.
    button('Start match').click();
    await until(() => visible('.ready-card').length === 1, 10_000, false);
    button('Don’t show these again').click();
    await settle();
    expect(createTips(storage).readyCards()).toBe(false);

    // The in-fight speed changes the menu's too.
    document.querySelector<HTMLElement>('#hud-speed [aria-label="1 times speed"]')?.click();
    visible('.settings-toggle')[0]?.click();
    expect(
      panel()?.querySelector('[aria-label="1 times speed"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(checked('What to watch cards')).toBe('false');
    expect(loadSpeed(storage)).toBe(1);
  }, 60_000);
});
