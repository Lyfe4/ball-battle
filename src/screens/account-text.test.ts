import { describe, expect, it } from 'vitest';
import type { NoticeField } from '../ui/notice-content.ts';
import { deleteCard, usernameCard } from './account-text.ts';

const none = () => undefined;
const field: NoticeField = { kind: 'username', label: 'Username', onInput: none };
const save = () => Promise.resolve();

describe('the account’s cards (ADR 0079)', () => {
  it('each has a way on (ADR 0027), and a username can always be skipped', () => {
    const cards = [
      usernameCard({ current: null, field, save, skip: none }),
      usernameCard({ current: 'sam', field, save, skip: none }),
    ];
    for (const card of cards) {
      expect(card.buttons.length, card.title).toBeGreaterThan(0);
      expect(card.quiet, card.title).toBeDefined();
    }
    expect(usernameCard({ current: null, field, save, skip: none }).quiet?.text).toBe(
      'Skip for now',
    );
  });

  it('says the rule plainly, and the once-a-month change', () => {
    const card = usernameCard({ current: 'sam', field, save, skip: none });
    expect(card.title).toBe('Change your username');
    expect(card.body[1]).toBe(
      'Letters a–z, numbers and _ only, 3–15 characters. You can change it once a month.',
    );
  });
});

describe('Delete account and Forget me (ADR 0079; Profile holds them, ADR 0081)', () => {
  const logOut = () => Promise.resolve();

  it('asks once before deleting, Keep first, and says why a try failed', () => {
    const account = deleteCard(true, logOut, none);
    expect(account.title).toBe('Delete your account?');
    expect(account.buttons.map((button) => button.text)).toStrictEqual(['Keep', 'Delete']);
    const guest = deleteCard(false, logOut, none, 'You’re offline');
    expect(guest.title).toBe('Delete your guest?');
    expect(guest.body[0]).toBe('You’re offline');
  });
});
