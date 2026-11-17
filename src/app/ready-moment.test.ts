import { describe, expect, it } from 'vitest';
import { readyFor } from './ready-moment.ts';

describe('the ready moment', () => {
  it('holds every series round on Fight!, with the card for a pairing new to this device', () => {
    expect(readyFor('series', false)).toStrictEqual({ held: true, card: false });
    expect(readyFor('series', true)).toStrictEqual({ held: true, card: true });
  });

  it('holds Free play only for a new pairing, and never the home demo', () => {
    expect(readyFor('quick', false)).toStrictEqual({ held: false, card: false });
    expect(readyFor('quick', true)).toStrictEqual({ held: true, card: true });
    expect(readyFor('demo', true)).toStrictEqual({ held: false, card: false });
    expect(readyFor('still', true)).toStrictEqual({ held: false, card: false });
  });

  it('shows What to watch in a live round too, during its Get ready and countdown', () => {
    // Held until the server's Fight! either way: the card never makes a live round wait longer.
    expect(readyFor('live', true)).toStrictEqual({ held: true, card: true });
    expect(readyFor('live', false)).toStrictEqual({ held: true, card: false });
  });
});
