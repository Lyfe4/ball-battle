// The real page in a real browser (`pnpm test:browsers`): a shared Reveal link replays its series
// with a way on after every round. Before the fix, round 1's result showed the track and only
// "Leave series": round 2's pick is the link's to make, so no pick was asked for, and Play round
// was hidden because a pick was due (no dead ends, series-view.ts).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { writeSeriesParams } from '../app/series-url.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { botPick, randomBot } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  setupWithPicks,
  startSeries,
  type SeriesState,
} from '../sim/series.ts';
import { matchWorld, playToEnd } from '../sim/series-verify.ts';
import { button, settle, visible } from './page-support.ts';

/** A decided Reveal series as a player would have played it: always the first ball left. */
function decidedReveal(seed: number): SeriesState {
  let state = startSeries({
    ruleset: RULESET_VERSION,
    seed,
    a: ['archer', 'ghost', 'speedster'],
    b: randomBot.pickLineup(seed, [...BALL_LOOKUP.keys()]),
    opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: seed },
    format: 'reveal',
  });
  while (state.winner === undefined) {
    const due = awaitingPick(state);
    const pick =
      due === 'a'
        ? remainingOf(state, 'a')[0]
        : due === 'b'
          ? botPick(randomBot, state)
          : undefined;
    if (pick !== undefined) {
      state = recordPick(state, pick);
      continue;
    }
    const match = nextMatch(state);
    if (match === undefined) throw new Error('No match to play');
    const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
    if (end.match.status !== 'finished') throw new Error('The match did not finish');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
  return state;
}

const fighting = () => visible('.hud-ball-name').map((row) => row.textContent);
const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];

async function until(done: () => boolean, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error('Timed out waiting for the page');
    await settle();
  }
}

describe('a shared Reveal link', () => {
  it('offers Play round 2 after round 1, which plays the link’s round 2', async () => {
    const decided = decidedReveal(1);
    const round2 = decided.rounds[1];
    if (round2 === undefined) throw new Error('Expected a second round');
    // Fast playback, so round 1 ends in a few seconds.
    window.localStorage.setItem('ballbattle.speed', '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    const params = new URLSearchParams();
    writeSeriesParams(params, setupWithPicks(decided));
    start.search = `?${params.toString()}`;
    history.replaceState(null, '', start);
    await import('../main.ts');

    await until(() => phase() === 'between', 60_000);
    button(`Play round 2`).click();
    await settle();
    expect(phase()).toBe('playing');
    const [you, bot] = fighting();
    expect(you).toContain(BALL_LOOKUP.get(round2.a)?.name);
    expect(bot).toContain(BALL_LOOKUP.get(round2.b)?.name);
  }, 90_000);
});
