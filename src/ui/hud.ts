import { ballColor, isRepeatOfEarlierBall } from '../render/ball-colors.ts';
import { readableOn } from '../render/contrast.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import { createMatchStory } from './match-story.ts';
import { describeResult } from './result-text.ts';

export interface HudActions {
  readonly onReplay: () => void;
  readonly onNewMatch: () => void;
}

export interface Hud {
  /** Rebuilds the ball rows for a new matchup. Call when a match starts. */
  setMatch(world: WorldState): void;
  /**
   * Syncs the HUD with the world. Cheap to call every frame: it only touches changed text. The
   * result and its buttons wait for showResult, so the knockout sequence plays first.
   */
  update(world: WorldState, showResult: boolean): void;
  /**
   * Series mode: rows are labelled You / Bot instead of A / B, and Replay / New match are hidden
   * (the series panel offers its own buttons). Takes effect at the next setMatch / update.
   */
  setSeriesMode(on: boolean): void;
}

interface BallRow {
  readonly item: HTMLElement;
  readonly outcome: HTMLElement;
  readonly health: HTMLElement;
  readonly fill: HTMLElement;
  readonly ghost: HTMLElement;
}

/** The page colour the HUD sits on (tokens.css --color-page), read from the page's styles. */
function pageColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim();
}

/** A ball's colour made readable as text on `background`; unchanged if either isn't #rrggbb. */
function textColorOn(color: string, background: string): string {
  const hex = /^#[0-9a-f]{6}$/i;
  return hex.test(color) && hex.test(background) ? readableOn(color, background) : color;
}

/** Slot labels, so mirror matches (two identical balls) are still told apart. */
const SIDES = ['A', 'B'];
const SERIES_SIDES = ['You', 'Bot'];

/**
 * Builds the match HUD inside `root` with plain DOM: one row per ball (side, name, a health bar,
 * the number for screen readers only) and, once the match ends, the outcome on the rows themselves
 * (the winner's marked Wins, the loser's dimmed; ADR 0025) with Replay / New match. The seed is in
 * the link, not on screen. All text is set with textContent.
 */
export function createHud(
  root: HTMLElement,
  definitions: DefinitionLookup,
  actions: HudActions,
): Hud {
  root.replaceChildren();

  const list = element('ul', 'hud-balls');
  const rows = new Map<string, BallRow>();
  // Live region exists (empty) from the start so the result is announced when it appears. The
  // rows show it; the sentence is for screen readers.
  const result = element('p', 'hud-result visually-hidden');
  result.setAttribute('aria-live', 'polite');

  const buttons = element('div', 'hud-actions');
  const replay = element('button', 'hud-button', 'Replay');
  replay.type = 'button';
  replay.addEventListener('click', actions.onReplay);
  const newMatch = element('button', 'hud-button hud-button-primary', 'New match');
  newMatch.type = 'button';
  newMatch.addEventListener('click', actions.onNewMatch);
  buttons.append(replay, newMatch);

  // How it was won (ADR 0036), under a finished quick match; a series tells each round itself.
  const story = createMatchStory(definitions);
  /** A Free play mirror's two balls, told apart as the HUD's slots are: "Titan A", "Titan B". */
  const mirrorNames = (world: WorldState | undefined): readonly string[] | undefined => {
    const [a, b] = world?.balls ?? [];
    if (a === undefined || a.definitionId !== b?.definitionId) return undefined;
    const name = definitions.get(a.definitionId)?.name ?? a.definitionId;
    return [`${name} A`, `${name} B`];
  };
  root.append(list, result, buttons, story.element);
  let seriesMode = false;
  let start: WorldState | undefined;

  return {
    setSeriesMode(on) {
      seriesMode = on;
    },
    setMatch(world) {
      start = world;
      list.replaceChildren();
      rows.clear();
      world.balls.forEach((ball, index) => {
        const definition = definitions.get(ball.definitionId);
        const item = element('li', 'hud-ball');
        // Same shade as the canvas, so a mirror match's B row matches the lighter ball B.
        const color =
          definition === undefined
            ? 'currentColor'
            : ballColor(definition.color, isRepeatOfEarlierBall(world.balls, index));
        item.style.setProperty('--ball-color', color);
        // The name is text, so it takes a shade of the ball's colour readable on the page; the
        // bar keeps the ball's own colour.
        item.style.setProperty('--ball-text', textColorOn(color, pageColor()));

        const name = element('span', 'hud-ball-name');
        name.append(
          element(
            'span',
            'hud-ball-side',
            (seriesMode ? SERIES_SIDES : SIDES)[index] ?? String(index + 1),
          ),
          definition?.name ?? ball.id,
        );
        const outcome = element('span', 'hud-ball-outcome');
        outcome.setAttribute('aria-hidden', 'true');
        const health = element('span', 'hud-ball-health visually-hidden');
        const track = element('div', 'hud-health-track');
        track.setAttribute('aria-hidden', 'true');
        // The ghost trails the fill (CSS transition), showing health just lost.
        const ghost = element('div', 'hud-health-ghost');
        const fill = element('div', 'hud-health-fill');
        track.append(ghost, fill);
        item.append(name, outcome, health, track);
        list.append(item);
        rows.set(ball.id, { item, outcome, health, fill, ghost });
      });
    },
    update(world, showResult) {
      const finished = world.match.status === 'finished' && showResult;
      const ending = world.match.status === 'finished' ? world.match.result : undefined;
      for (const ball of world.balls) {
        const row = rows.get(ball.id);
        const maxHealth = definitions.get(ball.definitionId)?.maxHealth;
        if (row === undefined || maxHealth === undefined) continue;
        setText(row.health, `${Math.ceil(ball.health)} / ${maxHealth}`);
        const percent = `${Math.max(0, (ball.health / maxHealth) * 100)}%`;
        if (row.fill.style.width !== percent) row.fill.style.width = percent;
        if (row.ghost.style.width !== percent) row.ghost.style.width = percent;
        const outcome = !finished
          ? ''
          : ending?.kind === 'draw'
            ? 'draw'
            : ending?.kind === 'win' && ending.winnerId === ball.id
              ? 'won'
              : 'lost';
        if (row.item.dataset['outcome'] !== outcome) row.item.dataset['outcome'] = outcome;
        setText(row.outcome, outcome === 'won' ? 'Wins' : outcome === 'draw' ? 'Draw' : '');
      }
      setText(result, finished ? describeResult(world.match, world, definitions) : '');
      buttons.hidden = !finished || seriesMode;
      // Replayed between frames from the moment the fight ends, so it is told by the time the
      // result shows (and the series panel's copy of the same round is told with it).
      if (start !== undefined && world.match.status === 'finished') story.prepare(start);
      story.show(finished && !seriesMode ? start : undefined, undefined, mirrorNames(start));
    },
  };
}
