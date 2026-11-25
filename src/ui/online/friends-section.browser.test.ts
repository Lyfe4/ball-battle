// The Friends tab's lists (ADR 0079, PR (c); ADR 0081) over a fake API: the code shown with a
// dash, a friend added by what was typed, a request accepted and one declined, a friend removed
// only after Remove is asked in place (Keep first), a refusal said under the field, and the
// sections in one order: Waiting for you, Friends (or the empty state), your code and Add, then the
// link card, always last (ADR 0087); the inbox's rows at once, skeleton rows after 150 ms, one
// failure card; More's Block and Report name, each
// and the person's sheet (ADR 0086): Remove and Block confirmed, Report with a reason, Unblock.
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

  it('opens a friend’s sheet from the row, confirms Remove (Cancel first), says a refusal', async () => {
    const { friends, sent, root } = section();
    await friends.open();
    // The row: one inline action where it can succeed (Robin is in a match: none), no Remove.
    expect(named(root, 'Remove Robin')).toBeNull();
    expect(named(root, 'Challenge Robin')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-friend="f-1"] .friends-open')?.click();
    const sheet = root.querySelector('dialog.friend-sheet');
    if (!(sheet instanceof HTMLDialogElement)) throw new Error('No sheet');
    expect(sheet.open).toBe(true);
    expect(sheet.querySelector('.sheet-title')?.textContent).toBe('Robin');
    named(root, 'Remove Robin')?.click();
    expect(sheet.querySelector('.sheet-title')?.textContent).toBe('Remove Robin?');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(sent.filter((line) => line.startsWith('DELETE'))).toStrictEqual([]);
    (document.activeElement as HTMLButtonElement).click();
    expect(sheet.querySelector('.sheet-title')?.textContent).toBe('Robin');
    named(root, 'Remove Robin')?.click();
    sheet.querySelector<HTMLButtonElement>('.sheet-confirm-action')?.click();
    await until(() => group(root, 'friends').length === 0, 'Robin removed');
    expect(sheet.open).toBe(false);
    expect(root.querySelector('.friends-note')?.textContent).toBe(
      'Robin is no longer your friend.',
    );

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

describe('the person’s sheet (ADR 0086)', () => {
  it('blocks (confirmed), reports with a reason and Also block, cancels a request and unblocks', async () => {
    const { friends, sent, root } = section({ ...START, outgoing: [{ id: 'o-2', name: 'Kim' }] });
    await friends.open();
    const sheet = () => root.querySelector<HTMLDialogElement>('dialog.friend-sheet');
    const openRow = (id: string) => {
      root.querySelector<HTMLButtonElement>(`[data-friend="${id}"] .friends-open`)?.click();
    };
    // Block, apart in the danger look, confirmed with what it does; Cancel first.
    openRow('f-1');
    const block = named(root, 'Block Robin');
    expect(block?.classList.contains('danger-row')).toBe(true);
    block?.click();
    expect(sheet()?.textContent).toContain('can’t add or challenge you');
    expect(document.activeElement?.textContent).toBe('Cancel');
    sheet()?.querySelector<HTMLButtonElement>('.sheet-confirm-action')?.click();
    await until(() => group(root, 'blocked').length === 1, 'the Blocked list');
    expect(sent).toContain('POST friends/f-1/block');
    expect(root.querySelector('.friends-note')?.textContent).toBe(
      'Robin is blocked. Unblock them under Blocked.',
    );
    // A request's name, reported with a reason, Also block ticked: both sent.
    openRow('r-1');
    named(root, 'Report Sam_R’s name')?.click();
    const reasons = [...(sheet()?.querySelectorAll('[role="radio"]') ?? [])];
    expect(reasons.map((reason) => reason.textContent)).toStrictEqual([
      'Rude or hurtful',
      'Pretends to be someone',
      'Something else',
    ]);
    (reasons[0] as HTMLButtonElement).click();
    const also = sheet()?.querySelector<HTMLInputElement>('.friend-sheet-also-box');
    if (also === null || also === undefined) throw new Error('No Also block');
    also.checked = true;
    sheet()?.querySelector<HTMLButtonElement>('.danger-button')?.click();
    await until(() => sent.includes('POST friends/r-1/block'), 'the block after the report');
    expect(sent).toContain('POST friends/r-1/report {"reason":"offensive"}');
    // A request you sent: Cancel request, from its sheet.
    openRow('o-2');
    named(root, 'Cancel your request to Kim')?.click();
    await until(() => group(root, 'outgoing').length === 0, 'the request cancelled');
    // Blocked: Unblock, from their sheet.
    openRow('f-1');
    named(root, 'Unblock Robin')?.click();
    await until(() => group(root, 'blocked').every((name) => name !== 'Robin'), 'Robin unblocked');
    expect(sent).toContain('POST friends/f-1/unblock');
  });
});
