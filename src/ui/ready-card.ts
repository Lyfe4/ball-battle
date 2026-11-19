// The ready moment before a fight (ADR 0037): both balls stand still where the match starts (its
// opening world, tick 0), a sticker card shows the pairing, and a Fight! button starts it. When the
// pairing is new to this device, the card also says what to watch: who is favoured and the counter
// map's reason, with time to read it; in a live round, during its Get ready and 3-2-1 (ADR 0062). In Best of 3 every round waits on Fight!, a deliberate
// "ready, fight" beat between rounds; in Free play the card (and so the wait) shows only for a new
// pairing, so a run of matches is never slowed by a tap. The home demo never waits.
import { readyFor, type ReadyMoment } from '../app/ready-moment.ts';
import type { Tips } from '../app/tips.ts';
import { counterFor } from '../sim/counter-map.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { favouredOf, levelOf, setMark } from './balls/matchups.ts';
import { createPairing } from './balls/pairing.ts';
import { element } from './dom.ts';

export type { ReadyMoment } from '../app/ready-moment.ts';

export interface ReadyCard {
  /** A new match: true when it waits on Fight! (the card shows over its opening world). */
  start(world: WorldState, moment: ReadyMoment): boolean;
  /** Focuses Fight! when the match waits on it; false when it doesn't. */
  focus(): boolean;
  /** Starts a held match without Fight! (a live fight's time came): true when one was held. */
  release(): boolean;
  /** The countdown line a live fight shows in place of Fight!. */
  countdown(text: string | undefined): void;
}

/** How long a live sticker takes to lift away at Fight! (ready-card.css, `ready-lift`). */
const LIFT_MS = 180;

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
  // Both start the fight, which has its sound (arena.ts): a tap is that one sound.
  fight.dataset['sound'] = 'own';
  never.dataset['sound'] = 'own';
  // A live fight's countdown, where Fight! would be: announced as it changes.
  const count = element('p', 'ready-count');
  count.setAttribute('role', 'status');
  count.hidden = true;
  card.append(head.element, edge, reason, fight, count, never);
  layer.append(card);
  layer.hidden = true;
  container.append(layer);

  function go(): void {
    if (layer.hidden) return;
    layer.hidden = true;
    onFight();
  }

  // A live sticker lifts away at Fight! (ADR 0055, C1); with reduced motion it simply goes.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lifting: number | undefined;
  function stopLift(): void {
    if (lifting !== undefined) window.clearTimeout(lifting);
    lifting = undefined;
    layer.classList.remove('ready-lift');
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
    const mark = element('span', 'ready-mark');
    // The favoured ball's mark (▲▲ or ▲), or = for an even pair.
    const other = favoured === second.id ? first.id : second.id;
    setMark(mark, favoured ?? first.id, favoured === undefined ? second.id : other);
    mark.setAttribute('aria-hidden', 'true');
    const favouredName = favoured === first.id ? first.name : second.name;
    const how = levelOf(first.id, second.id) === 'strong' ? 'strongly' : 'slightly';
    const words = mirror
      ? 'Mirror match'
      : favoured === undefined
        ? 'Even matchup'
        : `${favouredName} is ${how} favoured`;
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
      const live = moment === 'live';
      stopLift();
      card.dataset['live'] = String(live);
      const { held, card: withCard } = readyFor(moment, tips.takeReady(first.id, second.id));
      // A still demo is not held: home holds its frame; the pairing labels it, with no button.
      const still = moment === 'still';
      layer.hidden = !held && !still;
      fight.hidden = live || still;
      count.hidden = !live;
      // A new sticker starts with no line: the last one's stays only while it lifts away.
      count.textContent = '';
      count.classList.remove('ready-count-pop');
      if (!held && !still) return false;
      card.dataset['card'] = String(withCard);
      fill(first, second, withCard);
      // "Don't show these again" starts the fight it closes; a live fight starts at its own time
      // (settings switch the cards off there, ADR 0040).
      never.hidden = !withCard || live;
      return held;
    },
    release() {
      if (layer.hidden || lifting !== undefined) return false;
      if (card.dataset['live'] !== 'true' || reducedMotion.matches) {
        layer.hidden = true;
        return true;
      }
      layer.classList.add('ready-lift');
      lifting = window.setTimeout(() => {
        layer.hidden = true;
        stopLift();
      }, LIFT_MS);
      return true;
    },
    countdown(text) {
      const line = text ?? '';
      // At Fight! the sticker keeps its last line (the 1) as it lifts away: emptied first, it was
      // re-laid out without its line for a moment, a different card flashing before the fight.
      // Nothing but Fight! ever empties a showing sticker's line; a new one starts empty.
      if (lifting !== undefined || (line === '' && !layer.hidden)) return;
      if (count.textContent === line) return;
      count.textContent = line;
      // "Get ready" as a word, 3, 2 and 1 huge; each new line pops in (not with reduced motion).
      count.dataset['number'] = String(/^\d$/.test(line));
      count.classList.remove('ready-count-pop');
      if (line !== '' && !reducedMotion.matches) {
        // A layout read restarts the pop for the next line.
        count.getBoundingClientRect();
        count.classList.add('ready-count-pop');
      }
    },
    focus() {
      if (layer.hidden || fight.hidden) return false;
      fight.focus({ preventScroll: true });
      return true;
    },
  };
}
