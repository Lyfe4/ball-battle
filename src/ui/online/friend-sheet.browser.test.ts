// A friend's sheet (friend-sheet.ts, ADR 0085, 0086): Challenge · live always, unavailable with one
// line on why when the friend can't take it (ADR 0086 as changed 2026-11-26), Play by turns where the
// build plays by turns (any time: the other plays their turn later), and the status of a friend
// waiting on you in their lobby said as "Waiting for you"; the head-to-head under a friend's name
// (ADR 0088).
import { afterEach, describe, expect, it } from 'vitest';
import '../../style.css';
import type { FriendEntry } from '../../api/friends.ts';
import { createFriendSheet, type FriendSheetHost } from './friend-sheet.ts';

const done = () => Promise.resolve(true);

function sheetWith(also: Partial<FriendSheetHost>) {
  const asked: string[] = [];
  const sheet = createFriendSheet({
    remove: done,
    block: done,
    report: done,
    accept: done,
    decline: done,
    unblock: done,
    said: () => undefined,
    challenge: (friend) => asked.push(`live ${friend.name}`),
    ...also,
  });
  document.body.replaceChildren(sheet.element);
  return { sheet, asked };
}

const button = (label: string) =>
  document.querySelector<HTMLButtonElement>(`dialog button[aria-label="${label}"]`);

afterEach(() => {
  document.querySelector('dialog')?.close();
});

const robin = (status: NonNullable<FriendEntry['status']>): FriendEntry => ({
  id: 'f-1',
  name: 'Robin',
  status,
});

describe('a friend’s sheet', () => {
  it('always shows Challenge · live, unavailable with why when they can’t take it', () => {
    const turns: string[] = [];
    const { sheet, asked } = sheetWith({ turns: (friend) => turns.push(friend.name) });
    sheet.open(robin('offline'), 'friend');
    const live = button('Challenge Robin live');
    if (live === null) throw new Error('No Challenge · live');
    // Unavailable, never disabled: it keeps its place in the tab order and says why.
    expect(live.disabled).toBe(false);
    expect(live.getAttribute('aria-disabled')).toBe('true');
    live.focus();
    expect(document.activeElement).toBe(live);
    const why = document.getElementById(live.getAttribute('aria-describedby') ?? '');
    expect(why?.textContent).toBe('Robin is offline · Play by turns instead');
    expect(why?.previousElementSibling).toBe(live);
    live.click();
    expect(asked).toStrictEqual([]);
    expect(sheet.element.open).toBe(true);
    // The way that works is the one primary.
    expect(live.classList.contains('hud-button-primary')).toBe(false);
    const take = button('Play by turns with Robin');
    expect(take?.classList.contains('hud-button-primary')).toBe(true);
    take?.click();
    expect(turns).toStrictEqual(['Robin']);
    expect(sheet.element.open).toBe(false);

    sheet.open(robin('online'), 'friend');
    expect(button('Challenge Robin live')?.hasAttribute('aria-disabled')).toBe(false);
    expect(button('Challenge Robin live')?.classList.contains('hud-button-primary')).toBe(true);
    expect(button('Play by turns with Robin')?.classList.contains('hud-button-primary')).toBe(
      false,
    );
    expect(sheet.element.querySelector('#friend-sheet-why')).toBeNull();
    button('Challenge Robin live')?.click();
    expect(asked).toStrictEqual(['live Robin']);
  });

  it('keeps one shape: the same parts in the same order online, offline and in a match', () => {
    const { sheet } = sheetWith({ turns: () => undefined });
    const shape = (status: NonNullable<FriendEntry['status']>) => {
      sheet.open(robin(status), 'friend');
      return [...sheet.element.querySelectorAll('.friend-sheet-actions > button')].map((part) =>
        part.getAttribute('aria-label'),
      );
    };
    expect(shape('offline')).toStrictEqual(shape('online'));
    expect(shape('in_a_match')).toStrictEqual(shape('online'));
  });

  it('says a friend in a match can’t take it, and to wait where there are no turns', () => {
    const { sheet } = sheetWith({});
    sheet.open(robin('in_a_match'), 'friend');
    expect(button('Challenge Robin live')?.getAttribute('aria-disabled')).toBe('true');
    expect(sheet.element.querySelector('#friend-sheet-why')?.textContent).toBe(
      'Robin is in a match · Try again after it',
    );
  });

  it('has no Play by turns where the build doesn’t play by turns', () => {
    const { sheet } = sheetWith({});
    sheet.open(robin('online'), 'friend');
    expect(button('Play by turns with Robin')).toBeNull();
  });

  it('says “Waiting for you” for a friend waiting on you in their lobby', () => {
    const { sheet } = sheetWith({});
    sheet.open(robin('in_a_match'), 'friend', true);
    const status = sheet.element.querySelector('.friend-sheet-person .friends-status');
    expect(status?.textContent).toBe('Waiting for you');
    expect(status?.getAttribute('data-status')).toBe('waiting');
    expect(sheet.element.querySelector('#friend-sheet-why')?.textContent).toBe(
      'Robin is waiting for you · Accept in Waiting for you',
    );
  });
});

describe('a friend’s head-to-head (ADR 0088)', () => {
  const line = () => document.querySelector('dialog .friend-sheet-record');

  it('shows "You 3 – 2 Robin" under the name, in words for a screen reader', () => {
    const { sheet } = sheetWith({});
    sheet.open({ ...robin('online'), record: { wins: 3, losses: 2 } }, 'friend');
    const record = line();
    expect(record?.querySelector('[aria-hidden="true"]')?.textContent).toBe('You 3 – 2 Robin');
    expect(record?.querySelector('.visually-hidden')?.textContent).toBe(
      'Your record with Robin: you won 3, Robin won 2',
    );
    // Under the status line, in the head beside the disc.
    expect(record?.previousElementSibling?.classList.contains('friend-sheet-who')).toBe(true);
    expect(record instanceof HTMLElement && record.getClientRects().length > 0).toBe(true);
  });

  it('shows nothing where they never played, nor for a request', () => {
    const { sheet } = sheetWith({});
    sheet.open(robin('online'), 'friend');
    expect(line()).toBeNull();
    sheet.element.close();
    sheet.open({ id: 'r-1', name: 'Sam', record: { wins: 1, losses: 0 } }, 'incoming');
    expect(line()).toBeNull();
  });
});
