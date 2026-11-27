// One incoming banner (ADR 0086) for a friend's live challenge and a rematch: who (their disc),
// "Alex challenges you" / "Alex wants a rematch", the rules, No thanks and Accept, and a thin bar
// at its foot that drains for the time it waits. A friend's challenge also has the ×, named
// "Later: keep it in Friends": it folds the banner into the Friends tab's badge, which pulses
// once. The same banner says what changed while it showed ("Alex stopped waiting", a rematch's
// ending) with OK, and "Rematch on" with Choose lineup.
//
// It floats in at the top on a phone held upright (over the header row, moving nothing) and at the
// bottom right beside and on a desktop, never over the rail (incoming-banner.css). It moves on the motion tokens
// alone; with reduced motion it fades. Each answer is a request: its button stays busy until the
// server has it (busy-button.ts), so a double tap sends one.
import { tokenMs } from '../motion-token.ts';
import { busyOnClick } from '../busy-button.ts';
import { createCloseButton } from '../close-button.ts';
import { element, setAttr, setHidden, setText } from '../dom.ts';
import type { Incoming } from '../../screens/incoming-text.ts';
import { personDisc } from './friend-sheet.ts';
import { reducedMotion } from '../../app/motion.ts';

export interface IncomingActions {
  /** Accept, or Choose lineup. */
  accept(): Promise<void>;
  decline(): Promise<void>;
  /** OK on news. */
  dismiss(): void;
  /** The × (Later): the banner folds into the badge. */
  later(): void;
}

export interface IncomingBanner {
  readonly element: HTMLElement;
  /** Shows `incoming`, or hides at once; `failure` is a line under it (a refused answer). */
  show(incoming: Incoming | undefined, failure?: string): void;
  /**
   * Folds the banner into `target` (the Friends tab's badge) over `--motion-slow` and hides it; the
   * badge then pulses once. With reduced motion, or no badge on screen, it fades out instead.
   */
  fold(target: HTMLElement | undefined): void;
}

const moveLess = () => reducedMotion().matches;

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The badge pulses once as the banner lands in it (incoming-banner.css; none with reduced motion). */
export function pulse(badge: HTMLElement): void {
  badge.removeAttribute('data-pulse');
  // A reflow, so the same badge can pulse again.
  badge.getBoundingClientRect();
  badge.setAttribute('data-pulse', '');
  badge.addEventListener(
    'animationend',
    () => {
      badge.removeAttribute('data-pulse');
    },
    { once: true },
  );
}

/** Drawn into `root`, which floats over every calm screen (incoming-banner.css). */
export function createIncomingBanner(
  root: HTMLElement,
  label: string,
  actions: IncomingActions,
): IncomingBanner {
  root.classList.add('incoming-banner');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', label);
  root.hidden = true;
  let discOf: string | undefined;
  const disc = element('span', 'incoming-disc-slot');
  // Read out as it comes, wherever the player is: who and what, in one status line.
  const words = element('div', 'incoming-words');
  words.setAttribute('role', 'status');
  const title = element('p', 'incoming-title');
  const line = element('p', 'incoming-line');
  words.append(title, line);
  const later = createCloseButton(() => {
    actions.later();
  });
  later.classList.add('incoming-later');
  const head = element('div', 'incoming-head');
  head.append(disc, words, later);
  const failed = element('p', 'incoming-failure');
  const buttons = element('div', 'incoming-actions');
  const decline = element('button', 'hud-button incoming-decline', 'No thanks');
  decline.type = 'button';
  const accept = element('button', 'hud-button hud-button-primary incoming-accept', 'Accept');
  accept.type = 'button';
  // A key moment, like Rematch on the end screen: it taps (sound.ts).
  accept.dataset['sound'] = 'tap';
  const ok = element('button', 'hud-button hud-button-primary incoming-ok', 'OK');
  ok.type = 'button';
  busyOnClick(accept, () => actions.accept());
  busyOnClick(decline, () => actions.decline());
  ok.addEventListener('click', () => {
    actions.dismiss();
  });
  buttons.append(decline, accept, ok);
  // The time it waits, draining: decoration (the words and the buttons say what to do).
  const bar = element('span', 'incoming-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = element('span', 'incoming-bar-fill');
  bar.append(fill);
  root.append(head, failed, buttons, bar);
  let folding: Animation | undefined;

  function hide(): void {
    folding?.cancel();
    folding = undefined;
    root.removeAttribute('data-folding');
    setHidden(root, true);
  }

  return {
    element: root,
    show(incoming, failure) {
      if (incoming === undefined) {
        // A fold in flight finishes on its own: it hides the banner at its end.
        if (folding === undefined) hide();
        return;
      }
      // One banner at a time, in one place: news (OK alone) yields to a banner that asks for an
      // answer, and waits out while one shows ("You left" under a rematch ask, ADR 0086).
      const others = [...document.querySelectorAll<HTMLElement>('.incoming-banner')].filter(
        (one) => one !== root && !one.hidden,
      );
      const news = incoming.answers === 'ok';
      if (news && others.some((one) => !one.hasAttribute('data-news'))) {
        if (folding === undefined) hide();
        return;
      }
      if (!news)
        for (const one of others.filter((it) => it.hasAttribute('data-news'))) one.hidden = true;
      root.toggleAttribute('data-news', news);
      folding?.cancel();
      folding = undefined;
      root.removeAttribute('data-folding');
      if (discOf !== incoming.who) {
        discOf = incoming.who;
        disc.replaceChildren(personDisc({ id: '', name: incoming.who }, 'row'));
      }
      setText(title, incoming.title);
      setText(line, incoming.line);
      setText(failed, failure ?? '');
      setHidden(failed, failure === undefined);
      setHidden(decline, incoming.answers !== 'answer');
      setHidden(accept, incoming.answers === 'ok');
      setText(accept, incoming.answers === 'lineup' ? 'Choose lineup' : 'Accept');
      setHidden(ok, incoming.answers !== 'ok');
      setHidden(later, incoming.later === undefined);
      if (incoming.later !== undefined) setAttr(later, 'aria-label', incoming.later);
      setHidden(bar, incoming.left === undefined);
      const left = Math.min(1, Math.max(0, incoming.left ?? 0));
      fill.style.transform = `scaleX(${left.toFixed(4)})`;
      root.toggleAttribute('data-urgent', incoming.left !== undefined && left < 0.25);
      setHidden(root, false);
    },
    fold(target) {
      if (root.hidden || folding !== undefined) return;
      root.setAttribute('data-folding', '');
      const from = root.getBoundingClientRect();
      const to = target?.getClientRects().length ? target.getBoundingClientRect() : undefined;
      const still = moveLess() || to === undefined;
      const frames: Keyframe[] = still
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: 'none', opacity: 1 },
            {
              transform: `translate(${String(to.left + to.width / 2 - (from.left + from.width / 2))}px, ${String(
                to.top + to.height / 2 - (from.top + from.height / 2),
              )}px) scale(0.08)`,
              opacity: 0,
            },
          ];
      folding = root.animate(frames, {
        duration: tokenMs(still ? '--motion-quick' : '--motion-slow'),
        easing: token('--ease-in') || 'ease-in',
        fill: 'forwards',
      });
      const done = folding;
      void done.finished
        .then(() => {
          if (folding !== done) return;
          hide();
          if (target !== undefined && !moveLess()) pulse(target);
        })
        .catch(() => undefined);
    },
  };
}
