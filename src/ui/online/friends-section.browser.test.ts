// The Friends tab's lists (ADR 0079, PR (c); ADR 0081) over a fake API: the code shown with a
// dash, a friend added by what was typed, a request accepted and one declined, a friend removed
// only after Remove is asked in place (Keep first), a refusal said under the field, and the
// sections in one order: Waiting for you, Friends (or the empty state), your code and Add, then the
// link card, always last (ADR 0087); the inbox's rows at once, skeleton rows after 150 ms, one
// failure card; More's Block and Report name, each
// asked in place, and Unblock from the Blocked list (2026-11-25).
import { describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendsResponse } from '../../api/friends.ts';
import { callApi, type ApiFailure } from '../../app/api.ts';
import { visitCache } from '../../app/visit-cache.ts';
import { createFriendsSection } from './friends-section.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const START: FriendsResponse = {
  code: '7KQ2M9XD',
  blocked: [],
  friends: [{ id: 'f-1', name: 'Robin', status: 'in_a_match' }],
  incoming: [
    { id: 'r-1', name: 'Sam_R' },
    { id: 'r-2', name: 'Player 4821' },
  ],
  outgoing: [],
};

/** The section over an API that keeps a list and answers each change with it. */
function section(start: FriendsResponse = START) {
  // Each section a fresh visit: nothing kept from the last test.
  visitCache.clear();
  let list: FriendsResponse = start;
  const sent: string[] = [];
  const send = (input: string, init: RequestInit) => {
    const path = new URL(input, location.href).pathname.replace('/api/v1/', '');
    const method = init.method ?? 'GET';
    sent.push(`${method} ${path}${typeof init.body === 'string' ? ` ${init.body}` : ''}`);
    if (method === 'POST' && path === 'friends') {
      const { to } = JSON.parse(init.body as string) as { to: string };
      if (to === 'nobody') {
        return Promise.resolve(
          json(404, {
            error: {
              code: 'friend_not_found',
              message: 'No account has that username or friend code',
            },
          }),
        );
      }
      list = { ...list, outgoing: [...list.outgoing, { id: 'o-1', name: to }] };
      return Promise.resolve(json(200, { ...list, outcome: 'requested', name: to }));
    }
    const accept = /^friends\/(.+)\/accept$/.exec(path);
    if (accept !== null) {
      const row = list.incoming.find((entry) => entry.id === accept[1]);
      list = {
        ...list,
        incoming: list.incoming.filter((entry) => entry !== row),
        friends: row === undefined ? list.friends : [...list.friends, row],
      };
    }
    const blocked = /^friends\/(.+)\/(block|unblock|report)$/.exec(path);
    if (blocked !== null) {
      const [, id, action] = blocked;
      const keep = (entry: { id: string }) => entry.id !== id;
      const row = [...list.friends, ...list.incoming].find((entry) => !keep(entry));
      if (action === 'block' && row !== undefined) {
        list = {
          ...list,
          friends: list.friends.filter(keep),
          incoming: list.incoming.filter(keep),
          blocked: [...list.blocked, { id: row.id, name: row.name }],
        };
      } else if (action === 'unblock') {
        list = { ...list, blocked: list.blocked.filter(keep) };
      } else if (action === 'report') {
        const hide = (entry: { id: string; name: string }) =>
          entry.id === id ? { ...entry, name: 'Player 7' } : entry;
        list = { ...list, friends: list.friends.map(hide), incoming: list.incoming.map(hide) };
      }
    }
    const gone = /^friends\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && gone !== null) {
      const keep = (entry: { id: string }) => entry.id !== gone[1];
      list = {
        ...list,
        friends: list.friends.filter(keep),
        incoming: list.incoming.filter(keep),
        outgoing: list.outgoing.filter(keep),
      };
    }
    return Promise.resolve(json(200, list));
  };
  const challenged: string[] = [];
  let changes = 0;
  const link = document.createElement('section');
  link.className = 'link-card-stand-in';
  const friends = createFriendsSection({
    link,
    api: (method, path, body) => callApi(method, path, body, {}, send),
    line: (answer: ApiFailure) => (answer.kind === 'error' ? answer.message : 'offline'),
    copy: () => Promise.resolve(true),
    challenge: (friend) => {
      challenged.push(friend.id);
    },
    changed: () => {
      changes += 1;
    },
  });
  document.body.replaceChildren(friends.element);
  return { friends, sent, root: friends.element, challenged, changes: () => changes };
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

