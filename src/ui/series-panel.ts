import { drawBallIcon } from '../render/ball-icon.ts';
import {
  awaitingPick,
  formatOf,
  nextMatch,
  remainingOf,
  revealFirst,
  scoreOf,
} from '../sim/series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import { createPickBanner } from './series/pick-banner.ts';
import { createPickRows } from './series/pick-rows.ts';
import { createSeriesTrack } from './series/series-track.ts';
import { createSymbolLegend } from './symbol-legend.ts';
import { createTossStrip } from './series/toss-strip.ts';
import {
  seriesScreenOf,
  trackOf,
  type SeriesMoment,
  type SeriesPhase,
} from './series/series-view.ts';
import {
  aboutLine,
  answerLine,
  betweenLine,
  finalLine,
  linkPickLine,
  openLine,
  playingLine,
  showLine,
} from './series-text.ts';

export interface SeriesActions {
  /** Plays the next match: the next round, or a drawn round again. */
  readonly onNext: () => void;
  /** The player picked `ball` for the coming round (a Reveal or Showdown turn). */
  readonly onPick: (ball: string) => void;
  /** Same lineups, new seed. */
  readonly onRematch: () => void;
  /** Back to the lineup builder. */
  readonly onNewSeries: () => void;
  /** Leaves the series before it is decided (it is held, to resume). */
  readonly onLeave: () => void;
}

export type { SeriesPhase } from './series/series-view.ts';

/** Where the series panel draws: the panel itself, and its way out, last under the match. */
export interface SeriesPanelRoots {
  readonly panel: HTMLElement;
  /**
   * Holds "Leave series". It sits after the health bars and speed, so while a round plays the way
   * out is at the bottom of the panel rather than between the score and the fight.
   */
  readonly exit: HTMLElement;
}

export interface SeriesPanel {
  setVisible(visible: boolean): void;
  /** Cheap to call every frame: only changed parts are touched. Returns the phase shown. */
  update(moment: SeriesMoment): SeriesPhase;
  /** Focuses what the player does next: a pick, Play round, or New series. */
  focusAction(): void;
}

const PAIR_PX = 56;

/**
 * The best-of-3 screens, visual first (ADR 0025). While a round is fought: the track under the
 * arena. Between rounds (the arena makes way): the track, then either "Your pick" with one row
 * per option, or the next pairing large with Play round. At the end: who won, the score, every
 * round on the track, Rematch and New series. The sentences of series-text.ts are kept for screen
 * readers, in a live region.
 */
