import { describe, expect, it } from 'vitest';
import { accountLook, initialOf } from './account-look.ts';

describe('the account entry on home', () => {
  it('shows an account by its initial, and names it', () => {
    expect(accountLook({ kind: 'account', username: 'sam_r' })).toStrictEqual({
      look: 'initial',
      text: 'S',
      label: 'Your account, sam_r',
    });
    expect(initialOf('_9lives')).toBe('9');
    expect(initialOf('___')).toBe('?');
  });

  it('offers Sign in to a guest or nobody', () => {
    for (const kind of ['guest', 'none'] as const) {
      expect(accountLook({ kind })).toStrictEqual({
        look: 'sign-in',
        text: 'Sign in',
        label: 'Sign in',
      });
    }
  });

  it('claims nothing while it can’t know: never Sign in to a player who may be signed in', () => {
    expect(accountLook({ kind: 'unknown' })).toStrictEqual({
      look: 'face',
      text: '',
      label: 'Your account',
    });
    expect(accountLook({ kind: 'account', username: null }).look).toBe('face');
  });
});
