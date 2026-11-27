// "Who do you want to play?" (ADR 0089 and its addendum of 2026-11-27) in each state: the rules from
// Play's box; friends online first, the friend last picked first; picking a row only selects it and
// one button at the bottom sends, busy on itself while it does, a failure said above it with the
// pick kept; live needs a friend online, else by turns where the build plays by turns; three of the
// rest, then Show all; no friends (the link picked); the list not known yet (sized rows); a friend
// picked from the Friends tab before the inbox has answered. One close.
import { afterEach, describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendEntry } from '../../api/friends.ts';
import { checkOneClose } from '../../flows/look-checks.ts';
import type { WhoPick } from '../../screens/who-text.ts';
import type { InGame } from '../../screens/friends-text.ts';
import { createWhoSheet } from './who-sheet.ts';

const LIVE = { format: 'reveal', bestOf: 3, turns: false } as const;
const friend = (name: string, status: NonNullable<FriendEntry['status']>): FriendEntry => ({
  id: `f-${name}`,
  name,
  status,
});
const SOME = [
  friend('Robin', 'online'),
  friend('Jo', 'online'),
  friend('Mina', 'in_a_match'),
  friend('Lukasz', 'offline'),
  friend('Priya', 'offline'),
];

/**
 * The sheet with a send that answers `answer` (a failure line, or moving on) when let go; `game`,
 * the live game the player is in (Back to it answers `stillThere`).
 */
