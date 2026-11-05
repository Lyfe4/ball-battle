// No dead ends (a standing rule): every moment of every series offers the player a way forward.
// Walks every format through every outcome order (wins either way, draws, sudden death) and every
// pick, played live and replayed from its link, at each moment the screen can show: a round being
// fought, its result (also as Resume shows it, with the round recorded), and the end. Each moment's
// actions must be non-empty outside a fight, and each must actually lead on.
import { describe, expect, it } from 'vitest';
import {
  advanceSession,
  beginSession,
  pickInSession,
  resolvePicks,
  withLinkPicks,
  type SeriesSession,
} from '../../app/series-session.ts';
import { randomBot } from '../../sim/bot.ts';
import { RULESET_VERSION } from '../../sim/ruleset.ts';
import {
  FORMATS,
  recordOutcome,
  setupWithPicks,
  type Outcome,
  type SeriesSetup,
} from '../../sim/series.ts';
import { seriesScreenOf, type SeriesScreen } from './series-view.ts';

const setupOf = (format: (typeof FORMATS)[number], b: SeriesSetup['b']): SeriesSetup => ({
  ruleset: RULESET_VERSION,
  seed: 11,
  a: ['brawler', 'archer', 'magnet'],
  b,
  opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: 11 },
  ...(format === 'blind' ? {} : { format }),
});

const LINEUPS: readonly SeriesSetup['b'][] = [
  ['thorns', 'speedster', 'frost'],
  ['ghost', 'necromancer', 'quake'],
];
/** At most this many draws per series: enough for a replay, two, and sudden death. */
const MAX_DRAWS = 3;

/** The screen at this moment: settled says whether the match on screen has ended. */
const screenOf = (session: SeriesSession, settled: boolean): SeriesScreen =>
  seriesScreenOf({
    state: session.state,
    current: session.current,
    settled,
    linkState: withLinkPicks(session),
  });

interface Walked {
  /** Every moment checked. */
  moments: number;
  /** Decided series with the outcomes that decided them, to replay from their links. */
  decided: { setup: SeriesSetup; outcomes: readonly Outcome[] }[];
  /** Moments with nothing to do. */
  deadEnds: string[];
}

/**
 * From a session with a match on screen: checks the fight, then each outcome's result screen, and
 * follows every action it offers. `outcomes` fixes the results (a link replay); else every outcome
 * is tried.
 */
function walk(
  session: SeriesSession,
  walked: Walked,
  path: readonly Outcome[],
  outcomes?: readonly Outcome[],
): void {
  const fight = screenOf(session, false);
  walked.moments += 1;
  if (session.current === undefined || fight.phase !== 'playing') {
    walked.deadEnds.push(`${path.join('')}: no match to fight`);
    return;
  }
  const draws = path.filter((outcome) => outcome === 'draw').length;
  const tries: readonly Outcome[] =
    outcomes !== undefined
      ? [outcomes[path.length] ?? 'a']
      : draws < MAX_DRAWS
        ? ['a', 'b', 'draw']
        : ['a', 'b'];
  for (const outcome of tries) {
    const now = [...path, outcome];
    const settled = {
      ...session,
      state: recordOutcome(session.state, outcome),
      recorded: true,
    };
    const screen = screenOf(settled, true);
    walked.moments += 1;
    const where = `${settled.state.setup.format ?? 'blind'} ${now.join('')}`;
    if (screen.actions.length === 0) {
      walked.deadEnds.push(`${where}: ${screen.phase} with no action`);
      continue;
    }
    if (screen.phase === 'finished') {
      walked.decided.push({ setup: setupWithPicks(settled.state), outcomes: now });
      continue;
    }
    if (screen.actions.includes('play')) {
      walk(resolvePicks(advanceSession(settled), randomBot), walked, now, outcomes);
    }
    if (screen.actions.includes('pick')) {
      for (const option of screen.choice?.options ?? []) {
        walk(resolvePicks(pickInSession(settled, option.ball), randomBot), walked, now, outcomes);
      }
    }
  }
}

describe('no dead ends in a series', () => {
  for (const format of FORMATS) {
    it(`${format}: every moment offers a way on, live and replayed from its link`, () => {
      const live: Walked = { moments: 0, decided: [], deadEnds: [] };
      for (const b of LINEUPS) {
        const start = resolvePicks(beginSession(setupOf(format, b)), randomBot);
        // Reveal's round-1 answer is made on the setup screen before the series starts: every
        // answer is walked.
        const answers = start.current === undefined ? screenOf(start, false).choice : undefined;
        if (answers === undefined) walk(start, live, []);
        for (const { ball } of answers?.options ?? []) {
          walk(resolvePicks(pickInSession(start, ball), randomBot), live, []);
        }
      }
      expect(live.deadEnds).toStrictEqual([]);
      expect(live.decided.length).toBeGreaterThan(0);

      const replayed: Walked = { moments: 0, decided: [], deadEnds: [] };
      for (const { setup, outcomes } of live.decided) {
        walk(resolvePicks(beginSession(setup, true), randomBot), replayed, [], outcomes);
      }
      expect(replayed.deadEnds).toStrictEqual([]);
      expect(replayed.decided).toHaveLength(live.decided.length);
    });
  }
});
