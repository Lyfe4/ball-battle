// The Friends section loading (ADR 0087, loading rules 2-7, friends-loading.ts) over a fake API
// whose list answers when the test says: the inbox's friends drawn at once and nothing moving when
// the list lands; sized skeleton rows only after 150 ms, then the rows once with one reveal; and one
// failure card in the list's place, the link card kept, Try again reading again.
import { describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendsResponse } from '../../api/friends.ts';
import { callApi, type ApiFailure } from '../../app/api.ts';
import { FIRST_PAINT_FONT } from '../../app/first-paint.ts';
import { visitCache } from '../../app/visit-cache.ts';
import { createFriendsSection } from './friends-section.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const until = async (check: () => boolean, what: string) => {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

const group = (root: HTMLElement, key: string) =>
  [...root.querySelectorAll(`.friends-group[data-group="${key}"] .friends-name`)].map(
    (name) => name.textContent,
  );

/** A section over an API whose `GET friends` answers when the test says (or fails). */
function held() {
  visitCache.clear();
  let answer: (response: Response) => void = () => undefined;
  const link = document.createElement('section');
  link.className = 'link-card-stand-in';
  link.style.height = '120px';
  const friends = createFriendsSection({
    link,
    api: (method, path, body) =>
      callApi(
        method,
        path,
        body,
        {},
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    line: (failure: ApiFailure) => (failure.kind === 'error' ? failure.message : 'offline'),
    copy: () => Promise.resolve(true),
  });
  document.body.replaceChildren(friends.element);
  return {
    friends,
    root: friends.element,
    link,
    answer: (response: Response) => {
      answer(response);
    },
  };
}

const TWO: FriendsResponse = {
  code: '7KQ2M9XD',
  blocked: [],
  incoming: [],
  outgoing: [],
  friends: [
    { id: 'f-1', name: 'Robin', status: 'online' },
    { id: 'f-2', name: 'Kai', status: 'offline' },
  ],
};

/** Where a part sits, to the tenth of a pixel. */
const at = (node: Element | null) => {
  const box = node?.getBoundingClientRect();
  return box === undefined ? 'none' : `${box.top.toFixed(1)} ${box.height.toFixed(1)}`;
};

describe('the Friends section loading (ADR 0087)', () => {
  it('draws the inbox’s friends at once, and nothing moves when the list lands', async () => {
    // The page shows nothing before its font is ready (first-paint.ts): measure in it, as a player sees.
    await document.fonts.load(FIRST_PAINT_FONT);
    await document.fonts.ready;
    const page = held();
    page.friends.statuses(TWO.friends);
    const opened = page.friends.open();
    // The first frame: the inbox's rows, the code card and the link card, in their places.
    expect(group(page.root, 'friends')).toStrictEqual(['Robin', 'Kai']);
    const first = [
      at(page.root.querySelector('.friends-group[data-group="friends"]')),
      at(page.root.querySelector('.friends-add-card')),
      at(page.link),
    ];
    page.answer(json(200, TWO));
    await opened;
    expect(page.root.querySelector('.friends-code-value')?.textContent).toBe('7KQ2-M9XD');
    expect([
      at(page.root.querySelector('.friends-group[data-group="friends"]')),
      at(page.root.querySelector('.friends-add-card')),
      at(page.link),
    ]).toStrictEqual(first);
  });

  it('shows sized skeleton rows only after 150 ms, then the rows once, with one reveal', async () => {
    const page = held();
    const opened = page.friends.open();
    const skeleton = () => page.root.querySelector<HTMLElement>('.friends-skeleton');
    expect(skeleton()?.hidden, 'no skeleton for a quick answer').toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(skeleton()?.hidden).toBe(false);
    expect(skeleton()?.children).toHaveLength(3);
    expect(page.root.querySelector('.friends-add-card')?.hasAttribute('hidden')).toBe(false);
    page.answer(json(200, TWO));
    await opened;
    expect(skeleton()).toBeNull();
    expect(group(page.root, 'friends')).toStrictEqual(['Robin', 'Kai']);
    expect(page.root.querySelector('.friends-lists')?.hasAttribute('data-reveal')).toBe(true);
  });

  it('puts one failure card in the list’s place, the link card kept, and Try again reads again', async () => {
    const page = held();
    const opened = page.friends.open();
    page.answer(
      json(503, { error: { code: 'unavailable', message: 'The server couldn’t answer' } }),
    );
    await opened;
    const card = page.root.querySelector('.friends-lists .friends-failure');
    expect(card?.getAttribute('role')).toBe('alert');
    expect(card?.querySelector('.friends-card-title')?.textContent).toBe('Your friends');
    expect(card?.querySelector('.friends-card-text')?.textContent).not.toBe('');
    expect(page.root.lastElementChild).toBe(page.link);
    const again = [...(card?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Try again',
    );
    again?.click();
    await until(() => page.root.querySelector('.friends-skeleton') !== null, 'the read again');
    page.answer(json(200, TWO));
    await until(() => group(page.root, 'friends').length === 2, 'the rows');
    expect(page.root.querySelector('.friends-failure')).toBeNull();
  });
});
