import type { Matchup } from '../app/matchup.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createBallGrid } from './balls/ball-grid.ts';
import type { BallInfoLink } from './balls/ball-link.ts';
import { LEAN_WORDS, MARKS } from './balls/marks.ts';
import { leanOf } from './balls/matchups.ts';
import { verdictOf } from './balls/verdict.ts';
import { element, setText } from './dom.ts';
import { createScreenHeader } from './screen-header.ts';

export interface QuickSetupActions {
  readonly onStart: (matchup: Matchup) => void;
  /** The picks changed (so the URL can keep them across a reload). */
  readonly onChange: (matchup: Matchup) => void;
  readonly onBack: () => void;
  /** Each slot's ⓘ: the ball's manual entry. */
  readonly ballLink: BallInfoLink;
}

export interface QuickSetup {
  setVisible(visible: boolean): void;
  /**
   * Fills both slots and makes A the slot a tap fills. Focus goes to the heading, or to Start when
   * the balls were chosen for the player (Free play on the home screen).
   */
  open(matchup: Matchup, focus?: 'heading' | 'start'): void;
}

type Slot = 'a' | 'b';
const SLOT_ICON_PX = 32;
const LEGEND_ICON_PX = 16;
const SLOT_NAMES: Readonly<Record<Slot, string>> = { a: 'Ball A', b: 'Ball B' };

/**
 * Choosing the two balls of a quick match, phone first and showing little (ADR 0025): the two
 * slots, each marked ▲ / ▼ / = for how it fares against the other, why behind one tap, every ball
 * as a tile, and Start. A tap fills the slot that is active; filling A moves on to B. Tiles are
 * marked against the ball in the other slot, so players learn counters while they pick. A slot's ⓘ
 * opens its ball's manual entry for everything else.
 */
export function createQuickSetup(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  actions: QuickSetupActions,
): QuickSetup {
  root.replaceChildren();
  root.classList.add('quick-setup');
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const first = balls[0];
  if (first === undefined) throw new Error('The quick-match setup needs at least one ball');
  const picks: Record<Slot, string> = { a: first.id, b: first.id };
  let active: Slot = 'a';

  const header = createScreenHeader('Free play', 'Back', actions.onBack, { legend: true });

  const slotRow = element('div', 'quick-slots');
  slotRow.setAttribute('role', 'group');
  slotRow.setAttribute('aria-label', 'Slot to fill');
  const slots = (['a', 'b'] as const).map((slot) => {
    const holder = element('div', 'quick-slot-holder');
    const button = element('button', 'quick-slot');
    button.type = 'button';
    const badge = element('span', 'quick-slot-badge');
    const icon = element('canvas', 'quick-slot-icon');
    const art = element('span', 'quick-slot-art');
    art.setAttribute('aria-hidden', 'true');
    art.append(icon, badge);
    const name = element('span', 'quick-slot-name');
    button.append(art, name);
    button.addEventListener('click', () => {
      active = slot;
      render();
      grid.focus(picks[slot]);
    });
    const about = element('a', 'quick-slot-about', 'ⓘ');
    about.addEventListener('click', (event) => {
      // A modified click (new tab, new window) follows the href as a link does.
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      actions.ballLink.open(picks[slot]);
    });
    holder.append(button, about);
    return { slot, holder, button, icon, badge, name, about };
  });
  const [slotA, slotB] = slots;
  if (slotA === undefined || slotB === undefined) throw new Error('expected two slots');
  slotRow.append(slotA.holder, element('span', 'quick-vs', 'vs'), slotB.holder);

  // Why the counter map leans this way: one tap away, announced when the pair changes.
  const why = element('details', 'quick-why');
  const whySummary = element('summary', 'quick-why-summary');
  whySummary.setAttribute('aria-live', 'polite');
  const whyReason = element('p', 'quick-why-reason');
  why.append(whySummary, whyReason);

  const grid = createBallGrid(balls, {
    label: 'Balls',
    onPick: (id) => {
      picks[active] = id;
      if (active === 'a') active = 'b';
      render();
      actions.onChange({ ...picks });
    },
  });

  // What the tiles' marks are against: the ball in the other slot, as its drawing.
  const legend = element('p', 'quick-legend');
  legend.setAttribute('aria-hidden', 'true');
  const legendIcon = element('canvas', 'quick-legend-icon');
  legend.append(`${MARKS.favoured} ${MARKS.unfavoured} vs `, legendIcon);

  const start = element('button', 'hud-button hud-button-primary quick-start', 'Start match');
  start.type = 'button';
  start.addEventListener('click', () => {
    actions.onStart({ ...picks });
  });
  const footer = element('div', 'screen-footer');
  footer.append(start);

  root.append(header.element, slotRow, why, legend, grid.element, footer);

  function render(): void {
    const { headline, reason } = verdictOf(picks.a, picks.b, nameOf);
    for (const { slot, button, icon, badge, name, about } of slots) {
      const ball = byId.get(picks[slot]);
      if (ball === undefined) continue;
      const other = picks[slot === 'a' ? 'b' : 'a'];
      const lean = leanOf(ball.id, other);
      setText(name, ball.name);
      setText(badge, MARKS[lean]);
      badge.dataset['lean'] = lean;
      button.setAttribute('aria-pressed', String(slot === active));
      button.setAttribute(
        'aria-label',
        `${SLOT_NAMES[slot]}: ${ball.name}, ${LEAN_WORDS[lean]} ${nameOf(other)}`,
      );
      about.href = actions.ballLink.href(ball.id);
      about.setAttribute('aria-label', `About ${ball.name}`);
      // Ball B in a mirror match is drawn lighter, as in the arena and the HUD.
      drawBallIcon(icon, ball, SLOT_ICON_PX, slot === 'b' && picks.a === picks.b);
    }
    const other = active === 'a' ? picks.b : picks.a;
    grid.update({
      pressed: [picks[active]],
      marks: {
        against: nameOf(other),
        leans: new Map(balls.map((ball) => [ball.id, leanOf(ball.id, other)])),
      },
    });
    const otherBall = byId.get(other);
    if (otherBall !== undefined) drawBallIcon(legendIcon, otherBall, LEGEND_ICON_PX);
    setText(whySummary, headline);
    setText(whyReason, reason);
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    open(matchup, focus = 'heading') {
      if (byId.has(matchup.a)) picks.a = matchup.a;
      if (byId.has(matchup.b)) picks.b = matchup.b;
      active = 'a';
      why.open = false;
      render();
      if (focus === 'start') start.focus();
      else header.focus();
    },
  };
}
