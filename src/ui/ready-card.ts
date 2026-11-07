// The ready moment before a fight (ADR 0037): both balls stand still where the match starts (its
// opening world, tick 0), a sticker card shows the pairing, and a Fight! button starts it. When the
// pairing is new to this device, the card also says what to watch: who is favoured and the counter
// map's reason, with time to read it. In Best of 3 every round waits on Fight!, a deliberate
// "ready, fight" beat between rounds; in Free play the card (and so the wait) shows only for a new
// pairing, so a run of matches is never slowed by a tap. The home demo never waits.
import type { Tips } from '../app/tips.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import { counterFor } from '../sim/counter-map.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { MARKS } from './balls/marks.ts';
import { favouredOf } from './balls/matchups.ts';
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

const ICON_PX = 24;

/** Where the card sits over the arena: the band its starting balls leave clearest. */
export type ReadyPlace = 'top' | 'middle' | 'bottom';

/**
 * The band of the court with the fewest balls in it at tick 0 (the middle when tied), for a card
 * covering `share` of the court's height, so the starting positions it is about stay in view.
 */
export function placeFor(world: WorldState, share: number): ReadyPlace {
  const size = world.arena.size;
  const bands: readonly [ReadyPlace, number, number][] = [
    ['middle', (1 - share) / 2, (1 + share) / 2],
    ['top', 0, share],
    ['bottom', 1 - share, 1],
  ];
  const covered = ([, from, to]: readonly [ReadyPlace, number, number]) =>
    world.balls.filter(
      (ball) =>
        ball.position.y + ball.radius > from * size && ball.position.y - ball.radius < to * size,
    ).length;
  let best = bands[0];
  for (const band of bands) if (best === undefined || covered(band) < covered(best)) best = band;
  return best?.[0] ?? 'middle';
}

export function createReadyCard(
  container: HTMLElement,
  lookup: DefinitionLookup,
  tips: Tips,
  onFight: () => void,
): ReadyCard {
  const layer = element('div', 'ready-layer');
  const card = element('section', 'ready-card');
  card.setAttribute('aria-label', 'Ready');
  const head = element('p', 'ready-head');
  const edge = element('p', 'ready-edge');
  const reason = element('p', 'ready-reason');
  const fight = element('button', 'ready-fight', 'Fight!');
  fight.type = 'button';
  const never = element('button', 'text-link ready-never', 'Don’t show these again');
  never.type = 'button';
  card.append(head, edge, reason, fight, never);
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
    tips.hideReadyCards();
    go();
  });
  // Escape starts the match too: the moment is never a trap.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !layer.hidden) go();
  });

  function side(definition: BallDefinition, repeat: boolean): HTMLElement {
    const holder = element('span', 'ready-ball');
    const icon = element('canvas', 'ready-icon');
    icon.setAttribute('aria-hidden', 'true');
    drawBallIcon(icon, definition, ICON_PX, repeat);
    holder.append(icon, element('span', 'ready-name', definition.name));
    return holder;
  }

  function fill(first: BallDefinition, second: BallDefinition, withCard: boolean): void {
    const mirror = first.id === second.id;
    head.replaceChildren(
      side(first, false),
      element('span', 'ready-vs', 'vs'),
      side(second, mirror),
    );
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
      // Placed once laid out (the arena may only just be showing), by the share of the court the
      // card really covers at this size.
      layer.dataset['place'] = 'middle';
      requestAnimationFrame(() => {
        if (layer.clientHeight === 0) return;
        layer.dataset['place'] = placeFor(
          world,
          Math.min(1, card.offsetHeight / layer.clientHeight),
        );
      });
      return true;
    },
    focus() {
      if (layer.hidden) return false;
      fight.focus({ preventScroll: true });
      return true;
    },
  };
}
