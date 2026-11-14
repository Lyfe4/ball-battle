// Runs before every browser test file. The files of a project's session run one after another in
// one browser context, and which files share a session changes from run to run, so whatever one
// file leaves in `localStorage` (a saved series, ADR 0042; the bot level; the speed; tips seen)
// must not reach the next: every file starts as a fresh device. The seed is pinned too
// (fixed-seed.ts), so a flow fights the same series on every run.
import { DEFAULT_TEST_SEED, pinSeed } from './fixed-seed.ts';

const ours = (key: string | null): key is string => key?.startsWith('ballbattle.') === true;
const keys = Array.from({ length: window.localStorage.length }, (_, at) =>
  window.localStorage.key(at),
).filter(ours);
for (const key of keys) window.localStorage.removeItem(key);
pinSeed(DEFAULT_TEST_SEED);
