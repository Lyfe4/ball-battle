// Setting up a series against the bot (ADR 0017, 0019, 0021, 0029, 0035, 0055), one job per screen:
// the vs Bot setup (length, format, the bot's level), the lineup and, in Reveal and Showdown, round 1 with both lineups shown:
// Reveal's coin toss and the player's first pick (an answer to the bot's shown ball, or the ball
// they show first), or Showdown's opener, picked while the bot picks its own. The setup and the lineup are
// history entries (`?mode=bo3&step=...`), so Back walks back through them; each choice on the setup
// rewrites its own entry, so Back from the lineup finds the setup as it was left; the answer is part of the
// series' one entry, which starting the series replaces (ADR 0025). The bot's lineup lives here and in
// the device's storage (so a reload keeps round 1's pick where it was, ADR 0042) until the series
// starts: it is never written to the URL before the series is decided.
import { loadBotLevel, saveBotLevel } from '../app/bot-level.ts';
import { firstSeries } from '../app/first-series-device.ts';
import { bestAnswer, FIRST_SERIES, starterTrio } from '../app/first-series-setup.ts';
import { firstSeriesSeedSliced } from '../app/first-series-seed.ts';
import { savePlaySetup, SETUP_FORMATS } from '../app/modes.ts';
import { loadSetup, saveSetup } from '../app/series-save.ts';
import { generateSeed } from '../app/fresh-seed.ts';
import { beginSession, botOf, resolvePicks } from '../app/series-session.ts';
import { writeSeriesModeParams, type SeriesLink } from '../app/series-url.ts';
import { botFor, DEFAULT_BOT } from '../sim/bot.ts';
import { indexDefinitions } from '../sim/definitions.ts';
import type { Lineup } from '../sim/series.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import {
  bestOfOf,
  DEFAULT_BEST_OF,
  formatOf,
  type BestOf,
  type Format,
  type Opponent,
  type SeriesSetup,
  type SeriesState,
} from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import {
  FIRST_SERIES_GUIDE,
  FIRST_VISIT,
  firstPickSteps,
  formatSteps,
  SERIES_STEPS,
} from '../ui/first-series-text.ts';
import type { CoachTip } from '../ui/coach.ts';
import type { Draft } from '../ui/lineup-draft.ts';
import { createLineupStep, type LineupGuide } from '../ui/series/lineup-step.ts';
import { createAnswerStep } from '../ui/series/answer-step.ts';
import { createResumeCard } from '../ui/series/resume-card.ts';
import { createRulesStep } from '../ui/series/rules-step.ts';
import { browserStorage as storage } from '../app/storage.ts';

/** The bot whose lineup was just picked from `seed`, so a verifier can pick it again. */
const botOpponent = (bot: string, seed: number): Opponent => ({
  kind: 'bot',
  bot,
  lineupSeed: seed,
});

export type SetupStep = 'rules' | 'lineup' | 'answer';

export interface SeriesSetupHost {
  /** Moves to another step by the Back rules (a new entry here; the step is opened by the caller). */
  move(write: (params: URLSearchParams) => void): void;
  replace(write: (params: URLSearchParams) => void): void;
  /** In-app Back: the previous screen, or `toParent` when the visitor arrived here from a link. */
  back(toParent: () => void): void;
  /** Leaves the setup for home (the setup's Back, arriving from a link). */
  exit(): void;
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

  /**
   * The guided first series (ADR 0090): a first visit's Best of 3 · Reveal, against the Easy bot on
   * a seed where the bot shows first; its lineup teaches and offers Pick for me.
   */
  const guided = () =>
    !firstSeries.done() && format === FIRST_SERIES.format && bestOf === FIRST_SERIES.bestOf;
  /**
   * The formats whose first-time box is up on this page: taken once per device (first-series.ts),
   * it stays up until a series in that format starts, so a Back and forth doesn't lose it.
   */
  const teaching = new Set<Format>();
  /** Counts the steps opened, so a search that outlives its lineup starts nothing. */
  let openings = 0;
  function formatBox(shown: Format): CoachTip | undefined {
    if (!teaching.has(shown) && !firstSeries.takeFormatBox(shown)) return undefined;
    teaching.add(shown);
    const steps = formatSteps(shown);
    return steps === undefined ? undefined : { steps };
  }

  /** What the lineup teaches now: the first series', or Blind's first time. */
  function lineupGuide(): LineupGuide | undefined {
    if (guided()) {
      return {
        tip: { steps: SERIES_STEPS, step: { at: 1, of: FIRST_SERIES_GUIDE } },
        pickForMe: starterTrio(ballIds),
        line: FIRST_VISIT.play,
      };
    }
    const tip = format === 'blind' ? formatBox('blind') : undefined;
    return tip === undefined ? undefined : { tip };
  }

