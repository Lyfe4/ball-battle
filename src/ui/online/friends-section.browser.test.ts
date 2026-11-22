// The account screen's Friends section (ADR 0079, PR (c)) over a fake API: the code shown with a
// dash, a friend added by what was typed, a request accepted and one declined, a friend removed
// only after Remove is asked in place (Keep first), and a refusal said under the field.
import { describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendsResponse } from '../../api/friends.ts';
import { callApi, type ApiFailure } from '../../app/api.ts';
import { createFriendsSection } from './friends-section.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const START: FriendsResponse = {
  code: '7KQ2M9XD',
  friends: [{ id: 'f-1', name: 'Robin', status: 'in_a_match' }],
  incoming: [
    { id: 'r-1', name: 'Sam_R' },
    { id: 'r-2', name: 'Player 4821' },
  ],
  outgoing: [],
};

/** The section over an API that keeps a list and answers each change with it. */
function section() {
  let list: FriendsResponse = START;
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
  const friends = createFriendsSection({
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
    // Requests come first: they wait on the player.
    expect(
      [...root.querySelectorAll('.friends-group-title')].map((title) => title.textContent),
    ).toStrictEqual(['Requests', 'Your friends']);

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
});
