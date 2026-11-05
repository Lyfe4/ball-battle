// Setting up a best-of-3 series (ADR 0017, 0019, 0021), one job per screen: the rules, the lineup
// and, in reveal, the answer to the ball the bot shows first in round 1. The rules and the lineup are
// history entries (`?mode=bo3&step=...`), so Back walks back through them; the answer is part of the
// series' one entry, which starting the series replaces (ADR 0025). The bot's lineup lives here, in memory
// only, until the series starts: it is never written to the URL before the series is decided.
import { generateSeed } from './app/seed.ts';
import { writeSeriesModeParams, type SeriesLink } from './app/series-url.ts';
import { randomBot } from './sim/bot.ts';
import { RULESET_VERSION } from './sim/ruleset.ts';
import type { Format, Lineup, Opponent, SeriesSetup } from './sim/series.ts';
import type { BallDefinition } from './sim/types.ts';
import type { BallInfoLink } from './ui/balls/ball-info.ts';
import type { Draft } from './ui/lineup-draft.ts';
import { createLineupStep } from './ui/series/lineup-step.ts';
import { createAnswerStep } from './ui/series/answer-step.ts';
import { createRulesStep } from './ui/series/rules-step.ts';

/** The bot whose lineup was just picked from `seed`, so a verifier can pick it again. */
const botOpponent = (seed: number): Opponent => ({
  kind: 'bot',
  bot: randomBot.id,
  lineupSeed: seed,
});

export type SetupStep = 'rules' | 'lineup' | 'answer';

export interface SeriesSetupHost {
  /** Moves to another step by the Back rules (a new entry here; the step is opened by the caller). */
  move(write: (params: URLSearchParams) => void): void;
  replace(write: (params: URLSearchParams) => void): void;
  /** In-app Back: the previous screen, or `toParent` when the visitor arrived here from a link. */
  back(toParent: () => void): void;
  /** Leaves Best of 3 for the parent screen (the first step's Back, arriving from a link). */
  exit(): void;
  /** The setup is complete: play the series (in reveal, with the player's round-1 answer). */
  start(setup: SeriesSetup, firstPick?: string): void;
  /** The lineup's info card links to each ball's manual entry. */
  readonly ballLink: BallInfoLink;
}

export interface SeriesSetupFlow {
  setVisible(visible: boolean): void;
  /** Shows a step, prefilled from the link where it has something (a format, the lineup). */
  show(step: SetupStep, link: SeriesLink): void;
  /** After a series: its lineup and format, for when the player sets up the next one. */
  keep(setup: SeriesSetup): void;
}

export function createSeriesSetup(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  host: SeriesSetupHost,
): SeriesSetupFlow {
  const ballIds = balls.map((ball) => ball.id);
  let format: Format = 'blind';
  let draft: Draft = [];
  /** Reveal: the series seed, both lineups and the bot's round-1 ball, while the player answers. */
  let revealed:
    | { readonly seed: number; readonly bot: Lineup; readonly own: Lineup; readonly shown: string }
    | undefined;

  const to = (step: SetupStep) => (params: URLSearchParams) => {
    writeSeriesModeParams(params, format, step === 'rules' ? undefined : step);
  };

  const rules = createRulesStep({
    onBack: () => {
      host.back(() => {
        host.exit();
      });
    },
    onNext: (chosen) => {
      format = chosen;
      host.move(to('lineup'));
      open('lineup');
    },
  });

  const lineup = createLineupStep(balls, {
    onBack: () => {
      draft = lineup.draft();
      host.back(() => {
        host.replace(to('rules'));
        open('rules');
      });
    },
    onChange: (tray) => {
      draft = tray;
    },
    ballLink: host.ballLink,
    onDone: (own) => {
      draft = own;
      // The bot picks from the series seed, so the setup (and the link) fully decides the series.
      const seed = generateSeed();
      const bot = randomBot.pickLineup(seed, ballIds);
      if (format === 'reveal') {
        // The same seeded choice the series makes when it starts, so the ball shown here plays.
        revealed = { seed, bot, own, shown: randomBot.showFirst(seed, bot) };
        host.move(to('answer'));
        open('answer');
        return;
      }
      host.start({
        ruleset: RULESET_VERSION,
        seed,
        a: own,
        b: bot,
        opponent: botOpponent(seed),
        ...(format === 'blind' ? {} : { format }),
      });
    },
  });

  const answer = createAnswerStep(balls, {
    onBack: () => {
      host.back(() => {
        host.replace(to('lineup'));
        open('lineup');
      });
    },
    onAnswer: (ball) => {
      if (revealed === undefined) return;
      const { seed, bot, own } = revealed;
      host.start(
        {
          ruleset: RULESET_VERSION,
          seed,
          a: own,
          b: bot,
          opponent: botOpponent(seed),
          format: 'reveal',
        },
        ball,
      );
    },
  });

  const steps: Readonly<Record<SetupStep, HTMLElement>> = {
    rules: rules.element,
    lineup: lineup.element,
    answer: answer.element,
  };
  root.replaceChildren(...Object.values(steps));
  root.classList.add('series-setup');

  function open(step: SetupStep): void {
    for (const [name, section] of Object.entries(steps)) section.hidden = name !== step;
    if (step === 'rules') {
      revealed = undefined;
      rules.open(format);
    } else if (step === 'lineup') {
      revealed = undefined;
      lineup.open(format, draft);
    } else if (revealed !== undefined) {
      answer.open(revealed.own, revealed.bot, revealed.shown);
    }
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(step, link) {
      if (link.format !== undefined) format = link.format;
      if (link.lineup !== undefined) draft = link.lineup;
      // The bot's revealed lineup isn't in the URL: after a reload, ordering goes back to the lineup.
      if (step === 'answer' && revealed === undefined) {
        host.replace(to('lineup'));
        open('lineup');
        return;
      }
      open(step);
    },
    keep(setup) {
      draft = setup.a;
      format = setup.format ?? 'blind';
    },
  };
}
