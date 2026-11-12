// The panel's small parts in a real fight (ADR 0047): the health bars keep both layers inside the
// track's pill, the series bar never breaks inside a phrase (and fits on one line beside a fight on
// a desktop), and the Leave series question sits over Stay and Leave, the same size, Stay first.
// Run at 375 (touch), 1280 (wide) and 1920 (full) wide.
import { expect } from 'vitest';
import page from '../../index.html?raw';
import { button, pressFight, settle, until, visible } from './page-support.ts';

const NEAR = 1;

function inside(inner: DOMRect, outer: DOMRect): boolean {
  return (
    inner.left >= outer.left - NEAR &&
    inner.right <= outer.right + NEAR &&
    inner.top >= outer.top - NEAR &&
    inner.bottom <= outer.bottom + NEAR
  );
}

/** Both layers of every health bar are plain bars clipped by the track's own rounded shape. */
function checkHealthBars(): void {
  const tracks = visible('.hud-health-track');
  expect(tracks).toHaveLength(2);
  for (const track of tracks) {
    expect(getComputedStyle(track).clipPath).not.toBe('none');
    for (const layer of ['.hud-health-fill', '.hud-health-ghost']) {
      const node = track.querySelector<HTMLElement>(layer);
      expect(node, layer).not.toBeNull();
      if (node === null) continue;
      // No rounded end of its own to leave the other layer showing around it.
      expect(getComputedStyle(node).borderTopRightRadius, layer).toBe('0px');
      expect(inside(node.getBoundingClientRect(), track.getBoundingClientRect()), layer).toBe(true);
    }
  }
}

/** Every phrase of "Best of 3 · Reveal · Hard" on one line; the whole line on one beside a fight. */
function checkSeriesBar(desktop: boolean): void {
  const about = visible('.series-bar-about')[0];
  // A phone shows the score line in its place while a round is fought.
  if (about === undefined || about.getClientRects().length === 0) return;
  expect(about.textContent).toBe('Best of 3 · Reveal · Hard');
  for (const phrase of about.querySelectorAll('.series-bar-phrase')) {
    expect(phrase.getClientRects(), phrase.textContent).toHaveLength(1);
  }
  if (desktop) {
    // One line: well under two lines of its own type.
    const fontSize = parseFloat(getComputedStyle(about).fontSize);
    expect(about.getBoundingClientRect().height).toBeLessThan(fontSize * 2);
  }
}

/** The question over Stay and Leave: side by side (or stacked) at the same size, Stay first. */
async function checkLeaveConfirm(): Promise<void> {
  button('Leave series').click();
  await settle();
  const question = visible('.leave-confirm-question')[0]?.getBoundingClientRect();
  const stay = button('Stay');
  const leave = button('Leave');
  expect(document.activeElement).toBe(stay);
  expect(stay.classList.contains('hud-button-primary')).toBe(true);
  const a = stay.getBoundingClientRect();
  const b = leave.getBoundingClientRect();
  expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(NEAR);
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(NEAR);
  expect(a.height).toBeGreaterThanOrEqual(44);
  expect(question === undefined ? Infinity : question.bottom).toBeLessThanOrEqual(a.top + NEAR);
  const sideBySide = Math.abs(a.top - b.top) <= NEAR;
  if (sideBySide) expect(a.left).toBeLessThan(b.left);
  else expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(NEAR);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  expect(visible('.leave-confirm-row')).toHaveLength(0);
}

export async function runPanelPartsFlow(desktop: boolean): Promise<void> {
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  const start = new URL(location.href);
  start.search = '?mode=bo3';
  history.replaceState(null, '', start);
  await import('../main.ts');
  await settle();

  visible('.rules-card')
    .find((card) => card.textContent.startsWith('Reveal'))
    ?.click();
  await settle();
  button('Hard bot').click();
  button('Choose lineup').click();
  await settle();
  for (const id of ['vampire', 'archer', 'brawler']) {
    visible('.ball-tile')
      .find((tile) => tile.dataset['ballId'] === id)
      ?.click();
  }
  button('Reveal lineups').click();
  await settle();
  checkSeriesBar(desktop);
  visible('.answer-step .pick-row-pick')[0]?.click();
  await until(() => visible('.hud-health-track').length === 2, 15_000, false);
  pressFight();
  // A second or two of fighting, so the ghost has health just lost to show.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  checkHealthBars();
  checkSeriesBar(desktop);
  await checkLeaveConfirm();
}
