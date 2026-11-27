// Plays a screen change's motion (ADR 0087, PR 19; the rule is app/screen-motion.ts). With View
// Transitions (Chrome 111, Safari 18, Firefox 144) the page's old and new pictures cross: the new one
// rises 8 px and fades in (forward) or fades (Back), while the rail and the header row are named so
// they stay put (screen-motion.css). Without them, the new screen's content under its header
// animates by CSS alone. Reduced motion: a fade, never a move. `update` changes the page; it runs at
// once without motion, and in the transition's own callback with it (a frame later).
import type { ScreenKey } from '../app/history-rules.ts';
import { screenMotionOf, type ScreenMotion } from '../app/screen-motion.ts';
import { reducedMotion as motionQuery } from '../app/motion.ts';

const HEAD = 'screen-head';

/** The header row on show (one per screen): named so the transition leaves it in place. */
function headOnShow(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.stage .screen-header')].find(
    (head) => head.getClientRects().length > 0,
  );
}

function name(head: HTMLElement | undefined, named: boolean): void {
  if (head !== undefined) head.style.viewTransitionName = named ? HEAD : '';
}

export function playScreenMotion(motion: ScreenMotion, update: () => void): void {
  const root = document.documentElement;
  if (motion === 'none') {
    update();
    return;
  }
  // Reduced motion: the CSS fade alone (a View Transition's group still moves its picture).
  const still = motionQuery().matches;
  if (still || typeof document.startViewTransition !== 'function') {
    update();
    // The CSS fallback: the stage's content under its header animates once (screen-motion.css).
    root.dataset['motionCss'] = motion;
    window.setTimeout(() => {
      if (root.dataset['motionCss'] === motion) delete root.dataset['motionCss'];
    }, 400);
    return;
  }
  root.dataset['motion'] = motion;
  const done = () => {
    if (root.dataset['motion'] === motion) delete root.dataset['motion'];
  };
  const before = headOnShow();
  name(before, true);
  const transition = document.startViewTransition(() => {
    name(before, false);
    update();
    name(headOnShow(), true);
  });
  // A skipped transition (another began, or two names met) still ran its update: nothing to say.
  transition.ready.catch(() => undefined);
  void transition.finished
    .catch(() => undefined)
    .then(() => {
      name(headOnShow(), false);
      done();
    });
}

/**
 * Shows each route with its screen change's motion: `keyOf` names a route's screen, `read` gives
 * the URL's route when none is given, `show` puts it up.
 */
export function withScreenMotion<R>(
  keyOf: (route: R) => ScreenKey,
  read: () => R,
  show: (route: R) => void,
): (route?: R) => void {
  let shown: ScreenKey | undefined;
  return (route = read()) => {
    const key = keyOf(route);
    const motion = screenMotionOf(shown, key);
    shown = key;
    playScreenMotion(motion, () => {
      show(route);
    });
  };
}
