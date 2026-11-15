// The vs Friend setup (ADR 0055): the same screen as vs Bot's, with the live formats (Reveal and
// Showdown, ADR 0053) and a note on what a live match asks, then Choose lineup for the challenge to
// send. Each choice rewrites its own entry, so Back from the lineup finds the setup as it was left.
import { SETUP_FORMATS } from '../app/modes.ts';
import { writeSendParams } from '../app/online-url.ts';
import { FRIEND_SETUP_NOTE, OPPONENT_CARDS } from '../ui/modes-text.ts';
import { createRulesStep, type RulesStep } from '../ui/series/rules-step.ts';

export interface FriendSetupHost {
  /** In-app Back: the previous screen, else home. */
  back(): void;
  /** Rewrites this entry's URL without showing it again (a choice on the setup). */
  rewrite(write: (params: URLSearchParams) => void): void;
  /** Moves on by the Back rules and shows where it leads (the lineup). */
  go(write: (params: URLSearchParams) => void): void;
}

export function createFriendSetup(host: FriendSetupHost): RulesStep {
  return createRulesStep(
    {
      title: OPPONENT_CARDS.friend.name,
      formats: SETUP_FORMATS.friend,
      levels: false,
      note: FRIEND_SETUP_NOTE,
    },
    {
      onBack: () => {
        host.back();
      },
      onChange: (chosen) => {
        host.rewrite((url) => {
          writeSendParams(url, chosen.format, chosen.bestOf, 'setup');
        });
      },
      onNext: (chosen) => {
        host.go((url) => {
          writeSendParams(url, chosen.format, chosen.bestOf);
        });
      },
    },
  );
}
