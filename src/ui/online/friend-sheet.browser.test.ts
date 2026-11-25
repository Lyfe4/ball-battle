// A friend's sheet (friend-sheet.ts, ADR 0085, 0086): Challenge · live only when it can succeed (the
// friend is online), Take turns where the build plays by turns (any time: the other plays their
// turn later), and the status of a friend waiting on you in their lobby said as "Waiting for you".
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
  it('offers Challenge · live only when they are online, and Take turns any time', () => {
    const turns: string[] = [];
    const { sheet, asked } = sheetWith({ turns: (friend) => turns.push(friend.name) });
    sheet.open(robin('offline'), 'friend');
    expect(button('Challenge Robin live')).toBeNull();
    expect(button('Take turns with Robin')).not.toBeNull();
    button('Take turns with Robin')?.click();
    expect(turns).toStrictEqual(['Robin']);
    expect(sheet.element.open).toBe(false);

    sheet.open(robin('online'), 'friend');
    button('Challenge Robin live')?.click();
    expect(asked).toStrictEqual(['live Robin']);
  });

  it('has no Take turns where the build doesn’t play by turns', () => {
    const { sheet } = sheetWith({});
    sheet.open(robin('online'), 'friend');
    expect(button('Take turns with Robin')).toBeNull();
  });

  it('says “Waiting for you” for a friend waiting on you in their lobby', () => {
    const { sheet } = sheetWith({});
    sheet.open(robin('in_a_match'), 'friend', true);
    const status = sheet.element.querySelector('.friend-sheet-person .friends-status');
    expect(status?.textContent).toBe('Waiting for you');
    expect(status?.getAttribute('data-status')).toBe('waiting');
  });
});
