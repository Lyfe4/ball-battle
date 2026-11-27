import { describe, expect, it } from 'vitest';
import {
  createFirstSeries,
  FIRST_SERIES_STORAGE_KEY,
  PLAYED_KEYS,
  type FirstSeriesStorage,
} from './first-series.ts';
import { PLAY_FORMAT_STORAGE_KEY, PLAY_OPPONENT_STORAGE_KEY } from './modes.ts';
import { SERIES_SETUP_STORAGE_KEY, SERIES_STORAGE_KEY } from './series-save.ts';
import { FRAME_TIP_STORAGE_KEY, HINTS_SEEN_STORAGE_KEY, READY_SEEN_STORAGE_KEY } from './tips.ts';

function memory(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage: FirstSeriesStorage = () => ({
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

const throwing: FirstSeriesStorage = () => {
  throw new Error('blocked');
};

describe('the first series (ADR 0090)', () => {
  it('is ahead on a brand-new device, and a first page load writes nothing', () => {
    const { storage, store } = memory();
    expect(createFirstSeries(storage).done()).toBe(false);
    expect(store.size).toBe(0);
    expect(createFirstSeries(storage).done()).toBe(false);
  });

  it('is remembered from its start, so the keys it writes itself never end it', () => {
    const { storage, store } = memory();
    createFirstSeries(storage).begin();
    expect(store.get(FIRST_SERIES_STORAGE_KEY)).toBe('guided');
    store.set(SERIES_STORAGE_KEY, '{}');
    store.set(HINTS_SEEN_STORAGE_KEY, 'archer');
    expect(createFirstSeries(storage).done()).toBe(false);
  });

  it('is not ended by what a first page load or the first series itself writes', () => {
    // A first load writes the sound, the speed, the first paint and maybe the slow-frames line;
    // the first series saves its tray, its series and its tips as it goes.
    const { storage } = memory({
      'ballbattle.sound': 'on',
      'ballbattle.speed': '1',
      'ballbattle.stage-shown': '1',
      'ballbattle.botLevel': 'normal',
      'ballbattle.seriesLength': '3',
      [FRAME_TIP_STORAGE_KEY]: 'seen',
      [SERIES_SETUP_STORAGE_KEY]: '{}',
    });
    const first = createFirstSeries(storage);
    expect(first.done()).toBe(false);
    const { storage: later, store } = memory({ [FIRST_SERIES_STORAGE_KEY]: 'guided' });
    store.set(SERIES_STORAGE_KEY, '{}');
    store.set(HINTS_SEEN_STORAGE_KEY, 'archer');
    expect(createFirstSeries(later).done()).toBe(false);
  });

  it('names each played key as its owner does', () => {
    expect(PLAYED_KEYS).toStrictEqual([
      PLAY_FORMAT_STORAGE_KEY,
      PLAY_OPPONENT_STORAGE_KEY,
      HINTS_SEEN_STORAGE_KEY,
      READY_SEEN_STORAGE_KEY,
      SERIES_STORAGE_KEY,
      'ballbattle.versusSeen',
    ]);
  });

  it.each([
    PLAY_FORMAT_STORAGE_KEY,
    PLAY_OPPONENT_STORAGE_KEY,
    HINTS_SEEN_STORAGE_KEY,
    READY_SEEN_STORAGE_KEY,
    SERIES_STORAGE_KEY,
    'ballbattle.versusSeen',
  ])('counts a device holding %s as an existing player, done and never guided', (key) => {
    expect(PLAYED_KEYS).toContain(key);
    const { storage, store } = memory({ [key]: 'x' });
    const first = createFirstSeries(storage);
    expect(first.done()).toBe(true);
    first.begin();
    expect(store.has(FIRST_SERIES_STORAGE_KEY)).toBe(false);
    // An existing player sees nothing marked new.
    expect(first.isNew('showdown')).toBe(false);
    expect(first.takeFormatBox('blind')).toBe(false);
  });

  it('counts storage that throws as done: nobody is held in the guided state', () => {
    const first = createFirstSeries(throwing);
    expect(first.done()).toBe(true);
    first.finish();
    first.reset();
    expect(first.done()).toBe(false);
  });

  it('remembers the end of the first series, and marks the later formats new until chosen', () => {
    const { storage } = memory();
    const first = createFirstSeries(storage);
    expect(first.isNew('showdown')).toBe(false);
    first.finish();
    expect(first.done()).toBe(true);
    const later = createFirstSeries(storage);
    expect(later.done()).toBe(true);
    expect(later.isNew('reveal')).toBe(false);
    expect(later.isNew('showdown')).toBe(true);
    expect(later.isNew('blind')).toBe(true);
    later.chose('showdown');
    expect(createFirstSeries(storage).isNew('showdown')).toBe(false);
    expect(createFirstSeries(storage).isNew('blind')).toBe(true);
  });

  it('gives each later format its How it goes box once, after the first series only', () => {
    const { storage } = memory();
    const first = createFirstSeries(storage);
    expect(first.takeFormatBox('showdown')).toBe(false);
    first.finish();
    expect(first.takeFormatBox('reveal')).toBe(false);
    expect(first.takeFormatBox('showdown')).toBe(true);
    expect(first.takeFormatBox('showdown')).toBe(false);
    expect(createFirstSeries(storage).takeFormatBox('showdown')).toBe(false);
    expect(createFirstSeries(storage).takeFormatBox('blind')).toBe(true);
  });

  it('skips to everything, with nothing marked new', () => {
    const { storage } = memory();
    const first = createFirstSeries(storage);
    first.skip();
    expect(first.done()).toBe(true);
    expect(createFirstSeries(storage).done()).toBe(true);
    expect(first.isNew('blind')).toBe(false);
    // Finishing a later series changes nothing.
    first.finish();
    expect(first.isNew('blind')).toBe(false);
  });

  it('starts again on Show all tips again, even on a device that played before', () => {
    const { storage, store } = memory({ [HINTS_SEEN_STORAGE_KEY]: 'archer' });
    const first = createFirstSeries(storage);
    expect(first.done()).toBe(true);
    first.reset();
    expect(first.done()).toBe(false);
    expect(createFirstSeries(storage).done()).toBe(false);
    first.finish();
    first.chose('blind');
    first.takeFormatBox('blind');
    first.reset();
    first.finish();
    expect(first.isNew('blind')).toBe(true);
    expect(first.takeFormatBox('blind')).toBe(true);
    expect(store.get(FIRST_SERIES_STORAGE_KEY)).toBe('graduated');
  });
});
