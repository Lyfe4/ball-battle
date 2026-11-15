// The first online action asks the 16+ question once per device (ADR 0052 section 6, ADR 0055: at
// the start of the vs Friend flow, before any lineup), and makes the guest on a yes. Failures of an
// online action become a notice with a way on: the question again after a 401, the "already in a
// match" card, or the failure with Try again.
import { callApi, failureKindOf, type ApiFailure } from '../app/api.ts';
import { hasGuest, rememberGuest, type DeviceStorage } from '../app/online-device.ts';
import type { CurrentMatch } from '../api/live.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import { inAMatchCard } from './current-match.ts';
import { adultCard } from './online-challenge-text.ts';
import { onlineNotice } from './online-text.ts';

export interface GuestGateHost {
  readonly storage: DeviceStorage;
  /** Shows a notice in the screen's place. */
  show(content: NoticeContent): void;
  /** Not now: back where the player came from. */
  readonly back: () => void;
  readonly home: () => void;
  toMatch(match: CurrentMatch): Promise<void>;
}

export interface GuestGate {
  /** A failure as a notice; an `unauthenticated` one first asks the 16+ question again. */
  readonly failed: (answer: ApiFailure, retry: () => Promise<unknown>) => void;
  /**
   * On a device with no guest, asks the 16+ question, then does `then`: true when it asked (a
   * device that lost its cookie meets the same card after a 401).
   */
  readonly askFirst: (then: () => unknown) => boolean;
}

export function createGuestGate(host: GuestGateHost): GuestGate {
  function failed(answer: ApiFailure, retry: () => Promise<unknown>): void {
    if (answer.kind === 'error' && answer.code === 'unauthenticated') {
      rememberGuest(host.storage, false);
      host.show(adultCard(() => startGuest(retry), host.back));
      return;
    }
    const reason = answer.kind === 'error' ? answer.message : undefined;
    if (answer.kind === 'error' && answer.code === 'in_a_match') {
      host.show(inAMatchCard(answer.message, (match) => host.toMatch(match), host.home));
      return;
    }
    host.show(onlineNotice(failureKindOf(answer), retry, host.home, reason));
  }

  /** Makes the guest (the first online action), then does what was asked. */
  async function startGuest(then: () => unknown): Promise<void> {
    const made = await callApi<unknown>('POST', 'session', { adult: true });
    if (!made.ok) {
      failed(made, () => startGuest(then));
      return;
    }
    rememberGuest(host.storage, true);
    // The age card's button stays busy through the request it was asked for.
    await then();
  }

  return {
    failed,
    askFirst: (then) => {
      if (hasGuest(host.storage)) return false;
      host.show(adultCard(() => startGuest(then), host.back));
      return true;
    },
  };
}
