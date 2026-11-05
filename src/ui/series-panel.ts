import { drawBallIcon } from '../render/ball-icon.ts';
import {
  awaitingPick,
  formatOf,
  nextBallOf,
  nextMatch,
  remainingOf,
  scoreOf,
  type NextMatch,
  type SeriesState,
} from '../sim/series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import { createPickRows } from './series/pick-rows.ts';
import { createSeriesTrack } from './series/series-track.ts';
import { pairingOf, pickChoiceOf, trackOf } from './series/series-view.ts';
import {
  betweenLine,
  botPicksLine,
  finalLine,
  linkPickLine,
  pickLine,
  playingLine,
  revealShowLine,
} from './series-text.ts';

export interface SeriesActions {
  /** Plays the next match: the next round, or a drawn round again. */
  readonly onNext: () => void;
  /** The player picked `ball` for the coming round (loser picks next, a reveal turn). */
  readonly onPick: (ball: string) => void;
  /** Same lineups, new seed. */
  readonly onRematch: () => void;
  /** Back to the lineup builder. */
  readonly onNewSeries: () => void;
  /** Leaves the series before it is decided (it is held, to resume). */
  readonly onLeave: () => void;
}

export interface SeriesView {
  readonly state: SeriesState;
  /** The match on screen, if any. */
  readonly current: NextMatch | undefined;
  /** True once the match on screen has ended and its result is showing. */
  readonly settled: boolean;
  /** A replayed link holds the pick that is due, so Next round makes it rather than the player. */
  readonly linkPickDue: boolean;
}

/** Where the series is: a round being fought, the screen between rounds, or the result. */
export type SeriesPhase = 'playing' | 'between' | 'finished';

export interface SeriesPanel {
  setVisible(visible: boolean): void;
  /** Cheap to call every frame: only changed parts are touched. Returns the phase shown. */
  update(view: SeriesView): SeriesPhase;
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
  root: HTMLElement,
  definitions: DefinitionLookup,
  actions: SeriesActions,
): SeriesPanel {
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

  const result = element('p', 'series-result');
  const track = createSeriesTrack(definitions);

  const banner = element('p', 'series-banner', 'Your pick');
  banner.setAttribute('aria-hidden', 'true');
  const bannerFace = element('canvas', 'series-banner-icon');
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
    status,
    result,
    track.element,
    banner,
    picks.element,
    pairing,
    buttons,
    share,
    leave,
  );

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

  let bannerBall = '';
  let phase: SeriesPhase = 'playing';
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    focusAction() {
      if (!picks.element.hidden) picks.focus();
      else if (!next.hidden) next.focus();
      else if (!newSeries.hidden) newSeries.focus();
    },
    update({ state, current, settled, linkPickDue }) {
      const playing = current !== undefined && !settled;
      const finished = state.winner !== undefined && !playing;
      phase = playing ? 'playing' : finished ? 'finished' : 'between';
      root.dataset['phase'] = phase;
      track.update(state, trackOf(state, playing ? current : undefined));

      const due = playing || linkPickDue ? undefined : awaitingPick(state);
      const choice = due === 'a' ? pickChoiceOf(state) : undefined;
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
      banner.hidden = choice === undefined;
      picks.element.hidden = choice === undefined;
      if (choice !== undefined) {
        picks.show(choice);
        const face = choice.kind === 'answer' ? choice.options[0]?.faces[0] : undefined;
        const bannerKey = `${choice.kind}:${face ?? ''}`;
        if (bannerKey !== bannerBall) {
          bannerBall = bannerKey;
          const known = face === undefined ? undefined : definitions.get(face);
          if (known !== undefined) drawBallIcon(bannerFace, known, 20);
          banner.replaceChildren(
            choice.kind === 'answer' ? 'Your pick: answer ' : 'Your pick: show first',
            ...(known === undefined ? [] : [bannerFace]),
          );
        }
      }

      // Between rounds with nothing to decide: the next pairing, and one button to play it.
      const pair = !playing && !finished && choice === undefined ? pairingOf(state) : undefined;
      pairing.hidden = pair === undefined;
      if (pair !== undefined) showPairing(pair.you, pair.bot);
      next.hidden = pair === undefined;
      setText(
        next,
        state.pending.length > 0 ? '↻ Replay round' : `Play round ${String(roundsPlayed + 1)}`,
      );
      rematch.hidden = !finished;
      newSeries.hidden = !finished;
      buttons.hidden = next.hidden && !finished;
      share.hidden = !finished;
      if (!finished) setText(share, 'Copy link');
      leave.hidden = finished;

      const reveal = formatOf(state.setup) === 'reveal';
      let text = '';
      if (playing) text = playingLine(current, nameOf);
      else if (finished) text = finalLine(state);
      else if (due === 'a' && reveal && choice?.kind === 'show') {
        text = revealShowLine(roundsPlayed, remainingOf(state, 'b'), nameOf);
      } else if (due === 'a') text = pickLine(roundsPlayed, nextBallOf(state, 'b') ?? '', nameOf);
      else if (due === 'b') text = botPicksLine(roundsPlayed, nextBallOf(state, 'a') ?? '', nameOf);
      else if (upcoming !== undefined) text = betweenLine(state, upcoming, nameOf);
      else if (linkPickDue) text = linkPickLine(roundsPlayed);
      setText(status, text);
      return phase;
    },
  };
}