export function createSeriesPanel(
  roots: SeriesPanelRoots,
  definitions: DefinitionLookup,
  actions: SeriesActions,
): SeriesPanel {
  const { panel: root, exit } = roots;
  root.replaceChildren();
  root.className = 'series';
  const nameOf = (id: string) => definitions.get(id)?.name ?? id;

  const headingId = 'series-heading';
  root.setAttribute('aria-labelledby', headingId);
  const heading = element('h2', 'visually-hidden', 'Best of 3');
  heading.id = headingId;
  // Announced when it changes: the round starting, a result, a pick due, the series result.
  const status = element('p', 'visually-hidden');
  status.setAttribute('aria-live', 'polite');

  // What is being played, and the legend's ? for every symbol the series shows (ADR 0035).
  const bar = element('div', 'series-bar');
  const about = element('p', 'series-bar-about');
  const legend = createSymbolLegend();
  bar.append(about, legend.toggle);

  const result = element('p', 'series-result');
  const track = createSeriesTrack(definitions);

  // Reveal's coin toss, over round 1 when the series opens here (a rematch).
  const toss = createTossStrip();
  const banner = createPickBanner(definitions);
  const picks = createPickRows(definitions, actions.onPick);

  const pairing = element('div', 'series-pairing');
  pairing.setAttribute('aria-hidden', 'true');
  const pairYou = element('span', 'series-pairing-ball');
  const pairBot = element('span', 'series-pairing-ball');
  pairing.append(pairYou, element('span', 'series-pairing-vs', 'vs'), pairBot);

  const buttons = element('div', 'hud-actions');
  const next = button('Play round', 'hud-button hud-button-primary', actions.onNext);
  const rematch = button('Rematch', 'hud-button', actions.onRematch);
  const newSeries = button('New series', 'hud-button hud-button-primary', actions.onNewSeries);
  buttons.append(next, rematch, newSeries);
  const share = button('Copy link', 'text-link series-share', () => {
    void copyLink();
  });
  const leave = button('Leave series', 'text-link series-leave', actions.onLeave);
  root.append(
    heading,
    bar,
    legend.panel,
    status,
    result,
    toss.element,
    track.element,
    banner.element,
    picks.element,
    pairing,
    buttons,
    share,
  );
  exit.replaceChildren(leave);

  function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  /** The finished series' link (already in the address bar) to the clipboard. */
  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setText(share, 'Link copied');
    } catch {
      // No clipboard (an insecure context, or refused): the address bar still holds the link.
      setText(share, 'Copy the address bar to share');
    }
  }

  let pairKey = '';
  function showPairing(you: string | undefined, bot: string | undefined): void {
    const key = `${you ?? '?'}>${bot ?? '?'}`;
    if (key === pairKey) return;
    pairKey = key;
    const ball = (holder: HTMLElement, id: string | undefined, repeat = false) => {
      const known = id === undefined ? undefined : definitions.get(id);
      if (known === undefined) {
        holder.replaceChildren(element('span', 'series-pairing-unknown', '?'));
        return;
      }
      const canvas = element('canvas', '');
      drawBallIcon(canvas, known, PAIR_PX, repeat);
      holder.replaceChildren(canvas);
    };
    ball(pairYou, you);
    // A mirror round: the bot's ball drawn lighter, as in the arena.
    ball(pairBot, bot, bot !== undefined && bot === you);
  }

  let phase: SeriesPhase = 'playing';
  return {
    setVisible(visible) {
      root.hidden = !visible;
      exit.hidden = !visible;
    },
    focusAction() {
      if (!picks.element.hidden) picks.focus();
      else if (!next.hidden) next.focus();
      else if (!newSeries.hidden) newSeries.focus();
    },
    update(moment) {
      const { state, current, linkState } = moment;
      // What shows and which controls, from the pure model: never a screen with no way on.
      const screen = seriesScreenOf(moment);
      const { choice, pairing: pair, actions } = screen;
      phase = screen.phase;
      const playing = phase === 'playing';
      const finished = phase === 'finished';
      root.dataset['phase'] = phase;
      setText(about, aboutLine(state.setup));
      track.update(state, trackOf(state, playing ? current : undefined));

      const due = playing || linkState !== undefined ? undefined : awaitingPick(state);
      const upcoming = nextMatch(state);
      const roundsPlayed = state.rounds.length;

      // The result headline, at the end only.
      const { a, b } = scoreOf(state);
      result.hidden = !finished;
      result.dataset['winner'] = state.winner ?? '';
      setText(result, state.winner === 'a' ? 'You win' : 'Bot wins');
      result.setAttribute(
        'aria-label',
        `${state.winner === 'a' ? 'You win' : 'Bot wins'} ${String(a)}–${String(b)}`,
      );

      // Your pick: the banner names what is answered, the rows are the options.
      const reveal = formatOf(state.setup) === 'reveal';
      // The toss stays over round 1 until it is played.
      toss.element.hidden = !reveal || playing || roundsPlayed > 0 || state.pending.length > 0;
      if (!toss.element.hidden) toss.show(revealFirst(state.setup.seed), state.setup.seed);
      banner.element.hidden = !actions.includes('pick');
      picks.element.hidden = !actions.includes('pick');
      if (choice !== undefined) {
        picks.show(choice);
        banner.show(choice);
      }

      // Between rounds with nothing to decide: the next pairing, and one button to play it.
      pairing.hidden = pair === undefined;
      if (pair !== undefined) showPairing(pair.you, pair.bot);
      next.hidden = !actions.includes('play');
      setText(
        next,
        state.pending.length > 0 ? '↻ Replay round' : `Play round ${String(roundsPlayed + 1)}`,
      );
      rematch.hidden = !actions.includes('rematch');
      newSeries.hidden = !actions.includes('newSeries');
      buttons.hidden = next.hidden && rematch.hidden && newSeries.hidden;
      share.hidden = !finished;
      if (!finished) setText(share, 'Copy link');
      leave.hidden = finished;

      let text = '';
      if (playing && current !== undefined) text = playingLine(current, nameOf);
      else if (finished) text = finalLine(state);
      else if (due === 'a' && choice?.facing !== undefined) {
        text = answerLine(roundsPlayed, choice.facing, nameOf);
      } else if (due === 'a' && choice?.kind === 'open') {
        text = openLine(remainingOf(state, 'b'), nameOf);
      } else if (due === 'a') text = showLine(roundsPlayed, remainingOf(state, 'b'), nameOf);
      else if (upcoming !== undefined) text = betweenLine(state, upcoming, nameOf);
      else if (linkState !== undefined) text = linkPickLine(roundsPlayed);
      setText(status, text);
      return phase;
    },
  };
}
