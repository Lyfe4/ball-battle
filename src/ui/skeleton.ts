// A screen still loading on its own (ADR 0054): opened cold from a link, or after a reload. In place
// of a bare "Loading…" title, the screen's own layout in calm placeholder blocks, so the page
// already looks like what is coming and nothing jumps when it arrives. Moving between screens never
// shows one: the button that moved waits until the next screen is ready (busy-button.ts). It keeps
// a real way on (ADR 0027): the series has the gear and Home where Leave match will be; the
// challenge card has Back and the gear. To a screen reader it is one busy status, "Loading…".
import { element } from './dom.ts';
import { createScreenHeader } from './screen-header.ts';
import { createSettingsToggle } from './settings-menu.ts';

/** Which screen's layout: the online series' pick, or a friend's challenge card. */
export type SkeletonKind = 'series' | 'card';

const block = (shape: string) => {
  const node = element('span', `skeleton-block skeleton-${shape}`);
  node.setAttribute('aria-hidden', 'true');
  return node;
};

/**
 * The content that takes a seen skeleton's place fades in once (ADR 0087: one reveal, on the motion
 * tokens; none with reduced motion, skeleton.css): the skeleton's siblings that show as it hides.
 */
function revealAfter(root: HTMLElement): void {
  let seen = false;
  new MutationObserver(() => {
    const shown = !root.hidden && root.getClientRects().length > 0;
    if (seen && !shown) {
      for (const next of root.parentElement?.children ?? []) {
        if (next === root || !(next instanceof HTMLElement) || next.hidden) continue;
        next.setAttribute('data-revealed', '');
        next.addEventListener(
          'animationend',
          () => {
            next.removeAttribute('data-revealed');
          },
          {
            once: true,
          },
        );
      }
    }
    seen = shown;
  }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
}

/** Draws the `kind` screen's placeholder into `root`; `onWayOut` is its Back or Home. */
export function createSkeleton(root: HTMLElement, kind: SkeletonKind, onWayOut: () => void): void {
  root.classList.add('skeleton', `skeleton-${kind}`);
  revealAfter(root);
  root.setAttribute('aria-busy', 'true');
  const status = element('p', 'visually-hidden', 'Loading…');
  status.setAttribute('role', 'status');
  if (kind === 'card') {
    const header = createScreenHeader('', 'Back', onWayOut);
    header.element.querySelector('.screen-title')?.append(block('title'));
    const buttons = element('div', 'screen-footer');
    buttons.append(block('button'), block('button'));
    root.replaceChildren(
      header.element,
      status,
      block('line-short'),
      block('line'),
      block('line'),
      buttons,
    );
    return;
  }
  // The series' pick: its bar (with the gear), the status line, the track, the banner, the rows.
  const bar = element('div', 'skeleton-bar');
  bar.append(block('line-short'), createSettingsToggle());
  const rows = element('div', 'skeleton-rows');
  rows.append(block('row'), block('row'), block('row'));
  const home = element('button', 'text-link skeleton-home', 'Home');
  home.type = 'button';
  home.addEventListener('click', onWayOut);
  root.replaceChildren(bar, status, block('status'), block('track'), block('banner'), rows, home);
}
