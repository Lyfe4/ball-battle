// The next screen, read before moving to it (ADR 0054). A button that leads into an online series
// (Accept challenge, Back to your match; the lobby when the friend accepts) stays busy while the
// series is read, and the series screen shows that answer at once: no "Loading…" page between
// screens. A failed read isn't kept (the screen reads again itself and says what failed), and an
// answer not taken within PRIME_MS is dropped, so a stale one is never shown.
import { callApi, type ApiResult } from '../app/api.ts';

/** How long a read series waits to be shown. */
const PRIME_MS = 10_000;

export interface Primer {
  /** Reads series `id`; settles once it is read (or failed). */
  series(id: string): Promise<void>;
  /** The answer read for series `id`, if fresh, once. */
  takeSeries(id: string): ApiResult<unknown> | undefined;
}

export function createPrimer(): Primer {
  let held: { id: string; at: number; answer: ApiResult<unknown> } | undefined;
  return {
    async series(id) {
      const answer = await callApi<unknown>('GET', `series/${id}`);
      held = answer.ok && answer.status === 200 ? { id, at: Date.now(), answer } : undefined;
    },
    takeSeries(id) {
      const answer = held?.id === id && Date.now() - held.at < PRIME_MS ? held.answer : undefined;
      held = undefined;
      return answer;
    },
  };
}
