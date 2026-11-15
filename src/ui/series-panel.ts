import {
  awaitingPick,
  bestOfOf,
  formatOf,
  nextMatch,
  remainingOf,
  firstToShowOf,
  scoreOf,
  type NextMatch,
} from '../sim/series.ts';
import { matchWorld } from '../sim/series-verify.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { createSticker } from './sticker.ts';
import { element, setAttr, setHidden, setText } from './dom.ts';
import { createPairing } from './balls/pairing.ts';
import { createLeaveConfirm } from './series/leave-confirm.ts';
import { createPickBanner } from './series/pick-banner.ts';
import { createPickRows } from './series/pick-rows.ts';
import { createSeriesBar } from './series/series-bar.ts';
import { createSeriesTrack } from './series/series-track.ts';
import { createMatchStory } from './match-story.ts';
import {
  lastPlayOf,
  seriesScreenOf,
  trackOf,
  type SeriesMoment,
  type SeriesPhase,
} from './series/series-view.ts';
import { BOT_SEATS, otherSide } from './series/seats.ts';
import {
  betweenLine,
  finalLine,
  linkPickLine,
  playingLine,
  pickLine,
  resultWords,
} from './series-text.ts';

export interface SeriesActions {
  /** Plays the next match: the next round, or a drawn round again. */
  readonly onNext: () => void;
  /** The player picked `ball` for the coming round (a Reveal or Showdown turn). */
  /** Online, a request: the ball tapped shows it is working, the rest wait (busy-button.ts). */
  readonly onPick: (ball: string) => unknown;
  /** Same lineups, new seed. */
  readonly onRematch: () => void;
  /** Back to the lineup builder. */
  readonly onNewSeries: () => void;
  /** Leaves the series before it is decided (it is held, to resume). */
  readonly onLeave: () => unknown;
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
  /**
   * An online series (ADR 0052): it goes on without this page, so leaving asks nothing, the way
   * on at the end is Home, and no replay link is offered (the series is on the server).
   */
  online = false,
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

  // The full track. While a round plays on a phone it waits under the score line (ADR 0039):
  // opened, it stays open for the rest of that round and closes when the next one starts.
  const track = createSeriesTrack(definitions);
  track.element.id = 'series-track';
  /** The round being fought (0-based), and the round the track was opened in. */
  let fought: number | undefined;
  let trackOpenFor: number | undefined;
  let drawBar = (): void => undefined;
  const toggleTrack = () => {
    trackOpenFor = trackOpenFor === undefined ? fought : undefined;
    root.toggleAttribute('data-track-open', trackOpenFor !== undefined);
    drawBar();
  };

  // What is being played, and the legend's ? for every symbol the series shows (ADR 0035).
  const bar = createSeriesBar({ id: track.element.id, onToggle: toggleTrack });

  // The result as a sticker (ADR 0055): who won, and the score from the player's side.
  const result = element('div', 'series-result');
  const sticker = createSticker();
  result.append(sticker.element);

  const banner = createPickBanner(definitions);
  const picks = createPickRows(definitions, actions.onPick);

  // How the round just played was won (ADR 0036, 0037), between rounds and at the end: last, and
  // quiet while a pick is asked for, so it never competes with the choice.
  const story = createMatchStory(definitions);

  // The next round as the ready card shows it (ADR 0038); the live status says it in words.
  const pairing = createPairing();
  pairing.element.classList.add('series-pairing');
  pairing.element.setAttribute('aria-hidden', 'true');

  const buttons = element('div', 'hud-actions');
  const next = button('Play round', 'hud-button hud-button-primary', actions.onNext);
  const rematch = button('Rematch', 'hud-button', actions.onRematch);
  const newSeries = button(
    online ? 'Home' : 'New series',
    'hud-button hud-button-primary',
    actions.onNewSeries,
  );
  // Online: why it waits, or how it ended.
  const note = element('p', 'series-note');
  buttons.append(next, rematch, newSeries);
  const share = button('Copy link', 'text-link series-share', () => {
    void copyLink();
  });
  // Leaving forgets the series (ADR 0042), so it is asked once, in place. Online it doesn't.
  const leave = createLeaveConfirm(actions.onLeave, !online);
  root.append(
    heading,
    bar.element,
    bar.legend,
    status,
    result,
    note,
    track.element,
    banner.element,
    picks.element,
    pairing.element,
    buttons,
    share,
    story.element,
  );
  exit.replaceChildren(leave.element);

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

  // The same opening world for the same play, so the story isn't reset every frame.
  let told: { readonly key: string; readonly world: WorldState } | undefined;
  function startOf(play: NextMatch): WorldState {
    const key = [play.round, play.attempt, play.seed, play.a, play.b].join(':');
    if (told?.key !== key) told = { key, world: matchWorld(play, definitions) };
    return told.world;
  }

