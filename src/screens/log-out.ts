// Log out, in settings for an account (ADR 0079): ends the session on the server and, as Forget me
// does, clears every `ballbattle.*` key here, then starts the page afresh. The account and its
// username stay; signing in again brings them back. Refused during the account's live match.
import { callApi, failureKindOf, type Fetch } from '../app/api.ts';
import { forgetDevice, type DeviceStorage } from '../app/online-device.ts';
import { failureLine } from './online-failure-text.ts';

/** Resolves undefined when logged out, else the line that says why not. */
export async function logOut(
  storage: DeviceStorage,
  startAfresh: () => void,
  send?: Fetch,
): Promise<string | undefined> {
  const answer = await callApi('DELETE', 'session', undefined, {}, send);
  // Logged out, or the session had already ended (401): this device forgets it either way.
  if (!answer.ok && !(answer.kind === 'error' && answer.status === 401)) {
    return failureLine(failureKindOf(answer), answer.kind === 'error' ? answer.message : undefined);
  }
  forgetDevice(storage);
  startAfresh();
  return undefined;
}
