// Who this device plays as, as the server says (ADR 0079 addendum of 2026-11-22): `/me` is the
// source of truth, never `localStorage`, which Safari clears after 7 days without a visit while the
// session cookie stays. A device with neither the player hint (a readable cookie the server sets
// beside the session) nor a remembered player is nobody, without a request: a first visit costs
// no function call. The answer updates the device's keys, which stay a cache only.
import { hasPlayerHint, type PlayerResponse } from '../api/session.ts';
import type { ApiResult } from './api.ts';
import {
  hasAccount,
  hasGuest,
  rememberAccount,
  rememberGuest,
  type DeviceStorage,
} from './online-device.ts';

/** An account (with its username, if chosen), a guest, nobody, or not known (offline, failing). */
export type WhoAmI =
  | { readonly kind: 'account'; readonly username: string | null }
  | { readonly kind: 'guest' }
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown' };

/** Whether this device may have a player, so asking `/me` is worth a request. */
export function mayHavePlayer(storage: DeviceStorage, cookies: string): boolean {
  return hasPlayerHint(cookies) || hasGuest(storage) || hasAccount(storage);
}

/** Asks `/me` (through `readMe`) where this device may have a player. */
export async function whoAmI(
  storage: DeviceStorage,
  cookies: string,
  readMe: () => Promise<ApiResult<PlayerResponse | undefined>>,
): Promise<WhoAmI> {
  if (!mayHavePlayer(storage, cookies)) return { kind: 'none' };
  const me = await readMe();
  if (me.ok) {
    const account = me.body?.account === true;
    rememberAccount(storage, account);
    if (!account) rememberGuest(storage, true);
    return account ? { kind: 'account', username: me.body.username ?? null } : { kind: 'guest' };
  }
  // No session (it ended, or was never made here): nobody, and the cache says so too.
  if (me.kind === 'error' && me.status === 401) {
    rememberGuest(storage, false);
    return { kind: 'none' };
  }
  return { kind: 'unknown' };
}
