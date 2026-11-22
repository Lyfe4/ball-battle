// The matchup chart (ADR 0073 addendum of 2026-11-23): one ball against every other, as a spectrum
// of five bands from "Beats Thorns" to "Thorns beats". The hero names the ball read against, with
// Change ball (Free play's ball grid, in place); each band is a calm tint with its mark, heading and
// count; each ball is a chip whose accessible name says the level. A tap explains the pair with the
// pairing, the verdict and Open <ball>: under the chip's row on a phone, in a sticky panel beside
// the bands sideways, and in a strip above the five columns on a desktop.
import { BESIDE_LAYOUT, DESKTOP_LAYOUT } from '../../app/layout-query.ts';
import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { createBallGrid } from '../balls/ball-grid.ts';
import { MARKS, STRONG_MARKS } from '../balls/marks.ts';
import { createPairing } from '../balls/pairing.ts';
import { verdictOf } from '../balls/verdict.ts';
import { element, setText } from '../dom.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import {
  BANDS,
  bandMark,
  bandOf,
  bandTitle,
  chipLabel,
  type Band,
} from './matchup-spectrum-text.ts';

export interface MatchupSpectrum {
  readonly element: HTMLElement;
}

const HERO_PX = 64;
const CHIP_PX = 26;

function icon(ball: BallDefinition | undefined, px: number, className: string): HTMLCanvasElement {
  const canvas = element('canvas', className);
  canvas.setAttribute('aria-hidden', 'true');
  if (ball !== undefined) drawBallIcon(canvas, ball, px);
  return canvas;
}

/** A band's mark on its disc, as the pick rows draw it: ▲▲ / ▼▼ filled, ▲ / ▼ plain, =. */
function markOf(band: Band): HTMLElement {
  const { lean, level } = bandMark(band);
  const strong = level === 'strong';
  const text = lean === 'even' ? MARKS.even : strong ? STRONG_MARKS[lean] : MARKS[lean];
  const mark = element('span', 'spectrum-mark', text);
  // The heading's words say it; the mark is for the eye.
  mark.setAttribute('aria-hidden', 'true');
  mark.dataset['lean'] = lean;
  if (strong) mark.dataset['level'] = 'strong';
  if (lean !== 'even') {
    markSymbol(mark, strong ? (lean === 'favoured' ? 'strongFavoured' : 'strongUnfavoured') : lean);
  }
  return mark;
}

