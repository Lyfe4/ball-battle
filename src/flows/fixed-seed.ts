// The browser test projects' stand-in for src/app/fresh-seed.ts (swapped in by vite.config.ts):
// every "fresh" seed in a flow is a pinned one, so each run fights the same series, rematch, quick
// match and home demo, and a failure can be replayed. A flow pins its own seed with
// `pinSeed` before the page asks for one; each file starts on DEFAULT_TEST_SEED
// (browser-setup.ts). Every seed handed out is logged and kept, so a failure can name it.
import { parseSeed } from '../app/seed.ts';

/** Where a flow pins the seed: the page in a frame shares the test page's storage. */
export const TEST_SEED_STORAGE_KEY = 'ballbattle.test.seed';
/** The last seed the page was given, for a timeout message (reload-support.ts). */
export const TEST_SEED_USED_STORAGE_KEY = 'ballbattle.test.seedUsed';
/** Each file's seed unless a flow pins another. */
export const DEFAULT_TEST_SEED = 1;

/** Every fresh seed the page asks for from now on is `seed`. */
export function pinSeed(seed: number): void {
  window.localStorage.setItem(TEST_SEED_STORAGE_KEY, String(seed));
}

/** The seed the page was last given, if any: for messages. */
export function seedUsed(): string {
  return window.localStorage.getItem(TEST_SEED_USED_STORAGE_KEY) ?? 'none yet';
}

export function generateSeed(): number {
  const seed = parseSeed(window.localStorage.getItem(TEST_SEED_STORAGE_KEY)) ?? DEFAULT_TEST_SEED;
  window.localStorage.setItem(TEST_SEED_USED_STORAGE_KEY, String(seed));
  console.info(`[fixed-seed] seed ${String(seed)}`);
  return seed;
}