function mount(turns = true, state: { game?: InGame; stillThere?: boolean } = {}) {
  const sent: string[] = [];
  let finish: ((line: string | undefined) => void) | undefined;
  const sheet = createWhoSheet({
    turns,
    send: (pick: WhoPick, _setup, moving) => {
      sent.push(pick.kind === 'link' ? 'link' : `${pick.how} ${pick.friend.name}`);
      return new Promise((resolve) => {
        finish = (line) => {
          if (line === undefined) moving();
          resolve(line);
        };
      });
    },
    addFriend: () => sent.push('add'),
    inGame: () => state.game,
    backToGame: () => {
      sent.push('back');
      if (state.stillThere === false) delete state.game;
      return Promise.resolve(state.stillThere !== false);
    },
  });
  const answer = async (line?: string) => {
    finish?.(line);
    // The busy button lets go once the request settles.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { sheet, sent, answer };
}

const dialog = () => document.querySelector<HTMLDialogElement>('dialog.who-sheet');
const shown = (selector: string) =>
  [...(dialog()?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(
    (node) => node.closest('[hidden]') === null && node.getClientRects().length > 0,
  );
const texts = (selector: string) => shown(selector).map((node) => node.textContent.trim());
const row = (name: string) => {
  const found = shown('.who-row').find(
    (node) => node.querySelector('.friends-name')?.textContent === name,
  );
  if (found === undefined) throw new Error(`No row for ${name}`);
  return found;
};
const sendButton = () => {
  const found = dialog()?.querySelector<HTMLButtonElement>('.who-sheet-send');
  if (found == null) throw new Error('No send button');
  return found;
};
const checked = () =>
  shown('.who-row[aria-checked="true"] .friends-name').map((node) => node.textContent);

afterEach(() => {
  dialog()?.close();
  dialog()?.remove();
});

describe('Who do you want to play? (ADR 0089 addendum of 2026-11-27)', () => {
  it('lists the rules, friends online first, the last picked first, then the link', () => {
    const { sheet } = mount();
    sheet.open(SOME, LIVE, undefined, 'f-Jo');
    expect(dialog()?.open).toBe(true);
    expect(texts('.who-sheet-rules')).toStrictEqual(['Live · Best of 3 · Reveal']);
    expect(texts('.friends-group-title')).toStrictEqual(['Online · 2', 'Not online']);
    expect(texts('.friends-name')).toStrictEqual([
      'Jo',
      'Robin',
      'Mina',
      'Lukasz',
      'Priya',
      'Send a link instead',
    ]);
    expect(texts('.friends-status')).toStrictEqual([
      'Online · live',
      'Online · live',
      'In a match · by turns instead',
      'Not online · by turns instead',
      'Not online · by turns instead',
      'Anyone with it can join',
    ]);
    checkOneClose('Who do you want to play?', dialog());
  });

  it('only selects on a tap: nothing is sent before the one button', async () => {
    const { sheet, sent, answer } = mount();
    sheet.open(SOME, LIVE);
    // Nothing picked: the button says what to do, and does nothing.
    expect(sendButton().textContent).toBe('Choose who to play');
    expect(sendButton().getAttribute('aria-disabled')).toBe('true');
    sendButton().click();
    expect(sent).toStrictEqual([]);
    // A tap on a row selects it; another tap moves the pick. Still nothing sent.
    row('Robin').click();
    expect(checked()).toStrictEqual(['Robin']);
    expect(sendButton().textContent).toBe('Challenge Robin');
    row('Lukasz').click();
    expect(checked()).toStrictEqual(['Lukasz']);
    expect(sendButton().textContent).toBe('Play Lukasz by turns');
    row('Send a link instead').click();
    expect(sendButton().textContent).toBe('Send a link');
    expect(sent).toStrictEqual([]);
    expect(dialog()?.open).toBe(true);
    // The button sends what is picked, and is busy on itself until the answer.
    row('Robin').click();
    sendButton().click();
    expect(sent).toStrictEqual(['live Robin']);
    expect(sendButton().getAttribute('aria-busy')).toBe('true');
    // A second tap while it sends sends nothing more.
    sendButton().click();
    expect(sent).toStrictEqual(['live Robin']);
    await answer();
    expect(dialog()?.open).toBe(false);
  });

  it('keeps its rows through an inbox read that changes nothing, so a tap in it lands', () => {
    const { sheet } = mount();
    sheet.open(SOME, LIVE);
    const robin = () =>
      [...document.querySelectorAll<HTMLElement>('.who-row')].find((row) =>
        row.textContent.includes('Robin'),
      );
    const before = robin();
    // A press on Robin, then the inbox answers the same, then the release: one row throughout.
    before?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    sheet.update([...SOME]);
    expect(robin()).toBe(before);
    before?.click();
    expect(before?.getAttribute('aria-checked')).toBe('true');
    // A read that does change something redraws, keeping the pick.
    sheet.update(SOME.map((one) => (one.name === 'Robin' ? { ...one, status: 'offline' } : one)));
    expect(robin()).not.toBe(before);
    expect(robin()?.getAttribute('aria-checked')).toBe('true');
  });

  it('says a failure above the button, keeps the pick, and sends again on Try', async () => {
    const { sheet, sent, answer } = mount();
    sheet.open(SOME, LIVE);
    row('Jo').click();
    sendButton().click();
    await answer('You’re offline. Online play needs a connection.');
    expect(dialog()?.open).toBe(true);
    expect(texts('.who-sheet-failure')).toStrictEqual([
      'You’re offline. Online play needs a connection.',
    ]);
    expect(dialog()?.querySelector('.who-sheet-failure')?.getAttribute('role')).toBe('alert');
    expect(checked()).toStrictEqual(['Jo']);
    expect(sendButton().hasAttribute('aria-busy')).toBe(false);
    sendButton().click();
    expect(sent).toStrictEqual(['live Jo', 'live Jo']);
    await answer();
    expect(dialog()?.open).toBe(false);
  });

  it('can’t pick a friend nothing can start with where there is no play by turns', () => {
    const { sheet, sent } = mount(false);
    sheet.open(SOME, LIVE);
    expect(row('Mina').getAttribute('aria-disabled')).toBe('true');
    expect(texts('.friends-status').slice(2, 4)).toStrictEqual([
      'In a match · try again after it',
      'Not online',
    ]);
    row('Mina').click();
    expect(checked()).toStrictEqual([]);
    sendButton().click();
    expect(sent).toStrictEqual([]);
  });

  it('picks a friend waiting for you live: sending accepts theirs (crossed)', () => {
    const { sheet } = mount(false);
    sheet.open(SOME, LIVE);
    sheet.update(SOME, new Set(['f-Mina']));
    expect(row('Mina').getAttribute('aria-disabled')).toBeNull();
    expect(row('Mina').querySelector('.friends-status')?.textContent).toBe(
      'Waiting for you · live',
    );
    row('Mina').click();
    expect(sendButton().textContent).toBe('Accept Mina’s challenge');
  });

  it('plays everyone by turns when the box says By turns', () => {
    const { sheet } = mount();
    sheet.open(SOME, { ...LIVE, turns: true });
    expect(texts('.who-sheet-rules')).toStrictEqual(['By turns · Best of 3 · Reveal']);
    row('Robin').click();
    expect(sendButton().textContent).toBe('Play Robin by turns');
  });

  it('shows three of the rest, then all of them on Show all', () => {
    const { sheet } = mount();
    const many = [
      friend('Robin', 'online'),
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((name) => friend(name, 'offline')),
    ];
    sheet.open(many, LIVE);
    expect(texts('.friends-name').slice(0, -1)).toStrictEqual(['Robin', 'A', 'B', 'C']);
    const more = shown('.who-sheet-all')[0];
    expect(more?.textContent).toBe('Show all 7 friends');
    more?.click();
    expect(texts('.friends-name').slice(0, -1)).toHaveLength(7);
    expect(shown('.who-sheet-all')).toHaveLength(0);
  });

  it('picks the link with no friends, and Add a friend goes to Friends', () => {
    const { sheet, sent } = mount();
    sheet.open([], LIVE);
    expect(texts('.friends-card-text')).toStrictEqual([
      'No friends yet. Add one by username or code, or send anyone a link.',
    ]);
    expect(checked()).toStrictEqual(['Send a link instead']);
    expect(sendButton().textContent).toBe('Send a link');
    shown('.who-sheet-add')[0]?.click();
    expect(sent).toStrictEqual(['add']);
  });

  it('holds the rows’ place until the inbox says who, and keeps a friend picked for it', () => {
    const { sheet } = mount();
    // A friend's Challenge on the Friends tab before the inbox has answered.
    sheet.open(undefined, LIVE, { friend: 'f-Jo' });
    expect(dialog()?.querySelectorAll('.friends-skeleton-row').length).toBeGreaterThan(0);
    expect(sendButton().textContent).toBe('Choose who to play');
    sheet.update(SOME);
    expect(checked()).toStrictEqual(['Jo']);
    expect(sendButton().textContent).toBe('Challenge Jo');
    // Jo goes offline meanwhile: by turns now, said on the button.
    sheet.update(SOME.map((one) => (one.name === 'Jo' ? { ...one, status: 'offline' } : one)));
    expect(sendButton().textContent).toBe('Play Jo by turns');
  });

  it('offers no challenge while the player is in a game: one line and Back to it', async () => {
    const { sheet, sent, answer } = mount(true, { game: { name: 'Robin' } });
    const withRobin = [friend('Robin', 'with_you'), ...SOME.slice(1)];
    sheet.open(withRobin, LIVE, { friend: 'f-Jo' });
    expect(texts('.who-sheet-in-game')).toStrictEqual(['You’re in a game with Robin']);
    expect(shown('.who-row')).toStrictEqual([]);
    expect(shown('.who-sheet-rules')).toStrictEqual([]);
    expect(sendButton().textContent).toBe('Back to it');
    sendButton().click();
    await answer();
    expect(sent).toStrictEqual(['back']);
    expect(dialog()?.open).toBe(false);
  });

  it('shows the friends again when the game was over by the time Back to it asked', async () => {
    const { sheet, sent, answer } = mount(true, { game: {}, stillThere: false });
    sheet.open(SOME, LIVE);
    expect(texts('.who-sheet-in-game')).toStrictEqual(['You’re in a game']);
    sendButton().click();
    await answer();
    expect(sent).toStrictEqual(['back']);
    expect(dialog()?.open).toBe(true);
    expect(shown('.who-row').length).toBeGreaterThan(0);
    expect(sendButton().textContent).toBe('Choose who to play');
  });
});
