import { describe, expect, it } from 'vitest';
import {
  addToDraft,
  completeLineup,
  draftCount,
  draftOf,
  emptySlotText,
  removeFromDraft,
  toggleInDraft,
  type Draft,
} from './lineup-draft.ts';

describe('lineup draft', () => {
  it('fills the next empty slot with each tap', () => {
    const draft = ['storm', 'frost'].reduce<Draft>(addToDraft, []);
    expect(draft).toStrictEqual(['storm', 'frost']);
    expect(addToDraft(draft, 'venom')).toStrictEqual(['storm', 'frost', 'venom']);
  });

  it('never takes a duplicate or a fourth ball', () => {
    expect(addToDraft(['storm'], 'storm')).toStrictEqual(['storm']);
    expect(addToDraft(['storm', 'frost', 'venom'], 'quake')).toStrictEqual([
      'storm',
      'frost',
      'venom',
    ]);
  });

  it('leaves a gap where a ball is taken out, and the next pick fills it', () => {
    const gap = removeFromDraft(['storm', 'frost', 'venom'], 1);
    expect(gap).toStrictEqual(['storm', undefined, 'venom']);
    expect(draftCount(gap)).toBe(2);
    expect(completeLineup(gap)).toBeUndefined();
    // The swap lands in the old ball's slot, so the order set for the rounds is kept.
    expect(addToDraft(gap, 'quake')).toStrictEqual(['storm', 'quake', 'venom']);
  });

  it('fills the first of several gaps first', () => {
    const two = removeFromDraft(removeFromDraft(['storm', 'frost', 'venom'], 0), 1);
    expect(two).toStrictEqual([undefined, undefined, 'venom']);
    expect(addToDraft(two, 'quake')).toStrictEqual(['quake', undefined, 'venom']);
  });

  it('drops empty slots at the end', () => {
    expect(removeFromDraft(['storm', 'frost', 'venom'], 2)).toStrictEqual(['storm', 'frost']);
    expect(removeFromDraft(['storm', undefined, 'venom'], 2)).toStrictEqual(['storm']);
    expect(removeFromDraft(['storm', 'frost'], 5)).toStrictEqual(['storm', 'frost']);
  });

  it('takes a ball out or puts it in with one tap on its tile', () => {
    expect(toggleInDraft(['storm', 'frost', 'venom'], 'frost')).toStrictEqual([
      'storm',
      undefined,
      'venom',
    ]);
    expect(toggleInDraft(['storm', undefined, 'venom'], 'frost')).toStrictEqual([
      'storm',
      'frost',
      'venom',
    ]);
    // A full lineup takes no new ball; taking one out first makes room.
    expect(toggleInDraft(['storm', 'frost', 'venom'], 'quake')).toStrictEqual([
      'storm',
      'frost',
      'venom',
    ]);
  });

  it('restores saved slots in place, without unknown balls or repeats', () => {
    const known = (id: string) => id !== 'nobody';
    expect(draftOf(['storm', undefined, 'venom'], known)).toStrictEqual([
      'storm',
      undefined,
      'venom',
    ]);
    expect(draftOf(['nobody', 'storm', 'storm', 'frost'], known)).toStrictEqual([
      undefined,
      'storm',
    ]);
  });

  it('is complete with three balls only', () => {
    expect(completeLineup(['storm', 'frost'])).toBeUndefined();
    expect(completeLineup(['storm', 'frost', 'venom'])).toStrictEqual(['storm', 'frost', 'venom']);
  });

  it('says which slot an empty one is where the tray sets the order, and not in Reveal', () => {
    expect([0, 1, 2].map((index) => emptySlotText(index, true))).toStrictEqual([
      'Slot 1 · Empty',
      'Slot 2 · Empty',
      'Slot 3 · Empty',
    ]);
    expect(emptySlotText(1, false)).toBe('Empty');
  });
});
