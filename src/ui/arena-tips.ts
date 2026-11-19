// Teaching in the arena, at the moment things happen (ADR 0036): a short label by a ball the first
// time this device sees its ability ("Lightning!"), under a small "Tip" so it reads as the game
// teaching, never as something gone wrong. Read from sim events and the definitions, so it
// can't disagree with the fight; decoration (aria-hidden) that respects reduced motion
// (arena-tips.css). Hints can be turned off in settings (ADR 0040). The pairing's "what to watch"
// is the ready card's (ready-card.ts, ADR 0037).
import type { Tips } from '../app/tips.ts';
import { showsAbility } from '../render/ability-sign.ts';
import { theme } from '../render/theme.ts';
import { sideOf } from '../sim/side.ts';
import type { BallState, DefinitionLookup, SimEvent, WorldState } from '../sim/types.ts';
import { element, setHidden } from './dom.ts';

/** How long an ability hint shows, in effect-time milliseconds. */
export const HINT_MS = 1600;

export interface ArenaTips {
  /** A new match: whether hints show in it (never in the home demo). */
  start(teaching: boolean): void;
  /** A tick's events: the first time a ball's ability shows, its hint is due. */
  apply(events: readonly SimEvent[], world: WorldState, nowMs: number): void;
  /** Places the hint over `drawn` at `nowMs`. */
  update(drawn: WorldState, nowMs: number): void;
  isActive(nowMs: number): boolean;
}

interface Hint {
  readonly ballId: string;
  /** Its ball's definition id: the key it was taken under. */
  readonly key: string;
  readonly text: string;
}

/**
 * The ball a hint shows over: its own ball while it is in the fight, else another of the same kind
 * on its side (a Slime's surviving half), else none.
 */
function hintBall(hint: Hint, balls: readonly BallState[]): BallState | undefined {
  const own = balls.find((ball) => ball.id === hint.ballId);
  if (own !== undefined && own.health > 0) return own;
  const side = own === undefined ? hint.ballId : sideOf(own);
  return balls.find(
    (ball) => ball.health > 0 && ball.definitionId === hint.key && sideOf(ball) === side,
  );
}

/** Where a world point sits over the arena, as a share of its box (the rim is outside 0..size). */
function placeOf(world: WorldState, x: number, y: number): { left: number; top: number } {
  const total = world.arena.size + theme.arenaBorderWidth * 2;
  return {
    left: ((x + theme.arenaBorderWidth) / total) * 100,
    top: ((y + theme.arenaBorderWidth) / total) * 100,
  };
}

export function createArenaTips(
  container: HTMLElement,
  lookup: DefinitionLookup,
  tips: Tips,
): ArenaTips {
  const layer = element('div', 'arena-tips');
  layer.setAttribute('aria-hidden', 'true');
  const hint = element('span', 'ability-hint');
  hint.hidden = true;
  const name = element('span', 'ability-hint-name');
  hint.append(element('span', 'ability-hint-label', 'Tip'), name);
  layer.append(hint);
  container.append(layer);

  /** Hints due, in order: one shows at a time, so two never overlap. */
  let queue: Hint[] = [];
  let showing: (Hint & { startMs: number }) | undefined;
  let teachingNow = false;

  /**
   * The next hint whose ball is still there to show it over. One with nothing left to point at
   * (knocked out while it waited behind another) is given back, not lost: it shows next time.
   */
  const nextFor = (balls: readonly BallState[], nowMs: number) => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      if (hintBall(next, balls) !== undefined) return { ...next, startMs: nowMs };
      tips.giveBackHint(next.key);
    }
    return undefined;
  };

  return {
    start(teaching) {
      // Hints still waiting when a fight ends were never seen.
      for (const waiting of queue) tips.giveBackHint(waiting.key);
      queue = [];
      showing = undefined;
      hint.hidden = true;
      teachingNow = teaching;
    },
    apply(events, world, nowMs) {
      if (!teachingNow || !tips.enabled()) return;
      for (const event of events) {
        for (const ball of world.balls) {
          const ability = lookup.get(ball.definitionId)?.ability;
          if (ability === undefined || !showsAbility(event, ball.id, ability.shownBy)) continue;
          if (tips.takeHint(ball.definitionId)) {
            queue.push({ ballId: ball.id, key: ball.definitionId, text: `${ability.name}!` });
          }
        }
      }
      showing ??= nextFor(world.balls, nowMs);
    },
    update(drawn, nowMs) {
      if (showing !== undefined && nowMs - showing.startMs >= HINT_MS) {
        showing = nextFor(drawn.balls, nowMs);
      }
      const ball = showing === undefined ? undefined : hintBall(showing, drawn.balls);
      if (showing === undefined || ball === undefined) {
        setHidden(hint, true);
        return;
      }
      if (hint.hidden || name.textContent !== showing.text) {
        name.textContent = showing.text;
        hint.hidden = false;
        // Restart the pop for a new label.
        hint.classList.remove('ability-hint-pop');
        hint.getBoundingClientRect();
        hint.classList.add('ability-hint-pop');
      }
      // Above the ball's health pill, or below the ball near the top wall; kept inside the court.
      const above = ball.position.y - ball.radius - theme.healthBarGap * 2 - theme.healthBarHeight;
      const y = above > ball.radius ? above : ball.position.y + ball.radius + theme.healthBarGap;
      const at = placeOf(drawn, ball.position.x, y);
      hint.style.left = `${Math.min(88, Math.max(12, at.left)).toFixed(2)}%`;
      hint.style.top = `${at.top.toFixed(2)}%`;
      hint.dataset['below'] = String(above <= ball.radius);
      const left = 1 - (nowMs - showing.startMs) / HINT_MS;
      hint.style.opacity = String(Math.min(1, left * 4));
    },
    isActive(nowMs) {
      return (showing !== undefined && nowMs - showing.startMs < HINT_MS) || queue.length > 0;
    },
  };
}
