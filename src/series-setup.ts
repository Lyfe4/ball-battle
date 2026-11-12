// Setting up a best-of-3 series (ADR 0017, 0019, 0021, 0029, 0035), one job per screen: the rules
// (with the bot's level), the lineup and, in Reveal and Showdown, round 1 with both lineups shown:
// Reveal's coin toss and the player's first pick (an answer to the bot's shown ball, or the ball
// they show first), or Showdown's opener, picked while the bot picks its own. The rules and the lineup are
// history entries (`?mode=bo3&step=...`), so Back walks back through them; the answer is part of the
// series' one entry, which starting the series replaces (ADR 0025). The bot's lineup lives here and in
// the device's storage (so a reload keeps round 1's pick where it was, ADR 0042) until the series
// starts: it is never written to the URL before the series is decided.
import { loadBotLevel, saveBotLevel } from './app/bot-level.ts';
import { lineupParentOf } from './app/modes.ts';
import { loadSetup, saveSetup } from './app/series-save.ts';
import { generateSeed } from './app/seed.ts';
import { beginSession, botOf, resolvePicks } from './app/series-session.ts';
import { writeSeriesModeParams, type SeriesLink } from './app/series-url.ts';
import { botFor, DEFAULT_BOT } from './sim/bot.ts';
import { indexDefinitions } from './sim/definitions.ts';
import { RULESET_VERSION } from './sim/ruleset.ts';
import {
  bestOfOf,
  DEFAULT_BEST_OF,
  formatOf,
  type BestOf,
  type Format,
  type Opponent,
  type SeriesSetup,
  type SeriesState,
} from './sim/series.ts';
import type { BallDefinition } from './sim/types.ts';
import type { Draft } from './ui/lineup-draft.ts';
import { createLineupStep } from './ui/series/lineup-step.ts';
import { createAnswerStep } from './ui/series/answer-step.ts';
import { createResumeCard } from './ui/series/resume-card.ts';
import { createRulesStep } from './ui/series/rules-step.ts';

/** The bot whose lineup was just picked from `seed`, so a verifier can pick it again. */
const botOpponent = (bot: string, seed: number): Opponent => ({
  kind: 'bot',
  bot,
  lineupSeed: seed,
});

/** Reading `localStorage` can throw; the level helpers catch it. */
const storage = () => window.localStorage;

export type SetupStep = 'rules' | 'lineup' | 'answer';

export interface SeriesSetupHost {
  /** Moves to another step by the Back rules (a new entry here; the step is opened by the caller). */
  move(write: (params: URLSearchParams) => void): void;
  replace(write: (params: URLSearchParams) => void): void;
  /** In-app Back: the previous screen, or `toParent` when the visitor arrived here from a link. */
  back(toParent: () => void): void;
  /** Leaves Best of 3 for home (the first step's Back, arriving from a link). */
  exit(): void;
  /** Other modes in place of this entry: the parent of a lineup it leads to (ADR 0046). */
  toModes(): void;
  /** The setup is complete: play the series (Reveal and Showdown: with the player's round-1 pick). */
  start(setup: SeriesSetup, firstPick?: string): void;
  /** An undecided series left with Back, which the rules and lineup offer to resume. */
  held(): SeriesState | undefined;
  /** Carries on with the held series. */
  resume(): void;
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
  const lookup = indexDefinitions(balls);
  let format: Format = 'blind';
  /** The series length the URL names (ADR 0048): Best of 3 unless it says `mode=bo5`. */
  let bestOf: BestOf = DEFAULT_BEST_OF;
  /** The bot's level, as last chosen on this device. */
  let level = loadBotLevel(storage);
  // The tray and the revealed series as they were before a reload (ADR 0042).
  const saved = loadSetup(storage, lookup);
  let draft: Draft = saved.draft;
  /** Reveal and Showdown: the series about to start, while the player makes round 1's pick. */
  let revealed: SeriesSetup | undefined = saved.revealed;

  /** Keeps the tray and the revealed series on the device, as they are now. */
  function remember(): void {
    saveSetup(storage, revealed === undefined ? { draft } : { draft, revealed });
  }

  const to = (step: SetupStep) => (params: URLSearchParams) => {
    writeSeriesModeParams(params, format, step === 'rules' ? undefined : step, bestOf);
  };

