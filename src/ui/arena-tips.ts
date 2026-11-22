// Teaching in the arena, at the moment things happen (ADR 0036 and its 2026-11-22 addenda): the
// first time this device sees a ball's ability, its name and the ball's one-line description in a
// fixed place by the match (`#arena-caption`: under the speed row on a phone, the panel's last
// row beside the court), for 4 s, and a ring in the ball's colour on the thing it is about (the
// bomb on the floor, else the ball). Both appear on the same frame, and the caption's title wears
// that colour beside a small drawing of the ball, so the eye goes from the ball to the words.
// Read from sim events and the definitions, so it can't disagree with the fight. Nothing slows:
// a live fight stays in step. Each enters once, then holds still (arena-tips.css); with reduced
// motion they only fade. Hints can be turned off in settings (ADR 0040). The pairing's "what to
// watch" is the ready card's (ready-card.ts).
import type { Tips } from '../app/tips.ts';
import { showsAbility } from '../render/ability-sign.ts';
import { ballColor, isRepeatOfEarlierBall } from '../render/ball-colors.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import { readableTextOn } from '../render/contrast.ts';
import { theme } from '../render/theme.ts';
import { sideOf } from '../sim/side.ts';
import type {
  BallDefinition,
  BallState,
  DefinitionLookup,
  SimEvent,
  Vec2,
  WorldState,
} from '../sim/types.ts';
import { element, setHidden, setText } from './dom.ts';

/** How long a caption shows, in effect-time milliseconds: long enough to read one sentence. */
export const HINT_MS = 4000;
/** How long its ring shows, from the caption's start: in, still, then out (arena-tips.css). */
export const RING_MS = 2400;
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
  /** Places the ring over `drawn` at `nowMs`, and ends a caption whose time is up. */
  update(drawn: WorldState, nowMs: number): void;
  isActive(nowMs: number): boolean;
}

interface Hint {
  readonly ballId: string;
  /** Its ball's definition id: the key it was taken under. */
  readonly key: string;
  readonly definition: BallDefinition;
  readonly title: string;
  readonly sentence: string;
  /** Its ball's colour as the court draws it (a mirror's second ball lighter): ring and title. */
  readonly color: string;
  readonly isRepeat: boolean;
  /** Where the thing it is about stays put (a zone): the ring sits there; else on the ball. */
  readonly at: { readonly position: Vec2; readonly radius: number } | undefined;
}

/**
 * The ball a hint is about: its own ball while it is in the fight, else another of the same kind
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
function shareOf(world: WorldState, value: number): number {
  const total = world.arena.size + theme.arenaBorderWidth * 2;
  return (value / total) * 100;
}

/** The spot a zone appeared on, which its ring keeps to; other signs follow the ball. */
function spotOf(event: SimEvent): Hint['at'] {
  return event.type === 'zoneSpawned'
    ? { position: event.position, radius: event.radius }
    : undefined;
}

export function createArenaTips(
  container: HTMLElement,
  caption: HTMLElement,
  lookup: DefinitionLookup,
  tips: Tips,
): ArenaTips {
  const layer = element('div', 'arena-tips');
  layer.setAttribute('aria-hidden', 'true');
  const ring = element('span', 'tip-ring');
  ring.hidden = true;
  layer.append(ring);
  container.append(layer);
  const mark = element('canvas', 'arena-caption-mark');
  mark.setAttribute('aria-hidden', 'true');
  const title = element('strong', 'arena-caption-title');
  const head = element('span', 'arena-caption-head');
  head.append(mark, title);
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
      if (hintBall(next, balls) !== undefined) return { ...next, startMs: nowMs };
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
    // Title and ring in one shade of the ball's colour: lightened only as far as text needs on the
    // caption's box, which also lifts a dark ball's ring (the Necromancer's) off the dark floor.
    const shade = readableTextOn(next.color, surfaceColor());
    title.style.color = shade;
    ring.style.setProperty('--tip-color', shade);
    drawBallIcon(mark, next.definition, MARK_PX, next.isRepeat);
    // Each enters once, from the same frame (the ring is placed and shown by the next update,
    // drawn with this tick): restarted for a new caption with one layout read, once per tip.
    caption.classList.remove('arena-caption-enter');
    ring.classList.remove('tip-ring-enter');
    caption.getBoundingClientRect();
    caption.classList.add('arena-caption-enter');
    ring.classList.add('tip-ring-enter');
    setHidden(caption, false);
  };

  return {
    start(teaching) {
      // Hints still waiting when a fight ends were never seen.
      for (const waiting of queue) tips.giveBackHint(waiting.key);
      queue = [];
      begin(undefined);
      ring.hidden = true;
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
              sentence: definition.description,
              at: spotOf(event),
            });
          }
        }
      }
      if (showing === undefined) begin(nextFor(world.balls, nowMs));
    },
    update(drawn, nowMs) {
      if (showing !== undefined && nowMs - showing.startMs >= HINT_MS) {
        begin(nextFor(drawn.balls, nowMs));
      }
      const ball = showing === undefined ? undefined : hintBall(showing, drawn.balls);
      if (showing === undefined || ball === undefined || nowMs - showing.startMs >= RING_MS) {
        setHidden(ring, true);
        return;
      }
      const spot = showing.at ?? { position: ball.position, radius: ball.radius };
      const size = shareOf(drawn, spot.radius * 2 + theme.arenaBorderWidth);
      ring.style.left = `${shareOf(drawn, spot.position.x + theme.arenaBorderWidth).toFixed(2)}%`;
      ring.style.top = `${shareOf(drawn, spot.position.y + theme.arenaBorderWidth).toFixed(2)}%`;
      ring.style.width = `${size.toFixed(2)}%`;
      setHidden(ring, false);
    },
    isActive(nowMs) {
      return (showing !== undefined && nowMs - showing.startMs < HINT_MS) || queue.length > 0;
    },
  };
}
