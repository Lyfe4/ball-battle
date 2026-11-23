// Teaching in the arena, at the moment things happen (ADR 0036, its 2026-11-22 addenda and the
// 2026-11-23 one): the first time this device sees a ball's ability, a tip in its own look. In the
// arena, a dashed cream ring on the thing it is about (where the ball's definition says: its zone,
// its minion, the ball it struck, its copy or itself) with an "i" tag naming the ability, for
// RING_MS (arena-tip-ring.ts). By the match (`#arena-caption`: under the speed row on a phone, the
// panel's last row on a phone turned sideways, the top of the panel on a desktop), a card with the
// same "i", a small drawing of the ball, its name and ability in its colour and its one-line
// description, for HINT_MS or until the next tip (not before NEXT_AFTER_MS). Both appear on the
// same frame. Read from sim events and the definitions, so it can't disagree with the fight.
// Nothing slows or waits: a live fight stays in step. Each enters once, holds still and fades
// (arena-tips.css); with reduced motion nothing moves but the fades. Hints can be turned off in
// settings (ADR 0040). The pairing's "what to watch" is the ready card's (ready-card.ts).
import type { Tips } from '../app/tips.ts';
import { showsAbility } from '../render/ability-sign.ts';
import { ballColor, isRepeatOfEarlierBall } from '../render/ball-colors.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import { readableTextOn } from '../render/contrast.ts';
import { ballOf, tipTargetOf, type TipTarget } from '../render/tip-target.ts';
import type {
  BallDefinition,
  BallState,
  DefinitionLookup,
  SimEvent,
  WorldState,
} from '../sim/types.ts';
import { createTipRing, LEAVE_MS, tipMark } from './arena-tip-ring.ts';
import { element, setHidden, setText } from './dom.ts';

/**
 * How long a caption shows, in effect-time milliseconds, with no tip after it: time to read one
 * sentence twice, glancing back from the fight.
 */
export const HINT_MS = 7000;
/** The soonest the next tip takes the caption's place: time to read it once. */
export const NEXT_AFTER_MS = 4000;
/** How long its ring and tag show, from the caption's start: in, still, then out. */
export const RING_MS = 3000;
/** The caption's drawing of its ball, in CSS pixels: a mark beside the title, not a picture. */
const MARK_PX = 20;

/** The caption's box colour (tokens.css --color-surface), read from the page's styles. */
function surfaceColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
}

export interface ArenaTips {
  /** A new match: whether hints show in it (never in the home demo). */
  start(teaching: boolean): void;
  /** A tick's events: the first time a ball's ability shows, its hint is due. */
  apply(events: readonly SimEvent[], world: WorldState, nowMs: number): void;
  /**
   * Places the ring over `drawn` at `nowMs`, and ends a caption whose time is up. `reduced`: the
   * player asked for reduced motion (the ring and its tag never glide).
   */
  update(drawn: WorldState, nowMs: number, reduced?: boolean): void;
  isActive(nowMs: number): boolean;
}

interface Hint {
  readonly ballId: string;
  /** Its ball's definition id: the key it was taken under. */
  readonly key: string;
  readonly definition: BallDefinition;
  readonly title: string;
  /** The ability's own one- or two-word name ("Bombs"): the tag beside the ring. */
  readonly label: string;
  readonly sentence: string;
  /** Its ball's colour as the court draws it (a mirror's second ball lighter): the title. */
  readonly color: string;
  readonly isRepeat: boolean;
  /** What its ring is on (tip-target.ts). */
  readonly target: TipTarget;
}

