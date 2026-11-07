import { describe, expect, it } from 'vitest';
import { createTips, READY_CARD_STORAGE_KEY, TIPS_STORAGE_KEY, type TipStorage } from './tips.ts';

function memory(): { storage: TipStorage; store: Map<string, string> } {
  const store = new Map<string, string>();
  const storage: TipStorage = () => ({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  });
  return { storage, store };
}

describe('tips', () => {
  it('shows each ball’s hint once, remembered across page loads', () => {
    const { storage } = memory();
    const tips = createTips(storage);
    expect(tips.takeHint('storm')).toBe(true);
    expect(tips.takeHint('storm')).toBe(false);
    expect(tips.takeHint('venom')).toBe(true);
    const later = createTips(storage);
    expect(later.takeHint('storm')).toBe(false);
    expect(later.takeHint('archer')).toBe(true);
  });

  it('shows the what-to-watch card once per pairing, in either order, across page loads', () => {
    const { storage } = memory();
    const tips = createTips(storage);
    expect(tips.takeReady('storm', 'chrono')).toBe(true);
    expect(tips.takeReady('storm', 'chrono')).toBe(false);
    expect(tips.takeReady('chrono', 'storm')).toBe(false);
    expect(tips.takeReady('storm', 'storm')).toBe(true);
    expect(createTips(storage).takeReady('chrono', 'storm')).toBe(false);
    expect(createTips(storage).takeReady('titan', 'venom')).toBe(true);
  });

  it('turns the cards off on their own, keeping the hints, and on again (ADR 0040)', () => {
    const { storage, store } = memory();
    const tips = createTips(storage);
    tips.setReadyCards(false);
    expect(store.get(READY_CARD_STORAGE_KEY)).toBe('off');
    expect(tips.readyCards()).toBe(false);
    expect(tips.takeReady('storm', 'chrono')).toBe(false);
    expect(createTips(storage).readyCards()).toBe(false);
    expect(tips.takeHint('storm')).toBe(true);
    tips.setReadyCards(true);
    expect(createTips(storage).readyCards()).toBe(true);
    expect(tips.takeReady('storm', 'chrono')).toBe(true);
  });

  it('turns the hints off on their own, keeping the cards', () => {
    const { storage } = memory();
    const tips = createTips(storage);
    tips.setEnabled(false);
    expect(createTips(storage).enabled()).toBe(false);
    expect(tips.takeHint('venom')).toBe(false);
    expect(tips.takeReady('storm', 'venom')).toBe(true);
  });

  it('shows everything again after a reset: both switches on, nothing seen', () => {
    const { storage } = memory();
    const tips = createTips(storage);
    tips.takeHint('storm');
    tips.takeReady('storm', 'venom');
    tips.setEnabled(false);
    tips.setReadyCards(false);
    tips.reset();
    expect([tips.enabled(), tips.readyCards()]).toStrictEqual([true, true]);
    expect(tips.takeHint('storm')).toBe(true);
    expect(tips.takeReady('storm', 'venom')).toBe(true);
    const later = createTips(storage);
    expect([later.enabled(), later.readyCards()]).toStrictEqual([true, true]);
  });

  it('keeps the cards off for a device that turned all tips off before they were split', () => {
    const { storage, store } = memory();
    store.set(TIPS_STORAGE_KEY, 'off');
    const tips = createTips(storage);
    expect([tips.enabled(), tips.readyCards()]).toStrictEqual([false, false]);
    expect(store.get(READY_CARD_STORAGE_KEY)).toBe('off');
  });

  it('still shows each hint once per page load when storage throws', () => {
    const broken: TipStorage = () => {
      throw new Error('blocked');
    };
    const tips = createTips(broken);
    expect(tips.enabled()).toBe(true);
    expect(tips.takeHint('storm')).toBe(true);
    expect(tips.takeHint('storm')).toBe(false);
    expect(tips.takeReady('storm', 'venom')).toBe(true);
    expect(tips.takeReady('storm', 'venom')).toBe(false);
    expect(() => {
      tips.setEnabled(false);
    }).not.toThrow();
  });
});
