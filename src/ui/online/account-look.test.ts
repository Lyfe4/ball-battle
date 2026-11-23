import { describe, expect, it } from 'vitest';
import { accountLook, initialOf } from './account-look.ts';

describe('the avatar (ADR 0081)', () => {
  it('shows an account by its initial, and names it as the way to Profile', () => {
    expect(accountLook({ kind: 'account', username: 'sam_r' })).toStrictEqual({
      look: 'initial',
      text: 'S',
      label: 'Profile, sam_r',
    });
    expect(initialOf('_9lives')).toBe('9');
    expect(initialOf('___')).toBe('?');
  });

  it('takes the first whole character, never half of one', () => {
    expect(initialOf('łukasz')).toBe('Ł');
    expect(initialOf('Émile')).toBe('É');
    // A family emoji is one grapheme of several code points.
    expect(initialOf('👨‍👩‍👧 crew')).toBe('👨‍👩‍👧');
    expect(initialOf('éclair')).toBe('É');
  });

  it('shows a guest or nobody the plain face: Profile holds Sign in', () => {
    for (const kind of ['guest', 'none'] as const) {
      expect(accountLook({ kind })).toStrictEqual({ look: 'face', text: '', label: 'Profile' });
    }
  });

  it('claims nothing while it can’t know: never Sign in to a player who may be signed in', () => {
    expect(accountLook({ kind: 'unknown' })).toStrictEqual({
      look: 'face',
      text: '',
      label: 'Profile',
    });
    expect(accountLook({ kind: 'account', username: null }).look).toBe('face');
  });
});
