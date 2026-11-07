import { describe, expect, it } from 'vitest';
import { createTips, READY_CARD_STORAGE_KEY, type TipStorage } from './tips.ts';

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

  it('turns the card off on its own, keeping the hints, until tips are reset', () => {
    const { storage, store } = memory();
    const tips = createTips(storage);
    tips.hideReadyCards();
    expect(store.get(READY_CARD_STORAGE_KEY)).toBe('off');
    expect(tips.takeReady('storm', 'chrono')).toBe(false);
    expect(createTips(storage).takeReady('storm', 'chrono')).toBe(false);
    expect(tips.takeHint('storm')).toBe(true);
    tips.reset();
    expect(tips.takeReady('storm', 'chrono')).toBe(true);
  });

  it('shows nothing when turned off, and everything again after a reset', () => {
    const { storage } = memory();
    const tips = createTips(storage);
    tips.takeHint('storm');
    tips.setEnabled(false);
    expect(createTips(storage).enabled()).toBe(false);
    expect(tips.takeHint('venom')).toBe(false);
    expect(tips.takeReady('storm', 'venom')).toBe(false);
    tips.reset();
    expect(tips.enabled()).toBe(true);
    expect(tips.takeHint('storm')).toBe(true);
    expect(tips.takeReady('storm', 'venom')).toBe(true);
    expect(createTips(storage).enabled()).toBe(true);
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
