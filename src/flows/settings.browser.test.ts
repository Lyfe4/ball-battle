// Settings (ADR 0040) through the real page: the tip switches and the speed are saved on the device
// and read back on the next visit, the in-fight speed and the menu show the same choice, the
// Fight! card's "Don't show these again" is the menu's cards switch, and "Show all tips again"
// turns both switches back on. It opens on a Free play match and never moves to another screen:
// a history entry left behind upsets later files' Back in WebKit (CLAUDE.md, browsers project).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { loadSpeed, SPEED_STORAGE_KEY } from '../app/speed.ts';
import {
  createTips,
  READY_CARD_STORAGE_KEY,
  READY_SEEN_STORAGE_KEY,
  TIPS_STORAGE_KEY,
} from '../app/tips.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { button, settle, visible } from './page-support.ts';

const storage = () => window.localStorage;
const panel = () => document.getElementById('settings-panel');
const switchNamed = (name: string) =>
  [...(panel()?.querySelectorAll<HTMLElement>('[role="switch"]') ?? [])].find((node) =>
    node.textContent.includes(name),
  );
const checked = (name: string) => switchNamed(name)?.getAttribute('aria-checked');
const both = () => [checked('Ability hints'), checked('What to watch cards')];
const pressed = (where: string, speed: number) =>
  document
    .querySelector(`${where} [aria-label="${String(speed)} times speed"]`)
    ?.getAttribute('aria-pressed');

describe('settings', () => {
  it('saves both tip switches and the speed, shared with the fight and the Fight! card', async () => {
    for (const key of [TIPS_STORAGE_KEY, READY_CARD_STORAGE_KEY, READY_SEEN_STORAGE_KEY]) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(SPEED_STORAGE_KEY, '1');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=venom&b=titan&seed=4&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    // A pairing new to this device: its ready card waits.
    expect(visible('.ready-card')).toHaveLength(1);

    // Both switches start on; turned off, they are saved for the next visit.
    visible('#match-actions .settings-toggle')[0]?.click();
    expect(both()).toStrictEqual(['true', 'true']);
    switchNamed('Ability hints')?.click();
    switchNamed('What to watch cards')?.click();
    expect(both()).toStrictEqual(['false', 'false']);
    const nextVisit = createTips(storage);
    expect([nextVisit.enabled(), nextVisit.readyCards()]).toStrictEqual([false, false]);

    // "Show all tips again": both on, saved too.
    button('Show all tips again').click();
    expect(both()).toStrictEqual(['true', 'true']);
    const afterReset = createTips(storage);
    expect([afterReset.enabled(), afterReset.readyCards()]).toStrictEqual([true, true]);

    // Speed from the menu: the in-fight buttons follow, and it is saved.
    panel()?.querySelector<HTMLElement>('[aria-label="2 times speed"]')?.click();
    expect(loadSpeed(storage)).toBe(2);
    expect(pressed('#hud-speed', 2)).toBe('true');
    button('Close settings').click();

    // The Fight! card's "Don't show these again" is the menu's cards switch.
    button('Don’t show these again').click();
    await settle();
    expect(createTips(storage).readyCards()).toBe(false);

    // The in-fight speed changes the menu's too.
    document.querySelector<HTMLElement>('#hud-speed [aria-label="1 times speed"]')?.click();
    visible('#match-actions .settings-toggle')[0]?.click();
    expect(pressed('#settings-panel', 1)).toBe('true');
    expect(checked('What to watch cards')).toBe('false');
    expect(loadSpeed(storage)).toBe(1);
    button('Close settings').click();
  }, 60_000);
});
