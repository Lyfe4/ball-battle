// A motion token's length in ms (tokens.css, ADR 0087), so a script's animation keeps the tokens'
// time. One copy for every script that animates (it was copied in two), read by msOf.
import { msOf } from '../app/motion-ms.ts';

/** The root's `name` token in ms, as msOf reads it (200 ms when it can't be read). */
export function tokenMs(name: string, fallback = 200): number {
  return msOf(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
}