describe('the Friends section', () => {
  it('shows the code, adds by what was typed, accepts and declines requests', async () => {
    const { friends, sent, root } = section();
    await friends.open();
    expect(root.hidden).toBe(false);
    expect(root.querySelector('.friends-code-value')?.textContent).toBe('7KQ2-M9XD');
    expect(group(root, 'incoming')).toStrictEqual(['Sam_R', 'Player 4821']);
    // What waits on the player comes first, then the friends with their count.
    expect(
      [...root.querySelectorAll('.friends-group-title')].map((title) => title.textContent),
    ).toStrictEqual(['Waiting for you', 'Friends · 1']);

    const input = root.querySelector<HTMLInputElement>('#friends-add-input');
    if (input === null) throw new Error('No field');
    input.value = '  Jo_99 ';
    root.querySelector<HTMLButtonElement>('.friends-add-button')?.click();
    await until(() => group(root, 'outgoing').length === 1, 'the request sent');
    expect(sent).toContain('POST friends {"to":"Jo_99"}');
    expect(root.querySelector('.friends-said')?.textContent).toBe('Request sent to Jo_99.');
    expect(input.value).toBe('');

    named(root, 'Accept Sam_R')?.click();
    await until(() => group(root, 'friends').includes('Sam_R'), 'Sam_R accepted');
    named(root, 'Decline Player 4821')?.click();
    await until(() => group(root, 'incoming').length === 0, 'the request declined');
    expect(sent).toContain('DELETE friends/r-2');
  });

  it('asks before removing a friend, Keep first, and says a refusal under the field', async () => {
    const { friends, sent, root } = section();
    await friends.open();
    named(root, 'Remove Robin')?.click();
    expect(root.querySelector('[data-friend="f-1"] .friends-name')?.textContent).toBe(
      'Remove Robin?',
    );
    const actions = [...root.querySelectorAll('[data-friend="f-1"] button')].map(
      (button) => button.textContent,
    );
    expect(actions).toStrictEqual(['Keep', 'Remove']);
    expect(sent.filter((line) => line.startsWith('DELETE'))).toStrictEqual([]);
    named(root, 'Remove Robin')?.click();
    await until(() => group(root, 'friends').length === 0, 'Robin removed');

    const input = root.querySelector<HTMLInputElement>('#friends-add-input');
    if (input === null) throw new Error('No field');
    input.value = 'nobody';
    root.querySelector<HTMLButtonElement>('.friends-add-button')?.click();
    await until(() => input.getAttribute('aria-invalid') === 'true', 'the refusal');
    expect(root.querySelector('.friends-said')?.textContent).toBe(
      'No account has that username or friend code',
    );
    expect(input.value).toBe('nobody');
  });

  it('shows each friend’s status in words, takes the inbox’s, and challenges a friend', async () => {
    const { friends, root, challenged, changes } = section();
    await friends.open();
    const status = () => root.querySelector('[data-friend="f-1"] .friends-status');
    expect([status()?.textContent, status()?.getAttribute('data-status')]).toStrictEqual([
      'In a match',
      'in_a_match',
    ]);
    friends.statuses([{ id: 'f-1', name: 'Robin', status: 'online' }]);
    expect(status()?.textContent).toBe('Online');
    named(root, 'Challenge Robin')?.click();
    expect(challenged).toStrictEqual(['f-1']);
    // A change made here tells the inbox to read now.
    named(root, 'Accept Sam_R')?.click();
    await until(() => changes() === 1, 'the inbox poked');
  });

  it('keeps one order, the link card last, the empty state in the friends’ place', async () => {
    /** The parts of the section as they come, by what each is. */
    const order = (root: HTMLElement) =>
      [...root.querySelectorAll('.friends-group, .friends-add-card, .link-card-stand-in')].map(
        (part) =>
          part.classList.contains('link-card-stand-in')
            ? 'link'
            : part.classList.contains('friends-add-card')
              ? 'code and Add'
              : (part as HTMLElement).dataset['group'],
      );
    const withFriends = section({
      ...START,
      outgoing: [{ id: 'o-9', name: 'Kim' }],
    });
    await withFriends.friends.open();
    expect(order(withFriends.root)).toStrictEqual([
      'incoming',
      'friends',
      'code and Add',
      'outgoing',
      'link',
    ]);

    // No friends (ADR 0087, amending ADR 0081 requirement 5): the same order, the empty state in
    // the friends' place, the link card still last.
    const none = section({ ...START, friends: [] });
    await none.friends.open();
    expect(order(none.root)).toStrictEqual(['incoming', 'friends', 'code and Add', 'link']);
    expect(
      none.root.querySelector('.friends-group[data-group="friends"] .friends-empty')?.textContent,
    ).toMatch(/^No friends yet/);
    const nobody = section({
      code: START.code,
      friends: [],
      incoming: [],
      outgoing: [],
      blocked: [],
    });
    await nobody.friends.open();
    expect(order(nobody.root)).toStrictEqual(['friends', 'code and Add', 'link']);
  });
});

describe('More on a row (2026-11-25)', () => {
  it('blocks and reports, each asked in place with Keep first, and unblocks', async () => {
    const { friends, sent, root } = section();
    await friends.open();
    named(root, 'More for Robin')?.click();
    expect(named(root, 'More for Robin')?.getAttribute('aria-expanded')).toBe('true');
    // Keep closes it, back on More, having sent nothing.
    named(root, 'Keep Robin')?.click();
    expect(root.querySelector('.friends-ask')).toBeNull();
    expect(document.activeElement).toBe(named(root, 'More for Robin'));
    named(root, 'More for Robin')?.click();
    named(root, 'Block Robin')?.click();
    expect(root.querySelector('.friends-ask-question')?.textContent).toBe(
      'Block Robin? They can’t add or challenge you again.',
    );
    expect(sent.filter((line) => line.includes('block'))).toStrictEqual([]);
    named(root, 'Block Robin')?.click();
    await until(() => group(root, 'blocked').length === 1, 'the Blocked list');
    expect(sent).toContain('POST friends/f-1/block');
    expect(group(root, 'friends')).toStrictEqual([]);
    expect(root.querySelector('.friends-note')?.textContent).toBe(
      'Robin is blocked. Unblock them under Blocked.',
    );
    // A request's name, reported with a reason in a tap, is hidden from then on.
    named(root, 'More for Sam_R')?.click();
    named(root, 'Report Sam_R’s name')?.click();
    named(root, 'Report Sam_R’s name: Rude or hurtful')?.click();
    await until(() => group(root, 'incoming').includes('Player 7'), 'the name hidden');
    expect(sent).toContain('POST friends/r-1/report {"reason":"offensive"}');
    named(root, 'Unblock Robin')?.click();
    await until(() => group(root, 'blocked').length === 0, 'Robin unblocked');
    expect(sent).toContain('POST friends/f-1/unblock');
  });
});
