// "Who do you want to play?" (ADR 0089, B1) in each state: friends online first with Challenge,
// the rest with Play by turns (three, then Show all), Anyone with a link last; nobody online; no
// friends (the link the main button); the list not known yet (sized rows); a build without play by
// turns (nothing to start with a friend who isn't online). One close; each choice closes it first.
import { afterEach, describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendEntry } from '../../api/friends.ts';
import { checkOneClose } from '../../flows/look-checks.ts';
import { createWhoSheet } from './who-sheet.ts';

const SETUP = { format: 'reveal', bestOf: 3 } as const;
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

function mount(turns = true) {
  const done: string[] = [];
  const sheet = createWhoSheet({
    challenge: (one) => done.push(`challenge ${one.name}`),
    turns: turns ? (one) => done.push(`turns ${one.name}`) : undefined,
    anyone: () => done.push('anyone'),
    addFriend: () => done.push('add'),
  });
  return { sheet, done };
}

const dialog = () => document.querySelector<HTMLDialogElement>('dialog.who-sheet');
const shown = (selector: string) =>
  [...(dialog()?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(
    (node) => node.closest('[hidden]') === null && node.getClientRects().length > 0,
  );
const texts = (selector: string) => shown(selector).map((node) => node.textContent.trim());
const button = (name: string) => {
  const found = shown('button').find((node) => node.textContent.trim() === name);
  if (found === undefined) throw new Error(`No ${name}`);
  return found;
};

afterEach(() => {
  dialog()?.close();
  dialog()?.remove();
});

describe('Who do you want to play? (ADR 0089)', () => {
  it('lists friends online first with Challenge, the rest with Play by turns, then anyone', () => {
    const { sheet, done } = mount();
    sheet.open(SOME, SETUP);
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.querySelector('.sheet-title')?.textContent).toBe('Who do you want to play?');
    expect(texts('.friends-group-title')).toStrictEqual(['Online · 2', 'Not online']);
    expect(texts('.who-sheet-line')).toStrictEqual(['Live now, Best of 3 · Reveal.']);
    expect(texts('.friends-name')).toStrictEqual(['Robin', 'Jo', 'Mina', 'Lukasz', 'Priya']);
    expect(texts('.friends-actions button')).toStrictEqual([
      'Challenge',
      'Challenge',
      'Play by turns',
      'Play by turns',
      'Play by turns',
    ]);
    expect(texts('.sheet-row')).toStrictEqual(['Anyone, with a link']);
    checkOneClose('Who do you want to play?', dialog());
    // Each choice closes the sheet, then starts.
    shown('.friends-actions button')[0]?.click();
    expect(dialog()?.open).toBe(false);
    sheet.open(SOME, SETUP);
    shown('.friends-actions button')[3]?.click();
    sheet.open(SOME, SETUP);
    // The whole row picks as its button does.
    shown('.friends-open')[1]?.click();
    sheet.open(SOME, SETUP);
    button('Anyone, with a link').click();
    expect(done).toStrictEqual(['challenge Robin', 'turns Lukasz', 'challenge Jo', 'anyone']);
  });

  it('shows three of the rest, then all of them on Show all', () => {
    const { sheet } = mount();
    const many = [
      friend('Robin', 'online'),
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((name) => friend(name, 'offline')),
    ];
    sheet.open(many, SETUP);
    expect(texts('.friends-name')).toStrictEqual(['Robin', 'A', 'B', 'C']);
    button('Show all 7 friends').click();
    expect(texts('.friends-name')).toStrictEqual(['Robin', 'A', 'B', 'C', 'D', 'E', 'F']);
    expect(shown('.who-sheet-all')).toHaveLength(0);
    // Opened again: three again.
    sheet.open(many, SETUP);
    expect(texts('.friends-name')).toHaveLength(4);
  });

  it('says so when nobody is online, and offers by turns', () => {
    const { sheet } = mount();
    sheet.open([friend('Mina', 'in_a_match'), friend('Jo', 'offline')], SETUP);
    expect(texts('.who-sheet-line')).toStrictEqual([
      'None of your friends is online. Play by turns: they play when they’re back.',
    ]);
    expect(texts('.friends-group-title')).toStrictEqual(['Friends · 2']);
    expect(texts('.friends-actions button')).toStrictEqual(['Play by turns', 'Play by turns']);
  });

  it('makes the link the main button with no friends, and Add a friend goes to Friends', () => {
    const { sheet, done } = mount();
    sheet.open([], SETUP);
    expect(texts('.friends-card-text')).toStrictEqual([
      'No friends yet. Add one by username or code, or send anyone a link.',
    ]);
    expect(texts('.hud-button-primary')).toStrictEqual(['Send a link to anyone']);
    expect(shown('.sheet-row')).toHaveLength(0);
    button('Add a friend').click();
    expect(done).toStrictEqual(['add']);
  });

  it('holds the rows’ place until the inbox says who, then draws them', () => {
    const { sheet } = mount();
    sheet.open(undefined, SETUP);
    expect(dialog()?.querySelectorAll('.friends-skeleton-row').length).toBeGreaterThan(0);
    expect(texts('.sheet-row')).toStrictEqual(['Anyone, with a link']);
    sheet.update(SOME);
    expect(texts('.friends-name')).toHaveLength(5);
  });

  it('starts nothing with a friend away where the build has no play by turns', () => {
    const { sheet, done } = mount(false);
    sheet.open(SOME, SETUP);
    expect(texts('.friends-actions button')).toStrictEqual(['Challenge', 'Challenge']);
    const away = shown('.friends-open')[2];
    expect(away?.hasAttribute('disabled')).toBe(true);
    away?.click();
    expect(done).toStrictEqual([]);
    expect(dialog()?.open).toBe(true);
  });
});
