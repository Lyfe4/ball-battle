// The real page in a real browser (`pnpm test:browsers`): a Reveal series left with Back is held,
// not dropped, and resuming it carries on with the round-1 answer already made. The answer screen
// can't be reached again, so leaving can't be used to retry round 1 on the same seed (ADR 0025).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

/** Goes Back as a browser does, and waits for the page to show the screen it lands on. */
async function back(): Promise<void> {
  const landed = new Promise((resolve) => {
    window.addEventListener('popstate', resolve, { once: true });
  });
  history.back();
  await landed;
  await settle();
}

function visible(selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (node) => node.closest('[hidden]') === null && !node.hidden,
  );
}

function button(name: string): HTMLButtonElement {
  const found = visible('button').find(
    (node) =>
      node.textContent.trim() === name ||
      node.getAttribute('aria-label') === name ||
      node.getAttribute('aria-label')?.startsWith(`${name},`) === true,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`No visible button "${name}"`);
  return found;
}

const step = () => new URL(location.href).searchParams.get('step');
/** The names in the HUD's rows: the round being played, as "You X" and "Bot Y". */
const fighting = () => visible('.hud-ball-name').map((row) => row.textContent);

describe('a Reveal series left with Back', () => {
  it('is resumed where it was, and its round-1 answer is never asked again', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3&fmt=reveal&step=lineup&la=brawler,archer,vampire';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    button('Reveal lineups').click();
    await settle();
    expect(step()).toBe('answer');
    const answer = visible('.pick-row')[0];
    if (answer === undefined) throw new Error('No answer to pick');
    answer.click();
    await settle();
    expect(step()).toBe('play');
    const round1 = fighting();
    expect(round1).toHaveLength(2);

    // An accidental Back: the lineup, with the series held.
    await back();
    expect(step()).toBe('lineup');
    expect(visible('.answer-step')).toHaveLength(0);
    const resume = button('Resume series');

    // The answer screen's URL can't reopen it: the bot's revealed lineup is gone with the entry.
    const entry: unknown = history.state;
    history.pushState(entry, '', `${location.pathname}?mode=bo3&fmt=reveal&step=answer`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
    await settle();
    expect(step()).toBe('lineup');
    expect(visible('.answer-step .pick-row')).toHaveLength(0);

    // Resume carries on with the same round 1: the answer made before the Back.
    resume.click();
    await settle();
    expect(step()).toBe('play');
    expect(fighting()).toStrictEqual(round1);
  });
});
