// The arena tip through the real page (ADR 0036 addendum of 2026-11-23), run at 390 x 664 (Safari's
// iPhone with its toolbars), 667 x 320 and 812 x 375 (phones turned sideways) and 1280 x 800. A
// fresh device's first Bomber: Bombs tip. In the arena, the dashed cream ring and its "i" tag
// naming the ability, the tag wholly inside the court on every frame it shows. By the match, the
// caption card: a faint cream outline and no stripe, the "i", the ball's drawing, its title and its
// sentence, whole on screen with no clipped line, written once for a screen reader; showing it
// never moves the court or the panel. On a phone it sits under the speed row, on a phone turned
// sideways in the panel, on a desktop at the top of the panel, above its first row.
import { expect } from 'vitest';
import page from '../../index.html?raw';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { HINTS_SEEN_STORAGE_KEY, TIPS_STORAGE_KEY } from '../app/tips.ts';
import { theme } from '../render/theme.ts';
import { bomber } from '../sim/balls/bomber.ts';
import { ARENA_SIZE } from '../sim/constants.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { frames, until, visible } from './page-support.ts';

export type TipPlace = 'under-speed' | 'in-panel' | 'under-panel';

const box = (node: Element | null | undefined): DOMRect => {
  if (node === null || node === undefined) throw new Error('Missing part');
  return node.getBoundingClientRect();
};

/** The court inside the arena's rim, in CSS pixels. */
function courtBox(): { left: number; top: number; right: number; bottom: number } {
  const layer = box(document.querySelector('.arena-tips'));
  const rim = (layer.width * theme.arenaBorderWidth) / (ARENA_SIZE + theme.arenaBorderWidth * 2);
  return {
    left: layer.left + rim,
    top: layer.top + rim,
    right: layer.right - rim,
    bottom: layer.bottom - rim,
  };
}

/** Parts of `root` (itself included) whose content is wider than their own box: clipped text. */
function tooWide(root: Element): string[] {
  return [root, ...root.querySelectorAll('*')]
    .filter((part) => part.clientWidth > 0 && part.scrollWidth > part.clientWidth + 1)
    .map((part) => `${part.className} (${String(part.scrollWidth)} > ${String(part.clientWidth)})`);
}

export async function runTipsArenaFlow(place: TipPlace): Promise<void> {
  for (const key of [TIPS_STORAGE_KEY, HINTS_SEEN_STORAGE_KEY]) window.localStorage.removeItem(key);
  window.localStorage.setItem(SPEED_STORAGE_KEY, '1');
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  const start = new URL(location.href);
  start.search = `?a=bomber&b=brawler&seed=1&v=${String(RULESET_VERSION)}`;
  history.replaceState(null, '', start);
  await import('../main.ts');

  const caption = document.getElementById('arena-caption');
  if (caption === null) throw new Error('no caption');
  await until(() => visible('.arena-tips').length === 1, 10_000, 'the arena');
  // Every write to the caption's words, to hear it once.
  const writes: string[] = [];
  new MutationObserver(() => writes.push(caption.textContent)).observe(caption, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  const court = () => JSON.stringify(box(document.getElementById('arena')));
  const panel = () => JSON.stringify(box(visible('.hud-ball')[0]));
  let before: { court: string; panel: string } | undefined;
  const steady = (at: string) => (place === 'in-panel' ? 'moves with its last row' : at);
  await until(
    () => {
      if (visible('.hud-ball').length > 0 && caption.hidden)
        before = { court: court(), panel: panel() };
      return !caption.hidden;
    },
    30_000,
    'the Bomber: Bombs tip',
  );
  writes.length = 0;

  // The ring and its tag, in the tip's own cream, on every frame they show.
  const ring = visible('.tip-ring')[0];
  const ringStyle = getComputedStyle(ring ?? document.body);
  const cream = getComputedStyle(caption.querySelector('.tip-i') ?? document.body).backgroundColor;
  expect({
    title: caption.querySelector('.arena-caption-title')?.textContent,
    dashed: ringStyle.borderTopStyle,
    cream: ringStyle.borderTopColor === cream,
    tag: visible('.tip-tag')[0]?.textContent,
  }).toStrictEqual({ title: 'Bomber: Bombs', dashed: 'dashed', cream: true, tag: 'iBombs' });
  const outside: string[] = [];
  let seen = 0;
  while (visible('.tip-tag').length === 1) {
    const tag = box(visible('.tip-tag')[0]);
    const inner = courtBox();
    if (
      tag.left < inner.left - 1 ||
      tag.top < inner.top - 1 ||
      tag.right > inner.right + 1 ||
      tag.bottom > inner.bottom + 1
    ) {
      outside.push(JSON.stringify(tag));
    }
    seen++;
    await frames(1);
  }
  expect({ outside, someFrames: seen > 30 }).toStrictEqual({ outside: [], someFrames: true });

  // The caption's card: outlined in faint cream, no stripe, every part, whole, written once.
  const card = getComputedStyle(caption);
  const cap = box(caption);
  expect({
    outline: card.boxShadow.includes('inset') && card.boxShadow.includes('1px'),
    stripe: card.borderLeftWidth,
    mark: caption.querySelector('.tip-i')?.textContent,
    drawing: caption.querySelector('canvas.arena-caption-mark') !== null,
    sentence: caption.querySelector('.arena-caption-text')?.textContent,
    role: caption.getAttribute('role'),
    clipped: tooWide(caption),
    writes,
    // Sideways, the caption is the panel's last row (ADR 0067), so only the court must hold still.
    still: before === undefined ? 'no panel' : { court: court(), panel: steady(panel()) },
  }).toStrictEqual({
    outline: true,
    stripe: '0px',
    mark: 'i',
    drawing: true,
    sentence: bomber.description,
    role: 'status',
    clipped: [],
    writes: [],
    still: before === undefined ? undefined : { ...before, panel: steady(before.panel) },
  });
  expect(cap.left >= 0 && cap.right <= window.innerWidth, 'whole across the screen').toBe(true);

  // Where it sits, for each kind of screen.
  const arena = box(document.getElementById('arena'));
  const hud = box(document.querySelector('.hud'));
  if (place === 'under-speed') {
    const speed = box(document.getElementById('hud-speed'));
    expect({
      under: cap.top >= speed.bottom - 1,
      belowCourt: cap.top >= arena.bottom,
    }).toStrictEqual({ under: true, belowCourt: true });
  } else {
    const firstRow = box(visible('.match-actions')[0] ?? visible('.hud-ball')[0]);
    expect({
      besideCourt: cap.left >= arena.right - 1,
      onScreen: cap.top >= 0 && cap.bottom <= window.innerHeight,
      inPanel:
        place === 'under-panel'
          ? cap.top >= hud.bottom - 1 && cap.top <= hud.bottom + 24
          : cap.top >= hud.top - 1 && cap.bottom <= hud.bottom + 1,
      belowFirstRow: cap.top >= firstRow.bottom,
    }).toStrictEqual({ besideCourt: true, onScreen: true, inPanel: true, belowFirstRow: true });
  }
  window.localStorage.removeItem(SPEED_STORAGE_KEY);
  window.localStorage.removeItem(TIPS_STORAGE_KEY);
}