export function createMatchupSpectrum(
  balls: readonly BallDefinition[],
  onOpen: (id: string) => void,
): MatchupSpectrum {
  const lookup = (id: string) => balls.find((ball) => ball.id === id);
  const nameOf = (id: string) => lookup(id)?.name ?? id;
  const beside = matchMedia(BESIDE_LAYOUT);
  const desktop = matchMedia(DESKTOP_LAYOUT);
  // It opens on the first ball with strong counters both ways, so every end of the spectrum shows
  // (the roster's first, the Brawler, is the even pick: nearly all in one band).
  const both = (id: string) =>
    (['beats', 'beaten'] as const).every(
      (band) => balls.filter((ball) => ball.id !== id && bandOf(ball.id, id) === band).length >= 2,
    );
  let against = balls.find((ball) => both(ball.id))?.id ?? balls[0]?.id ?? '';
  let chosen: string | undefined;
  let choosing = false;

  const root = element('section', 'matchup-spectrum');
  root.setAttribute('aria-label', 'Matchup chart');

  // The hero: the ball everything is read against, large, its one line, and Change ball.
  const hero = element('header', 'spectrum-hero');
  const heroArt = element('div', 'spectrum-hero-art');
  const heroWords = element('div', 'spectrum-hero-words');
  const heroName = element('h2', 'spectrum-hero-name');
  const heroLine = element('p', 'spectrum-hero-line');
  heroWords.append(element('p', 'spectrum-hero-eyebrow', 'Every ball against'), heroName, heroLine);
  const change = element('button', 'hud-button spectrum-change');
  change.type = 'button';
  hero.append(heroArt, heroWords, change);

  // Change ball: Free play's ball grid, in the bands' place.
  const chooser = element('div', 'spectrum-chooser');
  const grid = createBallGrid(balls, {
    label: 'Choose a ball to read against',
    onPick: (id) => {
      against = id;
      chosen = undefined;
      choosing = false;
      render();
      change.focus();
    },
  });
  chooser.append(grid.element);

  // The pair's reason: the pairing, the verdict, and the way to the ball's own page.
  const detail = element('section', 'spectrum-detail');
  const pairing = createPairing();
  const headline = element('h3', 'spectrum-detail-headline');
  const reason = element('p', 'spectrum-detail-reason');
  const open = element('button', 'hud-button spectrum-open');
  open.type = 'button';
  open.addEventListener('click', () => {
    if (chosen !== undefined) onOpen(chosen);
  });
  detail.append(pairing.element, headline, reason, open);
  // Said once per pair chosen, wherever the card moves (a moved live region may say it again).
  const said = element('p', 'visually-hidden');
  said.setAttribute('role', 'status');
  const hint = element('p', 'spectrum-hint', 'Tap a ball for how the pair goes, and why.');
  const aside = element('div', 'spectrum-aside');
  const bands = element('div', 'spectrum-bands');
  const body = element('div', 'spectrum-body');
  root.append(hero, chooser, body, said);

  function chip(id: string): HTMLButtonElement {
    const button = element('button', 'spectrum-chip choice');
    button.type = 'button';
    button.dataset['ball'] = id;
    button.setAttribute('aria-pressed', String(id === chosen));
    button.setAttribute('aria-label', chipLabel(id, against, nameOf));
    button.append(
      icon(lookup(id), CHIP_PX, 'spectrum-chip-icon'),
      element('span', 'spectrum-chip-name', nameOf(id)),
    );
    button.addEventListener('click', () => {
      choose(chosen === id ? undefined : id);
    });
    return button;
  }

  /** A pair chosen or closed: the chips stay (keeping focus), only the pressed one and the card move. */
  function choose(id: string | undefined): void {
    chosen = id;
    for (const one of bands.querySelectorAll<HTMLElement>('.spectrum-chip')) {
      one.setAttribute('aria-pressed', String(one.dataset['ball'] === id));
    }
    placeDetail();
    if (id === undefined) {
      setText(said, '');
      return;
    }
    setText(said, `${headline.textContent}. ${reason.textContent}`);
  }

  /** The reason under the tapped chip's row on a phone; in the panel on wider screens. */
  function placeDetail(): void {
    // Closed: off the phone's row too, not only out of the panel.
    if (chosen === undefined) detail.remove();
    aside.replaceChildren(chosen === undefined ? hint : detail);
    if (chosen === undefined) return;
    const verdict = verdictOf(chosen, against, nameOf);
    setText(headline, `${nameOf(chosen)} vs ${nameOf(against)}: ${verdict.headline}`);
    setText(reason, verdict.reason);
    setText(open, `Open ${nameOf(chosen)}`);
    pairing.show(lookup(chosen), lookup(against));
    if (beside.matches) return;
    const tapped = bands.querySelector<HTMLElement>(`.spectrum-chip[data-ball="${chosen}"]`);
    const list = tapped?.parentElement;
    if (tapped === null || list == null) return;
    const row = [...list.querySelectorAll<HTMLElement>('.spectrum-chip')].filter(
      (one) => Math.abs(one.offsetTop - tapped.offsetTop) < 4,
    );
    (row.at(-1) ?? tapped).after(detail);
  }

  function render(): void {
    const target = lookup(against);
    heroArt.replaceChildren(icon(target, HERO_PX, 'spectrum-hero-icon'));
    setText(heroName, nameOf(against));
    setText(heroLine, target?.description ?? '');
    setText(change, choosing ? 'Done' : 'Change ball');
    change.setAttribute('aria-expanded', String(choosing));
    chooser.hidden = !choosing;
    body.hidden = choosing;
    grid.update({ pressed: [against] });
    // On a desktop the reason's strip comes first, as it shows; beside, the panel follows the bands.
    body.replaceChildren(...(desktop.matches ? [aside, bands] : [bands, aside]));
    const others = balls.map((ball) => ball.id).filter((id) => id !== against);
    bands.replaceChildren(
      ...BANDS.map((band) => {
        const members = others.filter((id) => bandOf(id, against) === band);
        const section = element('section', 'spectrum-band');
        section.dataset['band'] = band;
        const head = element('h3', 'spectrum-band-head');
        const count = element('span', 'spectrum-band-count', String(members.length));
        count.setAttribute('aria-label', `${String(members.length)} balls`);
        head.append(
          markOf(band),
          element('span', 'spectrum-band-title', bandTitle(band, nameOf(against))),
          count,
        );
        const list = element('div', 'spectrum-chips');
        list.append(...members.map(chip));
        if (members.length === 0) list.append(element('p', 'spectrum-none', 'None'));
        section.append(head, list);
        return section;
      }),
    );
    placeDetail();
  }

  change.addEventListener('click', () => {
    choosing = !choosing;
    render();
    if (choosing) grid.focus(against);
  });
  // Escape only closes: the chooser, else the open reason (focus back where it came from).
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (choosing) {
      choosing = false;
      render();
      change.focus();
    } else if (chosen !== undefined) {
      const was = chosen;
      choose(undefined);
      bands.querySelector<HTMLElement>(`.spectrum-chip[data-ball="${was}"]`)?.focus();
    } else return;
    event.preventDefault();
  });
  // A turned screen moves the reason between the row and the panel; a narrower one re-flows rows.
  for (const query of [beside, desktop]) query.addEventListener('change', render);
  window.addEventListener('resize', () => {
    if (chosen !== undefined && !beside.matches && !root.hidden) placeDetail();
  });

  render();
  return { element: root };
}
