// What Forget me does (ADR 0052 sections 2 and 6), in every build: online play's settings, and a
// build without online play, whose settings still offer it on a device that has a guest (ADR 0078).
// It holds Forget me's one request and nothing else of online play, and no DOM: `startAfresh` is the
// page's reload.
import { failureKindOf, FORGET_ME_URL, requestApi, type Fetch } from '../app/api.ts';
import { forgetDevice, hasGuest, type DeviceStorage } from '../app/online-device.ts';
import { failureLine } from './online-failure-text.ts';

/** Forget me's host (`ForgetMeHost` in `ui/online/forget-me.ts`); `send` is the page's own fetch. */
export function forgetMeHost(
  storage: DeviceStorage,
  startAfresh: () => void,
  send: Fetch = (input, init) => fetch(input, init),
): { hasGuest(): boolean; forget(): Promise<string | undefined> } {
  return {
    hasGuest: () => hasGuest(storage),
    forget: async () => {
      const answer = await requestApi('DELETE', FORGET_ME_URL, undefined, {}, send);
      // Deleted, or already gone (401): this device forgets it too, and starts afresh. Anything
      // else left the guest on the server, so the device keeps it and says why.
      if (!answer.ok && !(answer.kind === 'error' && answer.status === 401)) {
        return failureLine(
          failureKindOf(answer),
          answer.kind === 'error' ? answer.message : undefined,
        );
      }
      forgetDevice(storage);
      startAfresh();
      return undefined;
    },
  };
}
