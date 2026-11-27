// Play's place while it can't be pressed (ADR 0089 addendum of 2026-11-27, home-play-state.ts):
// waiting for the server, in its place so nothing moves when the answer comes, busy to a screen
// reader, unseen for SKELETON_AFTER_MS and then a skeleton over it (home.css), so a quick answer
// shows nothing at all; or covered by the way back to a match, which sits in the same cell. Either
// way `inert`: no tap, no focus.
import { unseenAtFirst } from './friends-loading.ts';

/** How Play's row shows: pressable, waiting for the server, or covered by a way back. */
export type PlayRowState = 'play' | 'waiting' | 'covered';

/** Marks `row` (and its place, for what hides with it) as `state`; a change only. */
export function showPlayRow(row: HTMLElement, state: PlayRowState): void {
  const waiting = state === 'waiting';
  row.inert = state !== 'play';
  row.toggleAttribute('data-covered', state === 'covered');
  row.parentElement?.toggleAttribute('data-covered', state === 'covered');
  if (row.hasAttribute('data-waiting') === waiting) return;
  if (waiting) {
    row.setAttribute('data-waiting', '');
    row.setAttribute('aria-busy', 'true');
    unseenAtFirst(row);
  } else {
    row.removeAttribute('data-waiting');
    row.removeAttribute('aria-busy');
    // Shown at once, however soon the answer came.
    delete row.dataset['unseen'];
  }
}
