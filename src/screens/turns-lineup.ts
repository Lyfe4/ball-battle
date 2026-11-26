// The lineup that goes with a challenge by turns (ADR 0085): its sender's, before Send challenge,
// or its friend's, before Accept challenge. Picked on the challenge screens in place (no entry of
// its own), so in-app Back returns to what opened it: the vs Friend setup, the card, or (Play by
// turns from a friend's sheet, which shows no rules step) the Friends tab. The sender's lineup
// says the rules it sends ("Best of 3 · Reveal · by turns") with Change: the rules step for by
// turns, then back here with the tray as it was.
import type { BestOf, Format, Lineup } from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createLineupStep } from '../ui/series/lineup-step.ts';
import type { RulesStep, SetupChoices } from '../ui/series/rules-step.ts';

export interface TurnsLineupHost {
  /** Shows this lineup (`turns`) or the vs Friend setup in the challenge screens' place. */
  show(part: 'turns' | 'setup'): void;
  /**
   * In-app Back where it leaves these steps: `leave`, where the player came from (a lineup to send
   * straight from a friend's sheet); `card`, the challenge's card (a lineup to accept).
   */
  back(to: 'leave' | 'card'): void;
  /** Sends the challenge by turns with `own`: a request. */
  send(chosen: SetupChoices, own: Lineup): Promise<unknown>;
  /** Accepts the challenge on screen with `own`: a request. */
  accept(own: Lineup): Promise<unknown>;
}

export interface TurnsLineup {
  readonly element: HTMLElement;
  /**
   * The sender's lineup, for a challenge on `chosen`'s rules; `straight` when no rules step was
   * seen on the way (Play by turns from a friend's sheet).
   */
  send(chosen: SetupChoices, straight?: boolean): void;
  /** Back from Change's rules step: this lineup as it was (true), unless Change opened none. */
  resume(): boolean;
  /** The friend's lineup, for the challenge on screen. */
  accept(rules: { readonly format: Format; readonly bestOf: BestOf }): void;
  /** An inbox Accept of a challenge by turns: its lineup opens once its card is read. */
  openOnCard(): void;
  /** The card is read: whether it is one to open the lineup for now (`openOnCard`), once. */
  onCard(card: { readonly live: boolean; readonly status: string }): boolean;
}

export function createTurnsLineup(
  balls: readonly BallDefinition[],
  setup: RulesStep,
  host: TurnsLineupHost,
): TurnsLineup {
  /** What the lineup on screen goes with: a challenge to send, or the accept. */
  let sending: SetupChoices | undefined;
  /** The lineup to send was opened with no rules step on the way: Back leaves. */
  let straight = false;
  /** Change opened the rules step: the next send comes back to this tray. */
  let changing = false;
  let onCard = false;
  const step = createLineupStep(balls, {
    onBack: () => {
      if (sending === undefined) host.back('card');
      else if (straight) host.back('leave');
      else host.show('setup');
    },
    onLevel: () => undefined,
    onChange: () => undefined,
    onRules: () => {
      if (sending === undefined) return;
      changing = true;
      host.show('setup');
      setup.open({ ...sending, turns: true });
    },
    // Send challenge and Accept challenge are requests: the button shows it is working.
    onDone: (own) => (sending === undefined ? host.accept(own) : host.send(sending, own)),
  });
  const rulesButton = step.element.querySelector<HTMLElement>('.lineup-rules');

  function open(
    rules: { readonly format: Format; readonly bestOf: BestOf },
    done: string,
    keep = false,
  ): void {
    host.show('turns');
    // The rules this lineup goes with, and Change, on the sender's lineup only.
    if (rulesButton !== null) rulesButton.hidden = sending === undefined;
    step.open(rules.format, keep ? step.draft() : [], undefined, rules.bestOf, done, 'by turns');
  }

  return {
    element: step.element,
    send(chosen, fromSheet = false) {
      sending = chosen;
      // Back from Change's rules step keeps how the lineup was reached, and the tray.
      const back = changing;
      changing = false;
      if (!back) straight = fromSheet;
      open(chosen, 'Send challenge', back);
    },
    resume() {
      if (!changing || sending === undefined) return false;
      changing = false;
      open(sending, 'Send challenge', true);
      return true;
    },
    accept(rules) {
      sending = undefined;
      changing = false;
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
