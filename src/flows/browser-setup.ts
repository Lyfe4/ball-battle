// Runs before every browser test file. The files of a project's session run one after another in
// one browser context, and which files share a session changes from run to run, so whatever one
// file leaves in `localStorage` (a saved series, ADR 0042; the bot level; the speed; tips seen)
// must not reach the next: every file starts as a fresh device. The seed is pinned too
// (fixed-seed.ts), so a flow fights the same series on every run.
//
// History too: each file's frame shares the session history with the files before it. In WebKit,
// when the file before ended on a pushed entry, a `replaceState` on this frame's first entry is
// lost to a later Back, which lands on the frame's own test URL instead (series-resume, after
// tab-bar's last link, in CI's WebKit job). A page at the top of a real tab has no such sibling
// frames, so no player meets it. Every file starts on an entry of its own, as a tab opened afresh.
import { DEFAULT_TEST_SEED, pinSeed } from './fixed-seed.ts';

const ours = (key: string | null): key is string => key?.startsWith('ballbattle.') === true;
const keys = Array.from({ length: window.localStorage.length }, (_, at) =>
  window.localStorage.key(at),
).filter(ours);
for (const key of keys) window.localStorage.removeItem(key);
pinSeed(DEFAULT_TEST_SEED);
history.pushState(null, '', location.href);
