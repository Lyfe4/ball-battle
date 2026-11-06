import { drawBallIcon } from '../render/ball-icon.ts';
import { ballColor, isRepeatOfEarlierBall } from '../render/ball-colors.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { confettiPieces } from './confetti.ts';
import { element } from './dom.ts';

const ICON_PX = 48;

export interface WinnerSticker {
  /**
   * Shows the sticker for the winner of a finished match once `due`, and takes it away for any
   * other world (a new match, a draw). Cheap to call every frame: it only touches the page when
   * what it shows changes.
   */
  update(world: WorldState, due: boolean): void;
}

/**
 * The Winner sticker over the arena (ADR 0032): the winner's drawing, "Winner!" and its name on a
 * tilted cream card, with a short, capped confetti pop in the winner's colour and the two accents.
 * It is decoration: aria-hidden, because the HUD's live region already says who won. With reduced
 * motion it appears without the pop (winner-sticker.css).
 */
export function createWinnerSticker(
  container: HTMLElement,
  lookup: DefinitionLookup,
): WinnerSticker {
  const root = element('div', 'winner-sticker');
  root.setAttribute('aria-hidden', 'true');
  root.hidden = true;
  container.append(root);
  let shown = '';

  return {
    update(world, due) {
      const result = world.match.status === 'finished' ? world.match.result : undefined;
      const winnerId = due && result?.kind === 'win' ? result.winnerId : '';
      // A new match starts at tick 0, so the key changes even when the same ball wins again.
      const key = winnerId === '' ? '' : `${winnerId}@${String(world.tick)}`;
      if (key === shown) return;
      shown = key;
      root.replaceChildren();
      root.hidden = winnerId === '';
      const index = world.balls.findIndex((ball) => ball.id === winnerId);
      const ball = world.balls[index];
      const definition = ball === undefined ? undefined : lookup.get(ball.definitionId);
      if (ball === undefined || definition === undefined) {
        root.hidden = true;
        return;
      }
      const isRepeat = isRepeatOfEarlierBall(world.balls, index);
      root.style.setProperty('--ball-color', ballColor(definition.color, isRepeat));

      const confetti = element('div', 'winner-confetti');
      confetti.append(
        ...confettiPieces().map(({ x, y, turn }) => {
          const piece = element('i', 'winner-confetti-piece');
          piece.style.setProperty('--x', `${x.toFixed(1)}%`);
          piece.style.setProperty('--y', `${y.toFixed(1)}%`);
          piece.style.setProperty('--turn', `${String(turn)}deg`);
          // The pop starts nearer the sticker and flies out to its place.
          piece.style.setProperty('--from-x', `${((50 - x) * 3).toFixed(0)}px`);
          piece.style.setProperty('--from-y', `${((50 - y) * 3).toFixed(0)}px`);
          return piece;
        }),
      );

      const card = element('div', 'winner-sticker-card');
      const icon = element('canvas', 'winner-sticker-icon');
      drawBallIcon(icon, definition, ICON_PX, isRepeat);
      card.append(
        icon,
        element('span', 'winner-sticker-title', 'Winner!'),
        element('span', 'winner-sticker-name', definition.name),
      );
      root.append(confetti, card);
    },
  };
}
