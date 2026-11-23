// The arena tip's ring and tag (ADR 0036 addendum of 2026-11-23), for arena-tips.ts: a dashed
// cream ring, a colour no ball wears, on the thing the tip is about and, beside it, a small tag: an
// "i" and the ability's one- or two-word name ("Bombs"), dark on cream, readable over any ball and
// the floor. What the ring is on comes from tip-target.ts (the ball's declared `tipOn`), the tag's
// place from tip-place.ts (inside the court, on the side with room, clear of balls and health bars,
// smooth, no flip-flop). A zone that strikes or ends and a minion that goes take the ring with them:
// it fades where it was. Read from the drawn world only.
import { healthBarRect } from '../render/health-bar.ts';
import { theme } from '../render/theme.ts';
import { createGlide, createTagFollower, EASE_MS } from '../render/tip-place.ts';
import { tipSpotOf, type TipTarget } from '../render/tip-target.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { element, setAttr, setHidden } from './dom.ts';

/** How long a ring takes to fade, when its time is up or its target has gone (arena-tips.css). */
export const LEAVE_MS = 600;
/** The ring's smallest size in CSS pixels (arena-tips.css `min-width: 2.75rem`), as a radius. */
const MIN_RING_PX = 22;

/** The "i" that marks a tip wherever it shows: the tag and the caption. */
export function tipMark(): HTMLElement {
  const mark = element('span', 'tip-i', 'i');
  mark.setAttribute('aria-hidden', 'true');
  return mark;
}

export interface TipRing {
  /** A new tip about `target`, its tag reading `label`. One layout read, once per tip. */
  begin(target: TipTarget, label: string): void;
  /**
   * Places the ring and its tag over `drawn` at `nowMs`. `on`: within the ring's time; `leaving`:
   * in its last LEAVE_MS (the fade); `reduced`: reduced motion (nothing glides).
   */
  update(drawn: WorldState, nowMs: number, how: RingMoment): void;
  hide(): void;
}

export interface RingMoment {
  readonly on: boolean;
  readonly leaving: boolean;
  readonly reduced: boolean;
}

export function createTipRing(layer: HTMLElement, lookup: DefinitionLookup): TipRing {
  const ring = element('span', 'tip-ring');
  const tag = element('span', 'tip-tag');
  const label = element('span', 'tip-tag-label');
  tag.append(tipMark(), label);
  ring.hidden = true;
  tag.hidden = true;
  layer.append(ring, tag);
  let reduced = false;
  const ease = () => (reduced ? 0 : EASE_MS);
  const follower = createTagFollower(ease);
  const glide = createGlide(ease);
  let target: TipTarget | undefined;
  /** The layer's width and the tag's size, in CSS pixels: read once per tip. */
  let layerPx = 0;
  let tagPx = { w: 0, h: 0 };
  let placed = false;
  let goneAt: number | undefined;

  const hide = () => {
    setHidden(ring, true);
    setHidden(tag, true);
  };

  return {
    begin(next, text) {
      target = next;
      label.textContent = text;
      follower.reset();
      glide.reset();
      placed = false;
      goneAt = undefined;
      // Enters once, from the frame it is first placed (arena-tips.css).
      ring.classList.remove('tip-ring-enter', 'tip-ring-leave');
      tag.hidden = false;
      const box = layer.getBoundingClientRect();
      const tagBox = tag.getBoundingClientRect();
      tag.hidden = true;
      ring.classList.add('tip-ring-enter');
      layerPx = box.width;
      tagPx = { w: tagBox.width, h: tagBox.height };
    },
    update(drawn, nowMs, how) {
      reduced = how.reduced;
      if (target === undefined || !how.on) {
        hide();
        return;
      }
      const spot = tipSpotOf(target, drawn, lookup);
      if (spot === undefined) {
        // Gone (a zone struck, a skeleton knocked out): it fades where it was, then hides.
        goneAt ??= nowMs;
        ring.classList.add('tip-ring-leave');
        if (!placed || nowMs - goneAt >= LEAVE_MS) hide();
        return;
      }
      ring.classList.toggle('tip-ring-leave', how.leaving);
      const court = drawn.arena.size;
      const rim = theme.arenaBorderWidth;
      const total = court + rim * 2;
      // World units per CSS pixel: the tag's size and the ring's smallest size in world units.
      const perPx = layerPx > 0 ? total / layerPx : 0;
      const share = (value: number) => `${((value / total) * 100).toFixed(2)}%`;
      const at = glide.at(spot.position, spot.key, nowMs);
      const r = Math.max(spot.radius + rim / 2, MIN_RING_PX * perPx);
      ring.style.left = share(at.x + rim);
      ring.style.top = share(at.y + rim);
      ring.style.width = share(spot.radius * 2 + rim);
      setHidden(ring, false);
      const live = drawn.balls.filter((ball) => ball.health > 0);
      const balls = live
        .filter((ball) => ball.id !== spot.ballId)
        .map((ball) => ({ x: ball.position.x, y: ball.position.y, r: ball.radius }));
      const bars = live.map((ball) => healthBarRect(ball, court));
      const input = { ring: { ...at, r }, w: tagPx.w * perPx, h: tagPx.h * perPx, court };
      const corner = follower.place({ ...input, balls, bars }, nowMs);
      setAttr(tag, 'data-side', corner.side);
      tag.style.left = share(corner.x + rim);
      tag.style.top = share(corner.y + rim);
      setHidden(tag, false);
      placed = true;
    },
    hide,
  };
}