  /** What round 1's pick teaches: the first answer's ▲, or Showdown's first time. */
  function answerTip(state: SeriesState): CoachTip | undefined {
    if (formatOf(state.setup) === 'showdown') return formatBox('showdown');
    const shown = shownFirst(state);
    if (shown === undefined) return undefined;
    const steps = firstPickSteps(lookup.get(shown)?.name ?? shown);
    return { steps, step: { at: 2, of: FIRST_SERIES_GUIDE } };
  }

  /** The bot's ball shown first in the guided series' round 1, which the first pick answers. */
  function shownFirst(state: SeriesState): string | undefined {
    if (!guided() || formatOf(state.setup) !== FIRST_SERIES.format) return undefined;
    return state.picks.find((pick) => pick.round === 0 && pick.side === 'b')?.ball;
  }

  /** Keeps the tray and the revealed series on the device, as they are now. */
  function remember(): void {
    saveSetup(storage, revealed === undefined ? { draft } : { draft, revealed });
  }

  const to = (step: SetupStep) => (params: URLSearchParams) => {
    writeSeriesModeParams(params, format, step === 'rules' ? undefined : step, bestOf);
  };

  /** Remembers the level chosen on the lineup step (ADR 0035, 0046): Play plays it next. */
  function chooseLevel(chosen: string): void {
    level = chosen;
    saveBotLevel(storage, chosen);
  }

  const rules = createRulesStep(
    { title: 'vs Bot', formats: SETUP_FORMATS.bot, levels: true },
    {
      onBack: () => {
        host.back(() => {
          host.exit();
        });
      },
      // Each choice rewrites this entry, so Back from the lineup finds the setup as it was left.
      onChange: (chosen) => {
        ({ format, bestOf, level } = chosen);
        host.replace(to('rules'));
      },
      // Going on to the lineup makes this setup Play's (ADR 0055).
      onNext: (chosen) => {
        ({ format, bestOf, level } = chosen);
        savePlaySetup(storage, chosen);
        host.move(to('lineup'));
        open('lineup');
      },
    },
  );

  const lineup = createLineupStep(balls, {
    onBack: () => {
      draft = lineup.draft();
      // Back to the screen it came from: home from Play, the setup from the setup (ADR 0055).
      // Arriving from a link, the setup that leads to it, on the link's choices.
      host.back(() => {
        host.replace(to('rules'));
        open('rules');
      });
    },
    onLevel: chooseLevel,
    onChange: (tray) => {
      draft = tray;
      remember();
    },
    onDone: (own) => {
      draft = own;
      // The first series' seed is chosen for this lineup (ADR 0090 addendum "Tuned to teach"):
      // searched between frames, the button busy meanwhile; a seed, never a rule.
      if (!guided()) {
        startWith(own, generateSeed(), level);
        return undefined;
      }
      const opened = openings;
      const pause = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      return firstSeriesSeedSliced(
        generateSeed(),
        own,
        ballIds,
        lookup,
        () => performance.now(),
        pause,
      ).then((seed) => {
        // Left meanwhile (Back, a link): the lineup is no longer what starts.
        if (opened !== openings) return;
        startWith(own, seed, FIRST_SERIES.level);
      });
    },
  });

  /** The bot picks from the series seed, so the setup (and the link) fully decides the series. */
  function startWith(own: Lineup, seed: number, against: string): void {
    // Blind has no choices for a bot to make, so every level plays it alike: the default.
    const opponent = botOpponent(format === 'blind' ? DEFAULT_BOT.id : against, seed);
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
    teaching.delete('blind');
    host.start(setup);
  }

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
      teaching.delete(formatOf(series));
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
    openings++;
    // The screen's accessible name says its length (ADR 0048); index.html's is Best of 3's.
    root.setAttribute('aria-label', `Best of ${String(bestOf)} setup`);
    for (const [name, section] of Object.entries(steps)) section.hidden = name !== step;
    // Under the step's header: the rules and the lineup offer a held series back.
    steps[step].firstElementChild?.after(resume.element);
    resume.show(step === 'answer' ? undefined : host.held());
    if (step === 'rules') {
      revealed = undefined;
      remember();
      rules.open({ format, level, bestOf });
    } else if (step === 'lineup') {
      revealed = undefined;
      remember();
      lineup.open(format, draft, guided() ? FIRST_SERIES.level : level, bestOf);
      lineup.guide(lineupGuide());
    } else if (revealed !== undefined) {
      // The series as it starts: the toss, and the bot's shown ball when it won it. The same seeded
      // choices the series makes when it starts, so what is shown here is what plays.
      const state = resolvePicks(beginSession(revealed), botOf(revealed)).state;
      const shown = shownFirst(state);
      const best = shown === undefined ? undefined : bestAnswer(state.setup.a, shown);
      answer.open(state, answerTip(state), best);
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
