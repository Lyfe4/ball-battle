import type { Matchup } from '../../app/matchup.ts';
import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { matchupsOf, speedTrait, statShares, type MatchupLine } from '../balls/matchups.ts';
import { element, setText } from '../dom.ts';

export interface BallDetail {
  readonly element: HTMLElement;
  show(id: string): void;
}

export interface BallDetailActions {
  /** Another ball's entry (a matchup was tapped). */
  readonly onOpen: (id: string) => void;
  /** Try it: a quick match of this ball against `matchup.b`, set up and ready. */
  readonly onTry: (matchup: Matchup) => void;
}

const HERO_PX = 96;
const ROW_ICON_PX = 28;
const EVEN_ICON_PX = 24;

/**
 * One ball's manual entry, phone first: the drawing large, its one line, three stat bars from zero
 * against the roster (health, contact hit and base speed), then who it is strong and weak vs, with
 * the counter map's reason for each, and the balls it is even with. Every opponent is a button to
 * that ball's entry, so the manual is browsed by its counters. Try it sets up a quick match against
 * a ball it is strong vs (or its counter, if there is none).
 */
export function createBallDetail(
  balls: readonly BallDefinition[],
  actions: BallDetailActions,
): BallDetail {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const roster = balls.map((ball) => ball.id);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const root = element('article', 'ball-detail');

  const hero = element('div', 'ball-detail-hero');
  const icon = element('canvas', 'ball-detail-icon');
  icon.setAttribute('aria-hidden', 'true');
  const description = element('p', 'ball-detail-description');
  const trait = element('span', 'ball-detail-trait');
  const text = element('div', 'ball-detail-text');
  text.append(description, trait);
  hero.append(icon, text);

  const stats = element('dl', 'ball-detail-stats');
  const statRows = (['Health', 'Contact hit', 'Speed'] as const).map((label) => {
    const term = element('dt', 'ball-detail-stat', label);
    const value = element('dd', 'ball-detail-value');
    const bar = element('span', 'ball-detail-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = element('span', 'ball-detail-fill');
    bar.append(fill);
    const number = element('span', 'ball-detail-number');
    value.append(bar, number);
    stats.append(term, value);
    return { fill, number };
  });

  const strongHeading = element('h2', 'ball-detail-heading ball-detail-strong', 'Strong vs');
  const strong = element('ul', 'ball-detail-matchups');
  const weakHeading = element('h2', 'ball-detail-heading ball-detail-weak', 'Weak vs');
  const weak = element('ul', 'ball-detail-matchups');
  const evenHeading = element('h2', 'ball-detail-heading', 'Even with');
  const even = element('ul', 'ball-detail-even');

  const tryIt = element('button', 'hud-button hud-button-primary');
  tryIt.type = 'button';
  let tryMatchup: Matchup | undefined;
  tryIt.addEventListener('click', () => {
    if (tryMatchup !== undefined) actions.onTry(tryMatchup);
  });

  // Grouped so a desktop can set the profile beside the Strong vs and Weak vs columns (ADR 0031);
  // each group keeps the root's gap, so a phone shows one column exactly as before.
  const group = (className: string, ...children: HTMLElement[]) => {
    const node = element('div', `ball-detail-group ${className}`);
    node.append(...children);
    return node;
  };
  root.append(
    group('ball-detail-profile', hero, stats),
    group('ball-detail-strong-group', strongHeading, strong),
    group('ball-detail-weak-group', weakHeading, weak),
    group('ball-detail-even-group', evenHeading, even),
    tryIt,
  );

  function opponentButton(id: string, iconPx: number, className: string): HTMLButtonElement {
    const button = element('button', className);
    button.type = 'button';
    const ball = byId.get(id);
    const canvas = element('canvas', 'ball-detail-row-icon');
    canvas.setAttribute('aria-hidden', 'true');
    if (ball !== undefined) drawBallIcon(canvas, ball, iconPx);
    button.append(canvas);
    button.addEventListener('click', () => {
      actions.onOpen(id);
    });
    return button;
  }

  function matchupRows(lines: readonly MatchupLine[]): HTMLElement[] {
    if (lines.length === 0) return [element('li', 'ball-detail-none', 'None in particular.')];
    return lines.map((line) => {
      const item = element('li', 'ball-detail-row');
      const button = opponentButton(line.opponent, ROW_ICON_PX, 'ball-detail-opponent');
      button.append(element('span', 'ball-detail-opponent-name', nameOf(line.opponent)));
      item.append(button, element('p', 'ball-detail-reason', line.reason));
      return item;
    });
  }

  return {
    element: root,
    show(id) {
      const ball = byId.get(id);
      if (ball === undefined) return;
      drawBallIcon(icon, ball, HERO_PX);
      setText(description, ball.description);
      const shares = statShares(ball, balls);
      const values = [
        [shares.health, ball.maxHealth],
        [shares.hit, ball.contactDamage],
        [shares.speed, ball.speed],
      ] as const;
      const speed = speedTrait(ball, balls);
      setText(trait, speed ?? '');
      trait.hidden = speed === undefined;
      statRows.forEach((row, index) => {
        const [share, value] = values[index] ?? [0, 0];
        row.fill.style.width = `${String(Math.round(share * 100))}%`;
        setText(row.number, String(value));
      });
      const lines = matchupsOf(id, roster);
      strong.replaceChildren(...matchupRows(lines.strong));
      weak.replaceChildren(...matchupRows(lines.weak));
      even.replaceChildren(
        ...lines.even.map((line) => {
          const item = element('li', 'ball-detail-even-ball');
          const button = opponentButton(line.opponent, EVEN_ICON_PX, 'ball-detail-even-button');
          button.setAttribute('aria-label', nameOf(line.opponent));
          button.title = nameOf(line.opponent);
          item.append(button);
          return item;
        }),
      );
      // A heading with nothing under it says nothing (the Brawler is strong vs no one).
      strongHeading.hidden = lines.strong.length === 0;
      weakHeading.hidden = lines.weak.length === 0;
      evenHeading.hidden = lines.even.length === 0;
      // Try it against a ball it is strong vs, so the first match shows what it's good at.
      const opponent = lines.strong[0]?.opponent ?? lines.weak[0]?.opponent ?? id;
      tryMatchup = { a: id, b: opponent };
      setText(tryIt, `Try it: ${ball.name} vs ${nameOf(opponent)}`);
    },
  };
}
