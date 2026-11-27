// One waiting look (2026-11-27): every wait on another player shows the one waiting ball
// (src/ui/waiting.ts) — the lobby (a friend's or a link's), a lineup in and waiting for theirs, a
// rematch asked, a pick by turns the other owes. A staging check found the friend lobby showing
// the friend's letter disc instead. Read from what the screen says: a heading or line that starts
// "Waiting for" someone (not "Waiting for you", which is the Friends tab's list of what waits on
// you) needs a ball laid out on the same screen.
import { visible } from './page-support.ts';

/** Where a wait is said: the waiting card's title, the pick clock's, a series' or notice's line. */
const SAID = 'h1, h2, .waiting-title-text, .pick-clock-title-text, .series-note, .notice-text';

/** A wait on another player said on screen without the waiting ball, by `where`. */
export function waitingProblems(where: string): string[] {
  const says = visible(SAID).filter((node) => {
    const text = node.textContent.trim();
    return text.startsWith('Waiting for') && !text.startsWith('Waiting for you');
  });
  if (says.length === 0) return [];
  const balls = visible('.waiting-ball').filter((ball) => ball.getClientRects().length > 0);
  return balls.length > 0
    ? []
    : [`${where}: says "${says[0]?.textContent.trim() ?? ''}" with no waiting ball`];
}
