// One pairing, drawn one way wherever two balls are about to meet (ADR 0038): the ready card's head
// before a fight and the next round between series rounds. Each ball is its drawing over its name,
// "vs" between them; a ball the player may not know yet (a blind series' bot) is a "?". The second
// ball of a mirror is drawn lighter, as in the arena. Free play's slots are pickers, not this.
import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { element } from '../dom.ts';

export interface Pairing {
  readonly element: HTMLElement;
  /** The two balls, the player's (or slot A's) first; undefined is not known yet. */
  show(first: BallDefinition | undefined, second: BallDefinition | undefined): void;
}

const ICON_PX = 48;

export function createPairing(): Pairing {
  const root = element('div', 'pairing');
  let shown = '';

  function side(ball: BallDefinition | undefined, repeat: boolean): HTMLElement {
    const holder = element('span', 'pairing-ball');
    if (ball === undefined) {
      const unknown = element('span', 'pairing-unknown', '?');
      unknown.setAttribute('aria-hidden', 'true');
      holder.append(unknown, element('span', 'pairing-name', 'Not shown yet'));
      return holder;
    }
    const icon = element('canvas', 'pairing-icon');
    icon.setAttribute('aria-hidden', 'true');
    drawBallIcon(icon, ball, ICON_PX, repeat);
    holder.append(icon, element('span', 'pairing-name', ball.name));
    return holder;
  }

  return {
    element: root,
    show(first, second) {
      const key = `${first?.id ?? '?'}>${second?.id ?? '?'}`;
      if (key === shown) return;
      shown = key;
      const mirror = first !== undefined && first.id === second?.id;
      root.replaceChildren(
        side(first, false),
        element('span', 'pairing-vs', 'vs'),
        side(second, mirror),
      );
    },
  };
}
