import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { describeResult } from './result-text.ts';

export interface HudActions {
  readonly onReplay: () => void;
  readonly onNewMatch: () => void;
}

export interface Hud {
  /** Syncs the HUD with the world. Cheap to call every frame: it only touches changed text. */
  update(world: WorldState, seed: number): void;
}

interface BallRow {
  readonly health: HTMLElement;
  readonly fill: HTMLElement;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Sets text only when it changed, so screen readers and layout aren't disturbed every frame. */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Builds the match HUD inside `root` with plain DOM: one row per ball (name, health), the seed,
 * and the result with Replay / New match once the match ends. All text is set with textContent.
 */
export function createHud(
  root: HTMLElement,
  initial: WorldState,
  definitions: DefinitionLookup,
  actions: HudActions,
): Hud {
  root.replaceChildren();

  const list = element('ul', 'hud-balls');
  const rows = new Map<string, BallRow>();
  for (const ball of initial.balls) {
    const definition = definitions.get(ball.definitionId);
    const item = element('li', 'hud-ball');
    item.style.setProperty('--ball-color', definition?.color ?? 'currentColor');

    const name = element('span', 'hud-ball-name', definition?.name ?? ball.id);
    const health = element('span', 'hud-ball-health');
    const track = element('div', 'hud-health-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = element('div', 'hud-health-fill');
    track.append(fill);
    item.append(name, health, track);
    list.append(item);
    rows.set(ball.id, { health, fill });
  }

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

  return {
    update(world, seed) {
      for (const ball of world.balls) {
        const row = rows.get(ball.id);
        const maxHealth = definitions.get(ball.definitionId)?.maxHealth;
        if (row === undefined || maxHealth === undefined) continue;
        setText(row.health, `${Math.ceil(ball.health)} / ${maxHealth}`);
        const percent = `${Math.max(0, (ball.health / maxHealth) * 100)}%`;
        if (row.fill.style.width !== percent) row.fill.style.width = percent;
      }
      setText(seedLine, `Seed ${seed}`);
      setText(result, describeResult(world.match, world, definitions));
      buttons.hidden = world.match.status === 'running';
    },
  };
}
