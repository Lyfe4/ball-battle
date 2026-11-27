// A reload in the middle of the guided first series (ADR 0090 addendum, 1g; ADR 0042), at 390 x 664
// through the real page in a frame: on round 1's pick it comes back to the same toss, the same
// shown ball, its coach (2 of 3) and its lit row; mid-fight and on round 2's pick it comes back to
// the same series and its coach (3 of 3). The device stays in one first-series state the whole way
// ('guided', never written twice or ended early by the save), and is 'graduated' at the result.
import { describe, expect, it } from 'vitest';
import { FIRST_SERIES_STORAGE_KEY } from '../app/first-series.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { settle } from './page-support.ts';
import { fightShown } from './reload-screen.ts';
import {
  buttonIn,
  openFramed,
  paramOf,
  reload,
  seriesPhase,
  shown,
  tossedIn,
  waitFor,
  type Framed,
} from './reload-support.ts';

const stored = () => localStorage.getItem(FIRST_SERIES_STORAGE_KEY);

/** Plays the round under way: Fight! on its ready card, then to its end. */
async function playRound(framed: Framed, what: string): Promise<void> {
  await waitFor(
    framed,
    () => fightShown(framed) || seriesPhase(framed) !== 'playing',
    15_000,
    `${what}: Fight!`,
  );
  shown(framed, '.ready-fight')[0]?.click();
  await waitFor(framed, () => seriesPhase(framed) !== 'playing', 150_000, `${what} to end`);
}
const textIn = (framed: Framed, selector: string) => shown(framed, selector)[0]?.textContent.trim();

/** Round 1's pick as it stands: the shown ball's name in the banner, the coach, the lit row. */
function firstPick(framed: Framed) {
  return {
    banner: textIn(framed, '.answer-step .series-banner'),
    coach: textIn(framed, '.answer-guide .coach-step'),
    lit: shown(framed, '.answer-step .pick-row[data-coached]').map((row) => row.dataset['ball']),
  };
}

describe('a reload in the first series', () => {
  it('comes back to the same guided series, in one first-series state', async () => {
    // A brand-new device (first-visit-flow.ts's openAsNewDevice), fights at 2x.
    localStorage.removeItem(FIRST_SERIES_STORAGE_KEY);
    localStorage.setItem(SPEED_STORAGE_KEY, '2');
    const framed = await openFramed('');
    expect(shown(framed, '.home-play-meta')[0]?.textContent).toContain('Your first series');
    shown(framed, '.home-play')[0]?.click();
    await settle();
    expect(stored()).toBe('guided');
    buttonIn(framed, 'Pick for me').click();
    buttonIn(framed, 'Reveal lineups').click();
    await waitFor(framed, () => paramOf(framed, 'step') === 'answer', 10_000, 'round 1’s pick');
    await tossedIn(framed);
    const before = firstPick(framed);
    expect(before.coach).toBe('2 of 3');
    expect(before.lit).toHaveLength(1);

    // Reloaded on round 1's pick: the same series, its coach and its lit row, no toss again.
    await reload(framed);
    await tossedIn(framed);
    expect(paramOf(framed, 'step')).toBe('answer');
    expect(firstPick(framed)).toStrictEqual(before);
    expect(stored()).toBe('guided');

    // The lit row, then a reload mid-fight: the same round from its Fight! moment.
    shown(framed, '.answer-step .pick-row[data-coached] .pick-row-pick')[0]?.click();
    await waitFor(framed, () => seriesPhase(framed) === 'playing', 10_000, 'round 1’s fight');
    await waitFor(framed, () => fightShown(framed), 15_000, 'round 1’s Fight!');
    shown(framed, '.ready-fight')[0]?.click();
    await reload(framed);
    await waitFor(framed, () => seriesPhase(framed) !== 'none', 10_000, 'the series again');
    expect(stored()).toBe('guided');
    await playRound(framed, 'round 1');

    // On to the result, reloading once on round 2's pick: its coach is back (3 of 3).
    let reloaded = false;
    for (let guard = 0; guard < 12; guard++) {
      if (seriesPhase(framed) === 'playing') await playRound(framed, 'a round');
      if (seriesPhase(framed) === 'finished') break;
      const picks = shown(framed, '#series .pick-row-pick');
      if (picks.length > 0) {
        expect(textIn(framed, '#series .series-coach .coach-step')).toBe('3 of 3');
        if (!reloaded) {
          reloaded = true;
          await reload(framed);
          await waitFor(framed, () => seriesPhase(framed) !== 'none', 10_000, 'round 2 again');
          expect(textIn(framed, '#series .series-coach .coach-step')).toBe('3 of 3');
          expect(stored()).toBe('guided');
          continue;
        }
        picks[0]?.click();
      } else shown(framed, '#series .hud-actions .hud-button-primary')[0]?.click();
      await waitFor(framed, () => seriesPhase(framed) === 'playing', 10_000, 'the next round');
      await playRound(framed, 'the next round');
    }
    expect(seriesPhase(framed)).toBe('finished');
    expect(stored()).toBe('graduated');
    expect(shown(framed, '.unlock-card')).toHaveLength(1);

    // A reload of the result keeps one state: graduated, no guided series again.
    await reload(framed);
    expect(stored()).toBe('graduated');
  }, 600_000);
});
