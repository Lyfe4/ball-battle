// Setting up a best-of-3 series (ADR 0017, 0019), one job per screen: the rules, the lineup and, in
// reveal-then-order, the order once both lineups are revealed. Each step is a history entry
// (`?mode=bo3&step=...`), so Back walks back through them. The bot's lineup lives here, in memory
// only, until the series starts: it is never written to the URL before the series is decided.
import { generateSeed } from './app/seed.ts';
import { writeSeriesModeParams, type SeriesLink } from './app/series-url.ts';
import { randomBot } from './sim/bot.ts';
import type { Format, Lineup, SeriesSetup } from './sim/series.ts';
import type { BallDefinition } from './sim/types.ts';
import type { Draft } from './ui/lineup-draft.ts';
import { createLineupStep } from './ui/series/lineup-step.ts';
import { createOrderStep } from './ui/series/order-step.ts';
import { createRulesStep } from './ui/series/rules-step.ts';

export type SetupStep = 'rules' | 'lineup' | 'order';

export interface SeriesSetupHost {
  push(write: (params: URLSearchParams) => void): void;
  replace(write: (params: URLSearchParams) => void): void;
  /** In-app Back: the previous screen, or `toParent` when the visitor arrived here from a link. */
  back(toParent: () => void): void;
  /** Leaves Best of 3 for the parent screen (the first step's Back, arriving from a link). */
  exit(): void;
  /** The setup is complete: play the series. */
  start(setup: SeriesSetup): void;
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
  /** Reveal, then order: the series seed and both lineups as revealed, while the player orders. */
  let revealed: { readonly seed: number; readonly bot: Lineup; readonly own: Lineup } | undefined;

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
      host.push(to('lineup'));
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
    onDone: (own) => {
      draft = own;
      // The bot picks from the series seed, so the setup (and the link) fully decides the series.
      const seed = generateSeed();
      const bot = randomBot.pickLineup(seed, ballIds);
      if (format === 'reveal') {
        revealed = { seed, bot, own };
        host.push(to('order'));
        open('order');
        return;
      }
      host.start({ seed, a: own, b: bot, ...(format === 'blind' ? {} : { format }) });
    },
  });

  const order = createOrderStep(balls, {
    onBack: () => {
      host.back(() => {
        host.replace(to('lineup'));
        open('lineup');
      });
    },
    onLock: (ordered) => {
      if (revealed === undefined) return;
      const { seed, bot, own } = revealed;
      draft = ordered;
      // The bot orders against the lineup as revealed, never the player's secret order.
      host.start({ seed, a: ordered, b: randomBot.orderLineup(seed, bot, own), format: 'reveal' });
    },
  });

  const steps: Readonly<Record<SetupStep, HTMLElement>> = {
    rules: rules.element,
    lineup: lineup.element,
    order: order.element,
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
      order.open(revealed.own, revealed.bot);
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
      if (step === 'order' && revealed === undefined) {
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
