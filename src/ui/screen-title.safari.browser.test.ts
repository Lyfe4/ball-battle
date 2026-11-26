// A screen's title on a phone (390 x 664, 2026-11-27): a long one ("Waiting for" a long username)
// wraps to a second line rather than losing its end; a short one keeps the row's height and its
// place, as frame-anchors measures it.
import { afterEach, describe, expect, it } from 'vitest';
import '../style.css';
import { createScreenHeader } from './screen-header.ts';

afterEach(() => {
  document.body.replaceChildren();
});

const titleOf = (text: string) => {
  const header = createScreenHeader(text, 'Back', () => undefined);
  const stage = document.createElement('main');
  stage.style.width = '358px';
  stage.append(header.element);
  document.body.append(stage);
  const title = header.element.querySelector<HTMLElement>('.screen-title');
  if (title === null) throw new Error('No title');
  return { title, row: header.element };
};

describe('a screen’s title on a phone', () => {
  it('wraps a long name to a second line, whole, and keeps a short one in the row’s height', async () => {
    await document.fonts.ready;
    const short = titleOf('Friends');
    const height = short.title.getBoundingClientRect().height;
    const lead = short.row.querySelector('.screen-lead')?.getBoundingClientRect().height ?? 0;
    expect(Math.abs(height - lead)).toBeLessThanOrEqual(1);
    document.body.replaceChildren();

    const long = titleOf('Waiting for Robin_the_greatest');
    const box = long.title.getBoundingClientRect();
    expect(box.height).toBeGreaterThan(height);
    // Nothing clipped: every word shows.
    expect(long.title.scrollHeight).toBeLessThanOrEqual(long.title.clientHeight + 1);
  });
});
