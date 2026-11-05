import type { Matchup } from '../app/matchup.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createBallGrid } from './balls/ball-grid.ts';
import { createBallInfo, type BallInfoLink } from './balls/ball-info.ts';
import { leanOf } from './balls/matchups.ts';
import { verdictOf } from './balls/verdict.ts';
import { element, setText } from './dom.ts';
import { createScreenHeader } from './screen-header.ts';

export interface QuickSetupActions {
  readonly onStart: (matchup: Matchup) => void;
  /** The picks changed (so the URL can keep them across a reload). */
  readonly onChange: (matchup: Matchup) => void;
  readonly onBack: () => void;
  /** The info card's link to a ball's manual entry. */
  readonly ballLink: BallInfoLink;
}

export interface QuickSetup {
  setVisible(visible: boolean): void;
  /**
   * Fills both slots and makes A the slot a tap fills. Focus goes to the heading, or to Start when
   * the balls were chosen for the player (Play on the home screen).
   */
  open(matchup: Matchup, focus?: 'heading' | 'start'): void;
}

type Slot = 'a' | 'b';
const SLOT_ICON_PX = 32;
const SLOT_NAMES: Readonly<Record<Slot, string>> = { a: 'Ball A', b: 'Ball B' };

/**
 * Choosing the two balls of a quick match, as a screen of its own (phone first): the two slots,
 * what the counter map says about the pair, the ball just looked at, every ball as a tile, and
 * Start. A tap fills the slot that is active; filling A moves on to B. Tiles are marked ▲ / ▼
 * against the ball in the other slot, so players learn counters while they pick.
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

  const header = createScreenHeader('Quick match', 'Back', actions.onBack);

  const slotRow = element('div', 'quick-slots');
  slotRow.setAttribute('role', 'group');
  slotRow.setAttribute('aria-label', 'Slot to fill');
  const slots = (['a', 'b'] as const).map((slot) => {
    const button = element('button', 'quick-slot');
    button.type = 'button';
    const icon = element('canvas', 'quick-slot-icon');
    icon.setAttribute('aria-hidden', 'true');
    const name = element('span', 'quick-slot-name');
    const text = element('span', 'quick-slot-text');
    text.append(element('span', 'quick-slot-label', SLOT_NAMES[slot]), name);
    button.append(icon, text);
    button.addEventListener('click', () => {
      active = slot;
      render();
      grid.focus(picks[slot]);
    });
    return { slot, button, icon, name };
  });
  const [slotA, slotB] = slots;
  if (slotA === undefined || slotB === undefined) throw new Error('expected two slots');
  slotRow.append(slotA.button, element('span', 'quick-vs', 'vs'), slotB.button);

  const verdict = element('section', 'quick-verdict');
  verdict.setAttribute('aria-live', 'polite');
  const verdictHeadline = element('h2', 'quick-verdict-headline');
  const verdictReason = element('p', 'quick-verdict-reason');
  verdict.append(verdictHeadline, verdictReason);

  const info = createBallInfo(balls, actions.ballLink);
  const grid = createBallGrid(balls, {
    label: 'Balls',
    onPick: (id) => {
      picks[active] = id;
      info.show(id);
      if (active === 'a') active = 'b';
      render();
      actions.onChange({ ...picks });
    },
    onLook: (id) => {
      info.show(id);
    },
  });

  const legend = element('p', 'quick-legend');
  legend.setAttribute('aria-hidden', 'true');

  const start = element('button', 'hud-button hud-button-primary quick-start', 'Start match');
  start.type = 'button';
  start.addEventListener('click', () => {
    actions.onStart({ ...picks });
  });
  const footer = element('div', 'screen-footer');
  footer.append(start);

  root.append(header.element, slotRow, verdict, info.element, legend, grid.element, footer);

  function render(): void {
    for (const { slot, button, icon, name } of slots) {
      const ball = byId.get(picks[slot]);
      if (ball === undefined) continue;
      setText(name, ball.name);
      button.setAttribute('aria-pressed', String(slot === active));
      button.setAttribute('aria-label', `${SLOT_NAMES[slot]}: ${ball.name}`);
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
    setText(legend, `▲ favoured  ▼ unfavoured against ${nameOf(other)}`);
    const { headline, reason, leanOfA } = verdictOf(picks.a, picks.b, nameOf);
    setText(verdictHeadline, headline);
    setText(verdictReason, reason);
    verdict.dataset['lean'] = leanOfA === 'even' ? 'even' : 'favoured';
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    open(matchup, focus = 'heading') {
      if (byId.has(matchup.a)) picks.a = matchup.a;
      if (byId.has(matchup.b)) picks.b = matchup.b;
      active = 'a';
      info.show(picks.a);
      render();
      if (focus === 'start') start.focus();
      else header.focus();
    },
  };
}
