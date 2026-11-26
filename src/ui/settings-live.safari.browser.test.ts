// Settings never make a live match wait (ADR 0054): at 390 x 664 (browsers-safari), a menu too tall
// for any place off the court covers it and holds an offline match (ADR 0044), but in a live match,
// which plays on the server's clock, it keeps off the court in the room under its gear, scrolling
// inside itself, and the match is never held. The menu with the page's own styles and a court and
// gear where a phone mid-fight has them (the gear in the score line under the court).
import { afterEach, describe, expect, it } from 'vitest';
import '../style.css';
import { createTips } from '../app/tips.ts';
import { createSettingsToggle, installSettings, settingsCoverCourt } from './settings-menu.ts';

const COURT = { left: 16, top: 16, width: 358, height: 358 };

function open(mayWait: boolean): { panel: DOMRect; covers: boolean } {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  installSettings({
    tips: createTips(() => storage),
    speed: () => 1,
    setSpeed: () => undefined,
    court: () => COURT,
    mayWait: () => mayWait,
  });
  const gear = createSettingsToggle();
  gear.style.position = 'fixed';
  gear.style.left = '286px';
  gear.style.top = '386px';
  document.body.append(gear);
  gear.click();
  const panel = document.getElementById('settings-panel');
  if (panel === null) throw new Error('No settings panel');
  return { panel: panel.getBoundingClientRect(), covers: settingsCoverCourt() };
}

const overlapsCourt = (box: DOMRect) =>
  box.left < COURT.left + COURT.width &&
  COURT.left < box.right &&
  box.top < COURT.top + COURT.height &&
  COURT.top < box.bottom;

/** Taller than any place off the court, as on a shorter phone (375 x 635 in Safari). */
const tall = document.createElement('style');
tall.textContent = '.settings-group { min-height: 420px; }';

afterEach(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  tall.remove();
  // Only the gears: the menu keeps its panel and its safe-area probe for the page's life.
  for (const gear of document.querySelectorAll('.settings-toggle')) gear.remove();
});

describe('settings in a live match', () => {
  it('cover the court whole when they must: every row shows without a scroll inside', () => {
    // The menu as it is, too tall for the room above its gear at its own size: it once kept that
    // size, capped and scrolling, which cut Show all tips again and Close off at the bottom.
    const { panel, covers } = open(true);
    expect(covers).toBe(true);
    const menu = document.getElementById('settings-panel');
    const again = [...(menu?.querySelectorAll('button') ?? [])].find((control) =>
      control.textContent.trim().startsWith('Show all tips again'),
    );
    const shown = again?.getBoundingClientRect();
    // About, the last line (Privacy · Terms, ADR 0069 addendum of 2026-11-26), whole inside too.
    const about = menu?.querySelector('.settings-about')?.getBoundingClientRect();
    expect({
      scrolls: menu === null ? 'none' : menu.scrollHeight > menu.clientHeight + 1,
      againInside: shown !== undefined && shown.bottom <= panel.bottom + 0.5,
      aboutInside: about !== undefined && about.height > 0 && about.bottom <= panel.bottom + 0.5,
      overGear: panel.bottom > 386,
    }).toStrictEqual({ scrolls: false, againInside: true, aboutInside: true, overGear: false });
  });

  it('cover the court and hold an offline match when nothing else fits', () => {
    document.head.append(tall);
    const { panel, covers } = open(true);
    expect(overlapsCourt(panel)).toBe(true);
    expect(covers).toBe(true);
  });

  it('never cover the court of a live match, and never hold it', () => {
    document.head.append(tall);
    const { panel, covers } = open(false);
    expect(overlapsCourt(panel), JSON.stringify(panel)).toBe(false);
    expect(covers).toBe(false);
    // Under its gear, inside the visible screen, and it scrolls inside itself.
    expect(panel.top).toBeGreaterThanOrEqual(386 + 44);
    expect(panel.bottom).toBeLessThanOrEqual(window.innerHeight - 16 + 0.5);
    const menu = document.getElementById('settings-panel');
    expect(menu !== null && menu.scrollHeight > menu.clientHeight).toBe(true);
  });
});