  let phase: SeriesPhase = 'playing';
  return {
    setVisible(visible) {
      root.hidden = !visible;
      exit.hidden = !visible;
      // Leaving the screen any other way (Back) answers the question with Stay.
      if (!visible) leave.close();
    },
    focusAction() {
      if (!picks.element.hidden) picks.focus();
      else if (!next.hidden) next.focus();
      else if (!newSeries.hidden) newSeries.focus();
    },
    update(moment) {
      const { state, current, linkState } = moment;
      const seats = moment.seats ?? BOT_SEATS;
      const them = otherSide(seats.you);
      // What shows and which controls, from the pure model: never a screen with no way on.
      const screen = seriesScreenOf(moment);
      const { choice, pairing: pair, actions } = screen;
      phase = screen.phase;
      const playing = phase === 'playing';
      const finished = phase === 'finished';
      setAttr(root, 'data-phase', phase);
      // The track's open state belongs to the round being fought, so a new round starts closed.
      fought = playing ? current?.round : undefined;
      if (trackOpenFor !== fought) trackOpenFor = undefined;
      root.toggleAttribute('data-track-open', trackOpenFor !== undefined);
      const score = scoreOf(state);
      drawBar = () => {
        bar.show(
          state.setup,
          fought === undefined
            ? undefined
            : {
                round: fought,
                you: score[seats.you],
                bot: score[them],
                open: trackOpenFor !== undefined,
              },
          seats,
        );
      };
      drawBar();
      // The match just played, a drawn play included (ADR 0038).
      const last = playing ? undefined : lastPlayOf(state);
      story.show(
        last === undefined ? undefined : startOf(last),
        last === undefined ? undefined : `Round ${String(last.round + 1)}`,
        // Whose ball is whose, so even a mirror reads plainly.
        last === undefined
          ? undefined
          : (['a', 'b'] as const).map((side) =>
              side === seats.you
                ? `your ${nameOf(last[side])}`
                : `${seats.their} ${nameOf(last[side])}`,
            ),
      );
      track.update(state, trackOf(state, playing ? current : undefined, seats.you), seats);

      const dueNow = moment.due ?? [awaitingPick(state)];
      const due = playing || linkState !== undefined ? undefined : dueNow.includes(seats.you);
      const upcoming = nextMatch(state);
      const roundsPlayed = state.rounds.length;

      // The result, at the end only.
      const totals = scoreOf(state);
      const won = state.winner === seats.you;
      const words = resultWords(state.winner, seats, totals);
      setHidden(result, !finished);
      // Styled by who won from the player's side: `a` is always the player's colour.
      setAttr(result, 'data-winner', state.winner === undefined ? '' : won ? 'a' : 'b');
      if (finished) sticker.show(words);
      setAttr(result, 'aria-label', words.spoken);

      // Your pick: the banner names what is answered, the rows are the options.
      const reveal = formatOf(state.setup) === 'reveal';
      // Reveal's coin toss leads round 1's pick when the series opens here, a rematch (ADR 0041).
      const toss =
        reveal && roundsPlayed === 0 && state.pending.length === 0
          ? { first: firstToShowOf(state.setup), key: state.setup.seed }
          : undefined;
      setHidden(banner.element, !actions.includes('pick'));
      setHidden(picks.element, !actions.includes('pick'));
      if (choice !== undefined) {
        picks.show(choice, seats);
        banner.show(choice, toss, seats);
      }

      // Between rounds with nothing to decide: the next pairing, and one button to play it.
      setHidden(pairing.element, pair === undefined);
      if (pair !== undefined) {
        const known = (id: string | undefined) =>
          id === undefined ? undefined : definitions.get(id);
        pairing.show(known(pair.you), known(pair.bot));
      }
      const play = actions.includes('play');
      setHidden(next, !play);
      setText(
        next,
        state.pending.length > 0 ? '↻ Replay round' : `Play round ${String(roundsPlayed + 1)}`,
      );
      const again = actions.includes('rematch');
      const fresh = actions.includes('newSeries');
      setHidden(rematch, !again);
      setHidden(newSeries, !fresh);
      setHidden(buttons, !play && !again && !fresh);
      setHidden(share, !finished || online);
      if (!finished) setText(share, 'Copy link');
      leave.setHidden(finished || (screen.waiting && !actions.includes('leave')));
      leave.setLive(moment.online?.live === true);
      const said = playing ? undefined : moment.online?.note;
      setHidden(note, said === undefined);
      setText(note, said ?? '');

      let text = '';
      if (playing && current !== undefined) {
        text = playingLine(current, nameOf, bestOfOf(state.setup), seats);
      } else if (finished) text = finalLine(state, seats);
      else if (due === true && choice !== undefined) {
        text = pickLine(choice, roundsPlayed, remainingOf(state, them), nameOf, toss?.first, seats);
      } else if (upcoming !== undefined) text = betweenLine(state, upcoming, nameOf, seats);
      else if (linkState !== undefined) text = linkPickLine(roundsPlayed);
      else if (said !== undefined) text = said;
      setText(status, text);
      return phase;
    },
  };
}
