// The Friends section's signals (ADR 0086), over a fake API: who is online in the friends' title,
// a challenge arriving while Friends shows lights its row (no banner there), and Your games after
// Waiting for you, an ending opened leaving at once.
import { describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendsResponse } from '../../api/friends.ts';
import { callApi } from '../../app/api.ts';
import { visitCache } from '../../app/visit-cache.ts';
import { createFriendsSection } from './friends-section.ts';

const START: FriendsResponse = {
  code: '7KQ2M9XD',
  blocked: [],
  friends: [{ id: 'f-1', name: 'Robin', status: 'in_a_match' }],
  incoming: [{ id: 'r-1', name: 'Sam_R' }],
  outgoing: [],
};

/** The section over an API that answers its list. */
function section(start: FriendsResponse = START) {
  visitCache.clear();
  const send = () =>
    Promise.resolve(
      new Response(JSON.stringify(start), { headers: { 'Content-Type': 'application/json' } }),
    );
  const friends = createFriendsSection({
    link: document.createElement('section'),
    api: (method, path, body) => callApi(method, path, body, {}, send),
    line: () => 'failed',
    copy: () => Promise.resolve(true),
  });
  document.body.replaceChildren(friends.element);
  return { friends, root: friends.element };
}

const until = async (check: () => boolean, what: string) => {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
const named = (root: HTMLElement, label: string) =>
  root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const group = (root: HTMLElement, key: string) =>
  [...root.querySelectorAll(`.friends-group[data-group="${key}"] .friends-name`)].map(
    (name) => name.textContent,
  );

describe('the Friends section’s signals', () => {
  it('lists Your games after Waiting for you; an ending opened leaves at once (ADR 0086)', async () => {
    const { friends, root } = section();
    await friends.open();
    const deadline = new Date(Date.now() + 20 * 3_600_000).toISOString();
    friends.challenges(
      [],
      [],
      [{ seriesId: 's-1', opponent: 'Robin', deadline }],
      [{ seriesId: 's-2', opponent: 'Robin', outcome: 'won-ran-out' }],
    );
    expect(
      [...root.querySelectorAll('.friends-group-title')].map((title) => title.textContent),
    ).toStrictEqual(['Waiting for you', 'Your games', 'Friends · 1']);
    const names = () => group(root, 'games');
    expect(names()).toStrictEqual(['Robin’s turn', 'You won vs Robin: their turn ran out']);
    named(root, 'Open: You won vs Robin: their turn ran out')?.click();
    friends.challenges(
      [],
      [],
      [{ seriesId: 's-1', opponent: 'Robin', deadline }],
      [{ seriesId: 's-2', opponent: 'Robin', outcome: 'won-ran-out' }],
    );
    await until(() => names().length === 1, 'the ending to go');
    expect(names()).toStrictEqual(['Robin’s turn']);
  });

  it('lights a challenge that arrives while it shows, in the banner’s place (ADR 0086)', async () => {
    const { friends, root } = section();
    await friends.open();
    const invite = (token: string) =>
      ({ token, from: 'Robin', friend: 'f-1', format: 'reveal', bestOf: 3, live: true }) as const;
    // What waited before is the baseline; only what arrives now lights.
    friends.challenges([invite('old')]);
    friends.challenges([invite('old'), invite('new')]);
    const lit = [...root.querySelectorAll<HTMLElement>('.friends-row[data-invite]')].map(
      (row) => `${row.dataset['invite'] ?? ''} ${String(row.hasAttribute('data-lit'))}`,
    );
    expect(lit).toStrictEqual(['old false', 'new true']);
  });

  it('says who is online in the friends’ title, the one place it is said (ADR 0086)', async () => {
    const online = { id: 'f-2', name: 'Jo', status: 'online' as const };
    const { friends, root } = section({ ...START, friends: [...START.friends, online] });
    await friends.open();
    expect(root.querySelector('.friends-group[data-group="friends"] h2')?.textContent).toBe(
      'Friends · 2 · 1 online',
    );
  });
});
