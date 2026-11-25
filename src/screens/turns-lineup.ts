// The lineup that goes with a challenge by turns (ADR 0085): its sender's, before Send challenge,
// or its friend's, before Accept challenge. Picked on the challenge screens in place (no entry of
// its own), so in-app Back returns to what opened it: the vs Friend setup, or the card.
import type { BestOf, Format, Lineup } from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createLineupStep } from '../ui/series/lineup-step.ts';
import type { SetupChoices } from '../ui/series/rules-step.ts';

export interface TurnsLineupHost {
  /** Shows this lineup in the challenge screens' place. */
  show(): void;
  /** In-app Back: to the setup as it was left (a lineup to send), else to the challenge's card. */
  back(toSetup: boolean): void;
  /** Sends the challenge by turns with `own`: a request. */
  send(chosen: SetupChoices, own: Lineup): Promise<unknown>;
  /** Accepts the challenge on screen with `own`: a request. */
  accept(own: Lineup): Promise<unknown>;
}

export interface TurnsLineup {
  readonly element: HTMLElement;
  /** The sender's lineup, for a challenge on `chosen`'s rules. */
  send(chosen: SetupChoices): void;
  /** The friend's lineup, for the challenge on screen. */
  accept(rules: { readonly format: Format; readonly bestOf: BestOf }): void;
  /** An inbox Accept of a challenge by turns: its lineup opens once its card is read. */
  openOnCard(): void;
  /** The card is read: whether it is one to open the lineup for now (`openOnCard`), once. */
  onCard(card: { readonly live: boolean; readonly status: string }): boolean;
}

export function createTurnsLineup(
  balls: readonly BallDefinition[],
  host: TurnsLineupHost,
): TurnsLineup {
  /** What the lineup on screen goes with: a challenge to send, or the accept. */
  let sending: SetupChoices | undefined;
  let onCard = false;
  const step = createLineupStep(balls, {
    onBack: () => {
      host.back(sending !== undefined);
    },
    onLevel: () => undefined,
    onChange: () => undefined,
    // Send challenge and Accept challenge are requests: the button shows it is working.
    onDone: (own) => (sending === undefined ? host.accept(own) : host.send(sending, own)),
  });

  function open(rules: { readonly format: Format; readonly bestOf: BestOf }, done: string): void {
    host.show();
    step.open(rules.format, [], undefined, rules.bestOf, done);
  }

  return {
    element: step.element,
    send(chosen) {
      sending = chosen;
      open(chosen, 'Send challenge');
    },
    accept(rules) {
      sending = undefined;
      open(rules, 'Accept challenge');
    },
    openOnCard() {
      onCard = true;
    },
    onCard(card) {
      const now = onCard && !card.live && card.status === 'open';
      onCard = false;
      return now;
    },
  };
}
