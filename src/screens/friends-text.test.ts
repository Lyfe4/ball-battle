// The Friends section's words (ADR 0079, PR (c)).
import { describe, expect, it } from 'vitest';
import { addedLine, hasAnyone, inviteLine, STATUS_WORDS } from './friends-text.ts';

const EMPTY = { code: '7KQ2M9XD', friends: [], incoming: [], outgoing: [] };

describe('the Friends section’s words', () => {
  it('says a request was sent, or that you are friends now', () => {
    expect(addedLine({ ...EMPTY, outcome: 'requested', name: 'Sam_R' })).toBe(
      'Request sent to Sam_R.',
    );
    expect(addedLine({ ...EMPTY, outcome: 'friends', name: 'Sam_R' })).toBe(
      'You and Sam_R are friends now.',
    );
  });

  it('knows an empty list from one with a request in it', () => {
    expect(hasAnyone(EMPTY)).toBe(false);
    expect(hasAnyone({ ...EMPTY, outgoing: [{ id: 'x', name: 'Jo' }] })).toBe(true);
  });

  it('names a friend’s challenge and every status in words', () => {
    expect(inviteLine({ token: 't', from: 'Sam_R', format: 'showdown', bestOf: 5 })).toBe(
      'Sam_R challenges you · Best of 5 · Showdown · live',
    );
    expect(Object.values(STATUS_WORDS)).toStrictEqual(['Online', 'In a match', 'Offline']);
  });
});
