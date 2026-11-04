import { ballColor, isRepeatOfEarlierBall } from '../render/ball-colors.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { element, setText } from './dom.ts';
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
  update(world: WorldState, seed: number, showResult: boolean): void;
  /**
   * Series mode: rows are labelled You / Bot instead of A / B, and Replay / New match are hidden
   * (the series panel offers its own buttons). Takes effect at the next setMatch / update.
   */
  setSeriesMode(on: boolean): void;
}

interface BallRow {
  readonly health: HTMLElement;
  readonly fill: HTMLElement;
  readonly ghost: HTMLElement;
}

/** Slot labels, so mirror matches (two identical balls) are still told apart. */
const SIDES = ['A', 'B'];
const SERIES_SIDES = ['You', 'Bot'];

/**
 * Builds the match HUD inside `root` with plain DOM: one row per ball (side, name, health), the
 * seed, and the result with Replay / New match once the match ends. All text is set with
 * textContent.
 */
export function createHud(
  root: HTMLElement,
  definitions: DefinitionLookup,
  actions: HudActions,
): Hud {
  root.replaceChildren();

  const list = element('ul', 'hud-balls');
  const rows = new Map<string, BallRow>();
  const seedLine = element('p', 'hud-seed');
  // Live region exists (empty) from the start so the result is announced when it appears.
  const result = element('p', 'hud-result');
  result.setAttribute('aria-live', 'polite');

  const buttons = element('div', 'hud-actions');
  const replay = element('button', 'hud-button', 'Replay');
  replay.type = 'button';
  replay.addEventListener('click', actions.onReplay);
  const newMatch = element('button', 'hud-button hud-button-primary', 'New match');
  newMatch.type = 'button';
  newMatch.addEventListener('click', actions.onNewMatch);
  buttons.append(replay, newMatch);

  root.append(list, result, buttons, seedLine);
  let seriesMode = false;

  return {
    setSeriesMode(on) {
      seriesMode = on;
    },
    setMatch(world) {
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

        const name = element('span', 'hud-ball-name');
        name.append(
          element(
            'span',
            'hud-ball-side',
            (seriesMode ? SERIES_SIDES : SIDES)[index] ?? String(index + 1),
          ),
          definition?.name ?? ball.id,
        );
        const health = element('span', 'hud-ball-health');
        const track = element('div', 'hud-health-track');
        track.setAttribute('aria-hidden', 'true');
        // The ghost trails the fill (CSS transition), showing health just lost.
        const ghost = element('div', 'hud-health-ghost');
        const fill = element('div', 'hud-health-fill');
        track.append(ghost, fill);
        item.append(name, health, track);
        list.append(item);
        rows.set(ball.id, { health, fill, ghost });
      });
    },
    update(world, seed, showResult) {
      for (const ball of world.balls) {
        const row = rows.get(ball.id);
        const maxHealth = definitions.get(ball.definitionId)?.maxHealth;
        if (row === undefined || maxHealth === undefined) continue;
        setText(row.health, `${Math.ceil(ball.health)} / ${maxHealth}`);
        const percent = `${Math.max(0, (ball.health / maxHealth) * 100)}%`;
        if (row.fill.style.width !== percent) row.fill.style.width = percent;
        if (row.ghost.style.width !== percent) row.ghost.style.width = percent;
      }
      setText(seedLine, `Seed ${seed}`);
      const finished = world.match.status === 'finished' && showResult;
      setText(result, finished ? describeResult(world.match, world, definitions) : '');
      buttons.hidden = !finished || seriesMode;
    },
  };
}
