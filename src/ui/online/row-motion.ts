// Rows in and out of a list that is drawn again (ADR 0087): a row that arrives fades in over
// --motion-base; a row that goes fades out where it stood over --motion-quick (a still copy laid
// over its place, so the redraw itself stays one synchronous step). A row moving to another group
// (a request accepted) goes from one and arrives in the other. The first rows of a visit arrive
// with the list's own reveal, not one by one. Reduced motion: nothing moves or fades.
const ROW = '.friends-row';

const keyOf = (row: HTMLElement): string => {
  const group = row.closest<HTMLElement>('[data-group]')?.dataset['group'] ?? '';
  const id = row.dataset['invite'] ?? row.dataset['turn'] ?? row.dataset['friend'] ?? '';
  return `${group}:${id}`;
};

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function tokenMs(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = Number.parseFloat(value);
  return value.endsWith('ms') ? ms : ms * 1000;
}

export interface RowMotion {
  /**
   * Before a redraw of the rows; call what it returns after it, saying whether real rows (not
   * skeleton rows) are drawn now.
   */
  before(): (drawn: boolean) => void;
}

export function createRowMotion(root: HTMLElement): RowMotion {
  /** Real rows were drawn this visit: from then on, redraws move rows in and out. */
  let wasDrawn = false;
  return { before: () => around(root, wasDrawn, (drawn) => (wasDrawn = drawn)) };
}

function around(
  root: HTMLElement,
  wasDrawn: boolean,
  drawnNow: (drawn: boolean) => void,
): (drawn: boolean) => void {
  const before = new Map(
    [...root.querySelectorAll<HTMLElement>(ROW)]
      .filter((row) => row.getClientRects().length > 0)
      .map((row) => [keyOf(row), { row, box: row.getBoundingClientRect() }] as const),
  );
  return (drawn) => {
    drawnNow(drawn);
    if (!wasDrawn || still()) return;
    const now = [...root.querySelectorAll<HTMLElement>(ROW)];
    const keys = new Set(now.map(keyOf));
    for (const row of now) {
      if (before.has(keyOf(row))) continue;
      row.setAttribute('data-row-in', '');
      row.addEventListener(
        'animationend',
        () => {
          row.removeAttribute('data-row-in');
        },
        {
          once: true,
        },
      );
    }
    for (const [key, { row, box }] of before) {
      if (keys.has(key)) continue;
      const ghost = row.cloneNode(true) as HTMLElement;
      ghost.classList.add('friends-row-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, {
        left: `${String(box.left)}px`,
        top: `${String(box.top)}px`,
        width: `${String(box.width)}px`,
        height: `${String(box.height)}px`,
      });
      document.body.append(ghost);
      const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-in');
      const fading = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: tokenMs('--motion-quick'),
        easing: easing.trim() || 'ease-in',
        fill: 'forwards',
      });
      void fading.finished
        .catch(() => undefined)
        .then(() => {
          ghost.remove();
        });
    }
  };
}
