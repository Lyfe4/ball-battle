import { describe, expect, it } from 'vitest';
import type { NoticeField } from '../ui/notice-content.ts';
import { signedInCard, usernameCard } from './account-text.ts';

const none = () => undefined;
const field: NoticeField = { kind: 'username', label: 'Username', onInput: none };
const save = () => Promise.resolve();

describe('the account’s cards (ADR 0079)', () => {
  it('each has a way on (ADR 0027), and a username can always be skipped', () => {
    const cards = [
      signedInCard(null, none, none),
      signedInCard('sam', none, none),
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

  it('says what opponents see, and offers the username', () => {
    const named = signedInCard('sam_99', none, none);
    expect(named.body[0]).toBe('Opponents see you as sam_99.');
    expect(named.quiet?.text).toBe('Change username');
    expect(signedInCard(null, none, none).quiet?.text).toBe('Choose a username');
  });

  it('says the rule plainly, and the once-a-month change', () => {
    const card = usernameCard({ current: 'sam', field, save, skip: none });
    expect(card.title).toBe('Change your username');
    expect(card.body[1]).toBe(
      'Letters a–z, numbers and _ only, 3–15 characters. You can change it once a month.',
    );
  });
});
