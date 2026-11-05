import { describe, expect, it } from 'vitest';
import { addToDraft, completeLineup, removeFromDraft } from './lineup-draft.ts';

describe('lineup draft', () => {
  it('fills the next empty slot with each tap', () => {
    const draft = ['storm', 'frost'].reduce<readonly string[]>(addToDraft, []);
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

  it('removes a slot and keeps the order of the rest', () => {
    expect(removeFromDraft(['storm', 'frost', 'venom'], 0)).toStrictEqual(['frost', 'venom']);
    expect(removeFromDraft(['storm', 'frost'], 5)).toStrictEqual(['storm', 'frost']);
  });

  it('is complete with three balls only', () => {
    expect(completeLineup(['storm', 'frost'])).toBeUndefined();
    expect(completeLineup(['storm', 'frost', 'venom'])).toStrictEqual(['storm', 'frost', 'venom']);
  });
});
