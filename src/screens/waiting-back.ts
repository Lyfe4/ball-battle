// Back on the waiting screen asks first (ADR 0089 addendum of 2026-11-27, as changed by the owner the
// same day): "Cancel your challenge to Robin?" on the shared sheet's confirm step, Keep waiting the
// safe default (focused; Escape, the × and a tap outside are Keep waiting too). Only a yes cancels;
// switching tab, another screen or the app hidden keeps the challenge, which stops on its own only
// when the server hasn't heard from its waiting screen for LOBBY_SEEN_MS.
import { createSheet } from '../ui/sheet.ts';
import { backStep } from './online-challenge-text.ts';

export interface WaitingBack {
  /** Asks; true when the player chose to cancel the challenge to `friend` (null: a link). */
  ask(friend: string | null): Promise<boolean>;
}

export function createWaitingBack(): WaitingBack {
  const sheet = createSheet({ id: 'waiting-back-title', title: '', name: 'waiting-back' });
  return {
    async ask(friend) {
      if (!sheet.element.isConnected) document.body.append(sheet.element);
      const step = backStep(friend);
      sheet.title.textContent = step.title;
      sheet.open();
      const yes = await sheet.confirm(step);
      sheet.close();
      return yes;
    },
  };
}
