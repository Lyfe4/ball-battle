// Teaching in the arena, at the moment things happen (ADR 0036): a versus card over the intro for a
// player's first few matches, and a short label by a ball the first time this device sees its
// ability ("Lightning!"). Both are read from sim events and the definitions and the counter map,
// so they can't disagree with the fight; both are decoration (aria-hidden), and both respect
// reduced motion (arena-tips.css). Tips can be turned off in the symbol legend.
import type { Tips } from '../app/tips.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import { showsAbility } from '../render/ability-sign.ts';
import { theme } from '../render/theme.ts';
import { counterFor } from '../sim/counter-map.ts';
import type { DefinitionLookup, SimEvent, WorldState } from '../sim/types.ts';
import { MARKS } from './balls/marks.ts';
import { leanOf } from './balls/matchups.ts';
import { element } from './dom.ts';

/** How long an ability hint shows, in effect-time milliseconds. */
export const HINT_MS = 1600;
/** How much longer the intro runs while the versus card shows (presentation time, ADR 0007). */
export const VERSUS_EXTRA_MS = 1300;

export interface ArenaTips {
  /** A new match: whether its versus card shows, and how much longer its intro runs for it. */
  start(world: WorldState, teaching: boolean): number;
  /** A tick's events: the first time a ball's ability shows, its hint is due. */
  apply(events: readonly SimEvent[], world: WorldState, nowMs: number): void;
  /** Places what shows over `drawn` at `nowMs`; `introLeftMs` is the intro time still to run. */
  update(drawn: WorldState, nowMs: number, introLeftMs: number): void;
  isActive(nowMs: number): boolean;
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
  onSkip: () => void,
): ArenaTips {
  const layer = element('div', 'arena-tips');
  layer.setAttribute('aria-hidden', 'true');
  const hint = element('span', 'ability-hint');
  hint.hidden = true;
  const card = element('button', 'versus-card');
  card.type = 'button';
  // Decoration over the canvas: a tap skips it, and it never takes keyboard focus.
  card.tabIndex = -1;
  card.hidden = true;
  card.addEventListener('click', () => {
    card.hidden = true;
    onSkip();
  });
  layer.append(hint, card);
  container.append(layer);

  /** Hints due, in order: one shows at a time, so two never overlap. */
  let queue: { ballId: string; text: string }[] = [];
  let showing: { ballId: string; text: string; startMs: number } | undefined;
  let teachingNow = false;

  function fillCard(world: WorldState): void {
    const [a, b] = world.balls;
    const first = a === undefined ? undefined : lookup.get(a.definitionId);
    const second = b === undefined ? undefined : lookup.get(b.definitionId);
    if (first === undefined || second === undefined) return;
    const side = (definition: typeof first, repeat: boolean) => {
      const holder = element('span', 'versus-ball');
      const icon = element('canvas', 'versus-icon');
      drawBallIcon(icon, definition, 28, repeat);
      holder.append(icon, element('span', 'versus-name', definition.name));
      return holder;
    };
    const mirror = first.id === second.id;
    const lean = leanOf(first.id, second.id);
    const mark = element('span', 'versus-mark', mirror ? '' : MARKS[lean]);
    mark.dataset['lean'] = lean;
    const head = element('span', 'versus-head');
    head.append(side(first, false), mark, element('span', 'versus-vs', 'vs'), side(second, mirror));
    const reason = mirror
      ? 'A mirror match: same ball, same tricks.'
      : counterFor(first.id, second.id)?.reason;
    card.replaceChildren(
      head,
      element('span', 'versus-reason', reason ?? ''),
      element('span', 'versus-skip', 'Tap to skip'),
    );
  }

  return {
    start(world, teaching) {
      queue = [];
      showing = undefined;
      hint.hidden = true;
      teachingNow = teaching;
      const versus = teaching && tips.takeVersus();
      card.hidden = !versus;
      if (!versus) return 0;
      fillCard(world);
      return VERSUS_EXTRA_MS;
    },
    apply(events, world, nowMs) {
      if (!teachingNow || !tips.enabled()) return;
      for (const event of events) {
        for (const ball of world.balls) {
          const ability = lookup.get(ball.definitionId)?.ability;
          if (ability === undefined || !showsAbility(event, ball.id, ability.shownBy)) continue;
          if (tips.takeHint(ball.definitionId)) {
            queue.push({ ballId: ball.id, text: `${ability.name}!` });
          }
        }
      }
      if (showing === undefined && queue.length > 0) {
        const next = queue.shift();
        if (next !== undefined) showing = { ...next, startMs: nowMs };
      }
    },
    update(drawn, nowMs, introLeftMs) {
      // The card leaves just before the first tick, so the fight is never covered.
      if (!card.hidden && introLeftMs <= 250) card.hidden = true;
      if (showing !== undefined && nowMs - showing.startMs >= HINT_MS) {
        const next = queue.shift();
        showing = next === undefined ? undefined : { ...next, startMs: nowMs };
      }
      const ball =
        showing === undefined ? undefined : drawn.balls.find((b) => b.id === showing?.ballId);
      if (showing === undefined || ball === undefined || ball.health <= 0) {
        hint.hidden = true;
        return;
      }
      if (hint.hidden || hint.textContent !== showing.text) {
        hint.textContent = showing.text;
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
