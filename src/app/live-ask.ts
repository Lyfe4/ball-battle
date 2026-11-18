// How often a live page asks about its series (ADR 0053, "Cut its cost before launch"), pure. Each
// read is two things: the heartbeat (the server notes the player is still there) and how this page
// learns of the other player's move. The second matters only while the other player can move;
// otherwise the read is the heartbeat alone, and a slower one does. Asking every second throughout
// spent most reads on the heartbeat: during a fight, a countdown, the coin toss and the player's own
// pick, nothing the other phone does changes what this one shows, save leaving.
import type { SeriesView } from '../api/series.ts';
import { dueOf } from './online-series.ts';

/** While the other player can move: how soon a pick reaches this screen (as before, ADR 0053). */
export const WAITING_ASK_MS = 1_000;
/** While only the heartbeat matters: the player's own pick, a countdown, a fight, the coin toss. */
export const HEARTBEAT_ASK_MS = 2_000;
/**
 * A heartbeat's read takes time too, so two heartbeats land about read + wait apart. After a slow
 * read the wait shortens, down to WAITING_ASK_MS, keeping them at most this far apart when reads
 * are quick, and never further apart than asking every second did: the other phone calls a player
 * away after AWAY_AFTER_MS without one, and a cold function's read has taken 3.3 s.
 */
export const HEARTBEAT_GAP_MS = 3_000;

/**
 * Whether the other player can make a move this page is waiting to see, at `at` (the server's
 * clock): they haven't arrived yet, or the pick open by then is theirs and not this player's.
 */
export function waitsOnOther(view: SeriesView, at: number): boolean {
  const clock = view.live;
  if (clock == null || view.status !== 'open') return false;
  if (clock.startedAt === null) return true;
  if (clock.opensAt === null || at < clock.opensAt) return false;
  const due = dueOf(view);
  return due.length > 0 && !due.includes(view.you);
}

/**
 * Ms until a live page asks again, the server's clock being `now` and its last read having taken
 * `readMs`: every second while it waits on the other player (looking one heartbeat ahead, so a pick
 * of theirs that opens meanwhile is asked about from the moment it opens), else the heartbeat.
 */
export function liveAskMs(view: SeriesView, now: number, readMs: number): number {
  if (waitsOnOther(view, now + HEARTBEAT_ASK_MS)) return WAITING_ASK_MS;
  return Math.min(HEARTBEAT_ASK_MS, Math.max(WAITING_ASK_MS, HEARTBEAT_GAP_MS - readMs));
}