export function createArenaTips(
  container: HTMLElement,
  caption: HTMLElement,
  lookup: DefinitionLookup,
  tips: Tips,
): ArenaTips {
  const layer = element('div', 'arena-tips');
  layer.setAttribute('aria-hidden', 'true');
  container.append(layer);
  const ring = createTipRing(layer, lookup);
  const mark = element('canvas', 'arena-caption-mark');
  mark.setAttribute('aria-hidden', 'true');
  const title = element('strong', 'arena-caption-title');
  const head = element('span', 'arena-caption-head');
  head.append(tipMark(), mark, title);
  const sentence = element('span', 'arena-caption-text');
  caption.replaceChildren(head, sentence);
  caption.hidden = true;

  /** Hints due, in order: one shows at a time. */
  let queue: Hint[] = [];
  let showing: (Hint & { startMs: number }) | undefined;
  let teachingNow = false;

  /**
   * The next hint whose ball is still there. One with nothing left to point at (knocked out while
   * it waited behind another) is given back, not lost: it shows next time.
   */
  const nextFor = (balls: readonly BallState[], nowMs: number) => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      if (ballOf(next.ballId, next.key, balls) !== undefined) return { ...next, startMs: nowMs };
      tips.giveBackHint(next.key);
    }
    return undefined;
  };

  /** Writes the caption as it starts, so a screen reader hears it once (a polite status). */
  const begin = (next: typeof showing) => {
    showing = next;
    if (next === undefined) {
      setHidden(caption, true);
      return;
    }
    setText(title, next.title);
    setText(sentence, next.sentence);
    // The title in the ball's colour, lightened only as far as text needs on the caption's box.
    title.style.color = readableTextOn(next.color, surfaceColor());
    drawBallIcon(mark, next.definition, MARK_PX, next.isRepeat);
    // Each enters once, from the same frame (the ring is placed and shown by the next update,
    // drawn with this tick): restarted for a new caption with one layout read, once per tip.
    caption.classList.remove('arena-caption-enter', 'arena-caption-leave');
    ring.begin(next.target, next.label);
    caption.classList.add('arena-caption-enter');
    setHidden(caption, false);
  };

  return {
    start(teaching) {
      // Hints still waiting when a fight ends were never seen.
      for (const waiting of queue) tips.giveBackHint(waiting.key);
      queue = [];
      begin(undefined);
      ring.hide();
      teachingNow = teaching;
    },
    apply(events, world, nowMs) {
      if (!teachingNow || !tips.enabled()) return;
      for (const event of events) {
        for (const [index, ball] of world.balls.entries()) {
          const definition = lookup.get(ball.definitionId);
          const ability = definition?.ability;
          if (definition === undefined || ability === undefined) continue;
          if (!showsAbility(event, ball.id, ability.shownBy)) continue;
          if (tips.takeHint(ball.definitionId)) {
            const isRepeat = isRepeatOfEarlierBall(world.balls, index);
            queue.push({
              ballId: ball.id,
              key: ball.definitionId,
              definition,
              color: ballColor(definition.color, isRepeat),
              isRepeat,
              title: `${definition.name}: ${ability.name}`,
              label: ability.name,
              sentence: definition.description,
              target: tipTargetOf(ability.tipOn, event, ball, world.balls),
            });
          }
        }
      }
      if (showing === undefined) begin(nextFor(world.balls, nowMs));
    },
    update(drawn, nowMs, reduced = false) {
      if (showing !== undefined) {
        const age = nowMs - showing.startMs;
        if (age >= HINT_MS || (age >= NEXT_AFTER_MS && queue.length > 0)) {
          begin(nextFor(drawn.balls, nowMs));
        }
      }
      const age = showing === undefined ? 0 : nowMs - showing.startMs;
      // The caption fades out on effect time, at the end of its own time.
      if (showing !== undefined && age >= HINT_MS - LEAVE_MS) {
        caption.classList.add('arena-caption-leave');
      }
      const on = showing !== undefined && age < RING_MS;
      ring.update(drawn, nowMs, { on, leaving: age >= RING_MS - LEAVE_MS, reduced });
    },
    isActive(nowMs) {
      return (showing !== undefined && nowMs - showing.startMs < HINT_MS) || queue.length > 0;
    },
  };
}