  /** Remembers the level chosen on the rules step or the lineup step (ADR 0035, 0046). */
  function chooseLevel(chosen: string): void {
    level = chosen;
    saveBotLevel(storage, chosen);
  }

  const rules = createRulesStep({
    onBack: () => {
      host.back(() => {
        host.exit();
      });
    },
    onLevel: chooseLevel,
    onNext: (chosen) => {
      format = chosen;
      host.move(to('lineup'));
      open('lineup');
    },
  });

  const lineup = createLineupStep(balls, {
    onBack: () => {
      draft = lineup.draft();
      // Arriving from a link: the screen that leads to this lineup (ADR 0046). Reveal's is home;
      // the other formats' is Other modes. A lineup reached from the rules step goes back to it.
      host.back(() => {
        if (lineupParentOf(format, bestOf) === 'home') host.exit();
        else host.toModes();
      });
    },
    onLevel: chooseLevel,
    onChange: (tray) => {
      draft = tray;
      remember();
    },
    onDone: (own) => {
      draft = own;
      // The bot picks from the series seed, so the setup (and the link) fully decides the series.
      const seed = generateSeed();
      // Blind has no choices for a bot to make, so every level plays it alike: the default.
      const opponent = botOpponent(format === 'blind' ? DEFAULT_BOT.id : level, seed);
      const setup: SeriesSetup = {
        ruleset: RULESET_VERSION,
        seed,
        a: own,
        b: botFor(opponent).pickLineup(seed, ballIds, bestOf),
        opponent,
        ...(format === 'blind' ? {} : { format }),
        // Best of 3 writes no length, as every series before ADR 0048.
        ...(bestOf === DEFAULT_BEST_OF ? {} : { bestOf }),
      };
      if (format !== 'blind') {
        revealed = setup;
        remember();
        host.move(to('answer'));
        open('answer');
        return;
      }
      remember();
      host.start(setup);
    },
  });

  const answer = createAnswerStep(lookup, {
    onBack: () => {
      host.back(() => {
        host.replace(to('lineup'));
        open('lineup');
      });
    },
    onAnswer: (ball) => {
      if (revealed === undefined) return;
      const series = revealed;
      // Started, the series is saved as a series: the answer step can't be reopened (ADR 0025).
      revealed = undefined;
      remember();
      host.start(series, ball);
    },
  });

  const steps: Readonly<Record<SetupStep, HTMLElement>> = {
    rules: rules.element,
    lineup: lineup.element,
    answer: answer.element,
  };
  root.replaceChildren(...Object.values(steps));
  root.classList.add('series-setup');

  const resume = createResumeCard(() => {
    host.resume();
  });

  function open(step: SetupStep): void {
    for (const [name, section] of Object.entries(steps)) section.hidden = name !== step;
    // Under the step's header: the rules and the lineup offer a held series back.
    steps[step].firstElementChild?.after(resume.element);
    resume.show(step === 'answer' ? undefined : host.held());
    if (step === 'rules') {
      revealed = undefined;
      remember();
      rules.open(format, level, bestOf);
    } else if (step === 'lineup') {
      revealed = undefined;
      remember();
      lineup.open(format, draft, level, bestOf);
    } else if (revealed !== undefined) {
      // The series as it starts: the toss, and the bot's shown ball when it won it. The same seeded
      // choices the series makes when it starts, so what is shown here is what plays.
      answer.open(resolvePicks(beginSession(revealed), botOf(revealed)).state);
    }
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(step, link) {
      // The URL names the format (none is Blind), whatever was on screen before.
      format = link.format ?? 'blind';
      bestOf = link.bestOf ?? DEFAULT_BEST_OF;
      if (link.lineup !== undefined) draft = link.lineup;
      // The bot's revealed lineup isn't in the URL but on the device: without it (or with a series
      // in another format than the URL names) round 1's pick goes back to the lineup.
      const other =
        revealed === undefined || formatOf(revealed) !== format || bestOfOf(revealed) !== bestOf;
      if (step === 'answer' && other) {
        host.replace(to('lineup'));
        open('lineup');
        return;
      }
      open(step);
    },
    keep(setup) {
      draft = setup.a;
      format = setup.format ?? 'blind';
      bestOf = bestOfOf(setup);
      remember();
    },
  };
}
