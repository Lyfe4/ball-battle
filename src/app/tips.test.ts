import { describe, expect, it } from 'vitest';
import { createTips, VERSUS_MATCHES, type TipStorage } from './tips.ts';

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

  it('shows the versus card for the first few matches only', () => {
    const tips = createTips(memory().storage);
    const shown = Array.from({ length: VERSUS_MATCHES + 2 }, () => tips.takeVersus());
    expect(shown.filter(Boolean)).toHaveLength(VERSUS_MATCHES);
    expect(shown.at(-1)).toBe(false);
  });

  it('shows nothing when turned off, and everything again after a reset', () => {
    const { storage } = memory();
    const tips = createTips(storage);
    tips.takeHint('storm');
    tips.setEnabled(false);
    expect(createTips(storage).enabled()).toBe(false);
    expect(tips.takeHint('venom')).toBe(false);
    expect(tips.takeVersus()).toBe(false);
    tips.reset();
    expect(tips.enabled()).toBe(true);
    expect(tips.takeHint('storm')).toBe(true);
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
    expect(() => {
      tips.setEnabled(false);
    }).not.toThrow();
  });
});
