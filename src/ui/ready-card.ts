// The ready moment before a fight (ADR 0037): both balls stand still where the match starts (its
// opening world, tick 0), a sticker card shows the pairing, and a Fight! button starts it. When the
// pairing is new to this device, the card also says what to watch: who is favoured and the counter
// map's reason, with time to read it. In Best of 3 every round waits on Fight!, a deliberate
// "ready, fight" beat between rounds; in Free play the card (and so the wait) shows only for a new
// pairing, so a run of matches is never slowed by a tap. The home demo never waits.
import type { Tips } from '../app/tips.ts';
import { counterFor } from '../sim/counter-map.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { MARKS } from './balls/marks.ts';
import { favouredOf } from './balls/matchups.ts';
import { createPairing } from './balls/pairing.ts';
import { element } from './dom.ts';

/** What the arena is showing: the home demo, a Free play match, or a Best of 3 round. */
export type ReadyMoment = 'demo' | 'quick' | 'series';

export interface ReadyCard {
  /** A new match: true when it waits on Fight! (the card shows over its opening world). */
  start(world: WorldState, moment: ReadyMoment): boolean;
  /** Focuses Fight! when the match waits on it; false when it doesn't. */
  focus(): boolean;
}

/** Whether a match waits on Fight!, and whether its card says what to watch. */
export function readyFor(moment: ReadyMoment, cardDue: boolean): { held: boolean; card: boolean } {
  if (moment === 'demo') return { held: false, card: false };
  return { held: moment === 'series' || cardDue, card: cardDue };
}

/**
 * The card sits centred on the court, on every screen and in every round (ADR 0038), so the moment
 * always looks the same and Fight! is always in the same place.
 */
export function createReadyCard(
  container: HTMLElement,
  lookup: DefinitionLookup,
  tips: Tips,
  onFight: () => void,
): ReadyCard {
  const layer = element('div', 'ready-layer');
  const card = element('section', 'ready-card');
  card.setAttribute('aria-label', 'Ready');
  const head = createPairing();
  const edge = element('p', 'ready-edge');
  const reason = element('p', 'ready-reason');
  const fight = element('button', 'ready-fight', 'Fight!');
  fight.type = 'button';
  const never = element('button', 'text-link ready-never', 'Don’t show these again');
  never.type = 'button';
  card.append(head.element, edge, reason, fight, never);
  layer.append(card);
  layer.hidden = true;
  container.append(layer);

  function go(): void {
    if (layer.hidden) return;
    layer.hidden = true;
    onFight();
  }
  fight.addEventListener('click', go);
  never.addEventListener('click', () => {
    tips.setReadyCards(false);
    go();
  });
  // Escape only closes things (ADR 0038): it never starts a fight. The card isn't modal (Tab moves
  // on), so it is never a trap; Fight! (a click, Enter or Space) is the one way to start.

  function fill(first: BallDefinition, second: BallDefinition, withCard: boolean): void {
    const mirror = first.id === second.id;
    head.show(first, second);
    edge.hidden = !withCard;
    reason.hidden = !withCard;
    never.hidden = !withCard;
    if (!withCard) return;
    const favoured = favouredOf(first.id, second.id);
    const mark = element(
      'span',
      'ready-mark',
      favoured === undefined ? MARKS.even : MARKS.favoured,
    );
    mark.setAttribute('aria-hidden', 'true');
    mark.dataset['lean'] = favoured === undefined ? 'even' : 'favoured';
    const favouredName = favoured === first.id ? first.name : second.name;
    const words = mirror
      ? 'Mirror match'
      : favoured === undefined
        ? 'Even matchup'
        : `${favouredName} is favoured`;
    edge.replaceChildren(mark, ` ${words}`);
    reason.textContent = mirror
      ? 'Same ball, same tricks.'
      : `What to watch: ${counterFor(first.id, second.id)?.reason ?? ''}`;
  }

  return {
    start(world, moment) {
      const [a, b] = world.balls;
      const first = a === undefined ? undefined : lookup.get(a.definitionId);
      const second = b === undefined ? undefined : lookup.get(b.definitionId);
      if (first === undefined || second === undefined || moment === 'demo') {
        layer.hidden = true;
        return false;
      }
      const { held, card: withCard } = readyFor(moment, tips.takeReady(first.id, second.id));
      layer.hidden = !held;
      if (!held) return false;
      card.dataset['card'] = String(withCard);
      fill(first, second, withCard);
      return true;
    },
    focus() {
      if (layer.hidden) return false;
      fight.focus({ preventScroll: true });
      return true;
    },
  };
}
