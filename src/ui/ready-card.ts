// The ready moment before a fight (ADR 0037): both balls stand still where the match starts (its
// opening world, tick 0), a sticker card shows the pairing, and a Fight! button starts it. When the
// pairing is new to this device, the card also says what to watch: who is favoured and the counter
// map's reason, with time to read it; in a live round, during its Get ready and 3-2-1 (ADR 0062). In Best of 3 every round waits on Fight!, a deliberate
// "ready, fight" beat between rounds; in Free play the card (and so the wait) shows only for a new
// pairing, so a run of matches is never slowed by a tap. The home demo never waits.
import { readyFor, type ReadyMoment } from '../app/ready-moment.ts';
import type { Tips } from '../app/tips.ts';
import { counterFor } from '../sim/counter-map.ts';
import type { Side } from '../sim/series.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { favouredOf, leanOf, levelOf, setMark } from './balls/matchups.ts';
import { createPairing } from './balls/pairing.ts';
import { element } from './dom.ts';
import { reducedMotion as motionQuery } from '../app/motion.ts';

export type { ReadyMoment } from '../app/ready-moment.ts';

export interface ReadyCard {
  /**
   * A new match: true when it waits on Fight! (the card shows over its opening world). `yours` is
   * the player's side (a series: a; online: theirs); undefined in Free play, where slot A speaks.
   */
  start(world: WorldState, moment: ReadyMoment, yours?: Side): boolean;
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
  // A compact secondary beside Fight! (ADR 0086): it hides these cards for good and starts the fight
  // it closes, so it never costs the court a line of its own (667 x 320 beside).
  const never = element('button', 'hud-button hud-button-compact ready-never', 'Hide tips');
  never.type = 'button';
  never.setAttribute('aria-label', 'Hide tips and fight');
  // Both start the fight, which has its sound (arena.ts): a tap is that one sound.
  fight.dataset['sound'] = 'own';
  never.dataset['sound'] = 'own';
  // A live fight's countdown, where Fight! would be: announced as it changes.
  const count = element('p', 'ready-count');
  count.setAttribute('role', 'status');
  count.hidden = true;
  // Hide tips, then Fight!: the primary last, under the thumb.
  const actions = element('div', 'ready-actions');
  actions.append(never, fight);
  card.append(head.element, edge, reason, actions, count);
  layer.append(card);
  layer.hidden = true;
  container.append(layer);

  function go(): void {
    if (layer.hidden) return;
    layer.hidden = true;
    onFight();
  }

  // A live sticker lifts away at Fight! (ADR 0055, C1); with reduced motion it simply goes.
  const reducedMotion = motionQuery();
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

  function fill(
    first: BallDefinition,
    second: BallDefinition,
    withCard: boolean,
    yours: Side | undefined,
  ): void {
    const mirror = first.id === second.id;
    head.show(first, second);
    edge.hidden = !withCard;
    reason.hidden = !withCard;
    never.hidden = !withCard;
    head.mark(undefined);
    if (!withCard) return;
    // The mark speaks for the player, as the pick screen's legend does ("▲ you're favoured"): it
    // sits beside the player's own ball, ▲ or ▼ from that ball's side, and nothing when even.
    const [own, other] = yours === 'b' ? [second, first] : [first, second];
    if (!mirror && leanOf(own.id, other.id) !== 'even') {
      const mark = element('span', 'ready-mark');
      setMark(mark, own.id, other.id);
      mark.setAttribute('aria-hidden', 'true');
      head.mark(yours === 'b' ? 1 : 0, mark);
    }
    const favoured = favouredOf(first.id, second.id);
    const favouredName = favoured === first.id ? first.name : second.name;
    const how = levelOf(first.id, second.id) === 'strong' ? 'strongly' : 'slightly';
    edge.textContent = mirror
      ? 'Mirror match'
      : favoured === undefined
        ? 'Even matchup'
        : `${favouredName} is ${how} favoured`;
    reason.textContent = mirror
      ? 'Same ball, same tricks.'
      : `What to watch: ${counterFor(first.id, second.id)?.reason ?? ''}`;
  }

  return {
    start(world, moment, yours) {
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
      fill(first, second, withCard, yours);
      // Hide tips starts the fight it closes; a live fight starts at its own time
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
