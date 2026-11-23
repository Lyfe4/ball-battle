// One settings menu (ADR 0040, 0081 addendum of 2026-11-24): the same width, place across the
// screen, headings, rows and spacing on every screen at 390 x 664: the four tabs, Profile, a
// lineup pick and a fight. On Play it used to take a compact form (its headings and the Speed
// label hidden, speed beside the title) to keep off the demo court, narrower and further right,
// and the chooser's check mark painted over it: the title row's own layer (z-index 2) held the
// menu below the chooser's sticker. Nothing between the menu and the page may hold it in a layer.
import { describe, expect, it } from 'vitest';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { pressFight, settle, until, visible } from './page-support.ts';
import { avatarsShown, follow, onScreen, openAs, tabLink } from './shell-routes-support.ts';

const panel = () => document.getElementById('settings-panel');

/** Laid out, and big enough to read: not a 1 px box kept for screen readers. */
const seen = (node: Element | null | undefined): node is HTMLElement => {
  if (!(node instanceof HTMLElement)) return false;
  const box = node.getBoundingClientRect();
  return box.width > 4 && box.height > 4 && getComputedStyle(node).visibility !== 'hidden';
};

/** The menu's parts, each with its words and where it sits in the menu, in order. */
const PARTS = [
  '.settings-title',
  '#settings-panel-play',
  '.settings-speed .segmented-label',
  '.settings-speed [aria-label="1 times speed"]',
  '.settings-speed [aria-label="2 times speed"]',
  '.settings-sound',
  '#settings-panel-tips',
  '.settings-switch',
  '.settings-again',
  '.settings-close',
];

interface Look {
  readonly left: number;
  readonly width: number;
  readonly parts: readonly string[];
  /** Ancestors that make a layer of their own (z-index set): none, so nothing paints over it. */
  readonly layers: readonly string[];
}

/** Opens the gear on show and reads the menu; closes it again. */
async function look(where: string): Promise<Look> {
  const gear = visible('.settings-toggle').find(seen);
  if (gear === undefined) throw new Error(`${where}: no gear`);
  gear.click();
  await settle();
  const menu = panel();
  if (menu === null || menu.hidden) throw new Error(`${where}: no menu`);
  const box = menu.getBoundingClientRect();
  const parts = PARTS.flatMap((selector) =>
    [...menu.querySelectorAll(selector)].map((node) => {
      const at = node.getBoundingClientRect();
      const text = node.textContent.trim();
      const words = text === '' ? (node.getAttribute('aria-label') ?? selector) : text;
      // Shown or not, and where inside the menu (rounded: sub-pixel text differs by engine).
      return seen(node)
        ? `${words} @${String(Math.round(at.left - box.left))},${String(Math.round(at.top - box.top))}`
        : `${words} (hidden)`;
    }),
  );
  const layers: string[] = [];
  for (let node = menu.parentElement; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).zIndex !== 'auto')
      layers.push(node.className === '' ? node.tagName : node.className);
  }
  gear.click();
  await settle();
  return { left: Math.round(box.left), width: Math.round(box.width), parts, layers };
}

describe('the settings menu at 390 x 664', () => {
  it('is one menu on every screen: same place across, width, headings, rows and spacing', async () => {
    await openAs({ online: true, accounts: true }, '');
    await onScreen('home');
    const looks: Record<string, Look> = { play: await look('play') };
    for (const [tab, screen] of [
      ['Balls', 'manual'],
      ['Friends', 'friends'],
      ['Ranks', 'ranks'],
    ] as const) {
      tabLink(tab).click();
      await onScreen(screen);
      looks[screen] = await look(screen);
    }
    avatarsShown()[0]?.click();
    await onScreen('profile');
    looks['profile'] = await look('profile');
    // A lineup pick: Play opens the remembered bot series' lineup.
    tabLink('Play').click();
    await onScreen('home');
    visible('.home-play-row .home-play')[0]?.click();
    await onScreen('series');
    await until(
      () => visible('.lineup-step, .series-lineup').length > 0,
      5_000,
      'the lineup',
      false,
    );
    looks['lineup'] = await look('lineup');
    // A fight: Free play's match, under way.
    await follow(`?a=venom&b=titan&seed=4&v=${String(RULESET_VERSION)}`);
    await onScreen('match');
    pressFight();
    await settle();
    looks['fight'] = await look('fight');

    const reference = looks['manual'];
    if (reference === undefined) throw new Error('no reference');
    // Every heading and label shows, and the speed sits under Fights, not beside the title.
    expect(reference.parts.filter((part) => part.endsWith('(hidden)'))).toStrictEqual([]);
    for (const [where, seenLook] of Object.entries(looks)) {
      expect({ where, ...seenLook }).toStrictEqual({ where, ...reference, layers: [] });
    }
  });
});
