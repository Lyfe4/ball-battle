// Every screen and state the online flows reach, with the API answered by the test (ADR 0052, 0053,
// 0080, 0086): a friend's link opened, both lobbies (a friend's and a link's) and their endings,
// the lineups picked together, a live fight with its Leave and forfeit asked, the end with each
// rematch moment, and the failure and offline cards. `controls-look` walks them signed in; the
// screens are the page's own, reached by their URLs, so nothing here is a copy of a screen.
import type { ChallengeInfo } from '../api/challenges.ts';
import type { StartView } from '../api/start.ts';
import { liveSeries, rematch, turnsSeries } from './online-views-support.ts';
import { settle, until, visible } from './page-support.ts';
import { follow, OFFLINE, screenOn, withStatus } from './shell-routes-support.ts';

/** The test's API: a path's answer, changed as the walk goes. */
export type OnlineAnswers = Record<string, unknown>;

const START = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
/** The live series' id, ending in two digits of its own for each end. */
const SERIES = '11111111-2222-4333-8444-5555555555';
/** A series by turns, waiting on the other's pick (frame-anchors opens it too). */
export const TURNS_SERIES = '11111111-2222-4333-8444-666666666600';
/** Its answer, for a walk that opens it. */
export const turnsAnswers = (now: number): OnlineAnswers => ({
  [`/api/v1/series/${TURNS_SERIES}`]: turnsSeries(TURNS_SERIES, now),
});

const card = (over: Partial<ChallengeInfo>): ChallengeInfo => ({
  format: 'reveal',
  bestOf: 3,
  from: 'Sam_R',
  status: 'open',
  seriesId: null,
  startId: null,
  live: true,
  own: false,
  invitee: null,
  declined: false,
  blocked: null,
  ...over,
});

const start = (now: number): StartView => ({
  id: START,
  you: 'a',
  format: 'reveal',
  bestOf: 3,
  they: 'Sam_R',
  deadline: now + 55_000,
  now,
  draft: [],
  seq: 0,
  locked: false,
  theirsLocked: false,
  seriesId: null,
  filled: [],
  missed: [],
  rematchOf: null,
});

/** One state to look at: its name, its URL, what the API says first, and when it shows. */
export interface OnlineState {
  readonly name: string;
  readonly search: string;
  readonly answers: (now: number) => OnlineAnswers | Promise<OnlineAnswers>;
  /** Shown: the page has drawn it. */
  readonly ready: () => boolean;
  /** Taps that open the moment to look at (Leave's question). */
  readonly then?: () => Promise<void>;
}

const shows = (selector: string, text?: string) => () =>
  visible(selector).some((node) => text === undefined || node.textContent.includes(text));
const challenge = (token: string) => `/api/v1/challenges/${token}`;

export const ONLINE_STATES: readonly OnlineState[] = [
  {
    name: 'a friend’s link',
    search: '?challenge=tokopenxxxxxxxxxxxxxxx',
    answers: () => ({ [challenge('tokopenxxxxxxxxxxxxxxx')]: card({}) }),
    ready: shows('.notice .hud-button', 'Accept'),
  },
  {
    name: 'the friend lobby',
    search: '?challenge=toklobbyxxxxxxxxxxxxxx',
    answers: () => ({
      [challenge('toklobbyxxxxxxxxxxxxxx')]: card({ status: 'yours', own: true, invitee: 'Jo' }),
    }),
    ready: shows('.notice', 'Waiting for Jo'),
  },
  {
    name: 'the friend lobby, its link open',
    search: '?challenge=toklobbyxxxxxxxxxxxxxx',
    answers: () => ({
      [challenge('toklobbyxxxxxxxxxxxxxx')]: card({ status: 'yours', own: true, invitee: 'Jo' }),
    }),
    ready: shows('.notice', 'Waiting for Jo'),
    then: async () => {
      const fold = visible('.notice-fold')[0];
      if (fold instanceof HTMLDetailsElement) fold.open = true;
      await settle();
    },
  },
  {
    name: 'the friend lobby, said no thanks',
    search: '?challenge=tokdeclinedxxxxxxxxxxx',
    answers: () => ({
      [challenge('tokdeclinedxxxxxxxxxxx')]: card({
        status: 'stopped',
        own: true,
        invitee: 'Jo',
        declined: true,
      }),
    }),
    ready: shows('.notice', 'said no thanks'),
  },
  {
    name: 'a challenge of yours a newer one replaced',
    search: '?challenge=toksupersededxxxxxxxxx',
    answers: () => ({
      [challenge('toksupersededxxxxxxxxx')]: card({
        status: 'stopped',
        own: true,
        invitee: 'Jo',
        superseded: true,
      }),
    }),
    ready: shows('.notice', 'You sent a new challenge'),
  },
  {
    name: 'the friend lobby, unanswered in time',
    search: '?challenge=tokunansweredxxxxxxxxx',
    answers: () => ({
      [challenge('tokunansweredxxxxxxxxx')]: card({
        status: 'stopped',
        own: true,
        invitee: 'Jo',
        unanswered: true,
        inviteeFriend: 'friend-1',
      }),
    }),
    ready: shows('.notice', 'Jo didn’t answer'),
  },
  {
    name: 'the link lobby',
    search: '?challenge=toklinkxxxxxxxxxxxxxxx',
    answers: () => ({
      [challenge('toklinkxxxxxxxxxxxxxxx')]: card({ status: 'yours', own: true }),
    }),
    ready: shows('.notice', 'Waiting for anyone with the link'),
  },
  {
    name: 'a link that stopped',
    search: '?challenge=tokstoppedxxxxxxxxxxxx',
    answers: () => ({ [challenge('tokstoppedxxxxxxxxxxxx')]: card({ status: 'stopped' }) }),
    ready: shows('.notice', 'stopped waiting'),
  },
  {
    name: 'a link taken',
    search: '?challenge=toktakenxxxxxxxxxxxxxx',
    answers: () => ({ [challenge('toktakenxxxxxxxxxxxxxx')]: card({ status: 'taken' }) }),
    ready: shows('.notice', 'Challenge taken'),
  },
  {
    name: 'a link accepted',
    search: '?challenge=tokacceptedxxxxxxxxxxx',
    answers: () => ({
      [challenge('tokacceptedxxxxxxxxxxx')]: card({ status: 'accepted', startId: START }),
    }),
    ready: shows('.notice', 'Challenge accepted'),
  },
  {
    name: 'a link that failed',
    search: '?challenge=tokfailedxxxxxxxxxxxxx',
    answers: () => ({
      [challenge('tokfailedxxxxxxxxxxxxx')]: withStatus(500, {
        error: { code: 'internal', message: 'x' },
      }),
    }),
    ready: shows('.notice .hud-button', 'Try again'),
  },
  {
    name: 'a link opened offline',
    search: '?challenge=tokofflinexxxxxxxxxxxx',
    answers: () => ({ [challenge('tokofflinexxxxxxxxxxxx')]: OFFLINE }),
    ready: shows('.notice', 'offline'),
  },
  {
    name: 'the lineups picked together',
    search: `?start=${START}`,
    answers: (now) => ({ [`/api/v1/starts/${START}`]: start(now) }),
    ready: shows('.lineup-step .lineup-status'),
  },
  {
    name: 'your lineup in, waiting for theirs',
    search: `?start=${START}`,
    answers: (now) => ({
      [`/api/v1/starts/${START}`]: {
        ...start(now),
        draft: ['archer', 'thorns', 'vampire'],
        locked: true,
      },
    }),
    ready: shows('.notice .waiting', 'lineup'),
  },
  {
    name: 'a game by turns, their pick',
    search: `?online=${TURNS_SERIES}`,
    answers: turnsAnswers,
    ready: shows('#online-series .waiting', 'Waiting for Sam_R'),
  },
  {
    name: 'a live fight',
    search: `?online=${SERIES}00`,
    answers: async (now) => ({
      [`/api/v1/series/${SERIES}00`]: await liveSeries(`${SERIES}00`, false, now),
    }),
    ready: shows('.series-leave', 'Leave'),
  },
  {
    name: 'a live fight, Leave asked',
    search: `?online=${SERIES}00`,
    answers: async (now) => ({
      [`/api/v1/series/${SERIES}00`]: await liveSeries(`${SERIES}00`, false, now),
    }),
    ready: shows('.series-leave', 'Leave'),
    then: async () => {
      visible('.series-leave')[0]?.click();
      await settle();
    },
  },
  {
    name: 'the end, a rematch offered',
    search: `?online=${SERIES}01`,
    answers: async (now) => ({
      [`/api/v1/series/${SERIES}01`]: await liveSeries(`${SERIES}01`, true, now),
      [`/api/v1/series/${SERIES}01/rematch`]: rematch('none', now),
    }),
    ready: shows('#online-series .hud-button', 'Rematch'),
  },
  {
    name: 'the end, a rematch asked of you',
    search: `?online=${SERIES}02`,
    answers: async (now) => ({
      [`/api/v1/series/${SERIES}02`]: await liveSeries(`${SERIES}02`, true, now),
      [`/api/v1/series/${SERIES}02/rematch`]: rematch('asked', now, 'b'),
    }),
    ready: shows('#online-series .hud-button', 'No thanks'),
  },
  {
    name: 'the end, your rematch asked',
    search: `?online=${SERIES}03`,
    answers: async (now) => ({
      [`/api/v1/series/${SERIES}03`]: await liveSeries(`${SERIES}03`, true, now),
      [`/api/v1/series/${SERIES}03/rematch`]: rematch('asked', now, 'a'),
    }),
    ready: shows('#online-series .pick-clock', 'Waiting for'),
  },
  {
    name: 'the end, rematch declined',
    search: `?online=${SERIES}04`,
    answers: async (now) => ({
      [`/api/v1/series/${SERIES}04`]: await liveSeries(`${SERIES}04`, true, now),
      [`/api/v1/series/${SERIES}04/rematch`]: rematch('declined', now, 'a'),
    }),
    ready: shows('#online-series .series-result'),
  },
];

/**
 * Walks every online state: each one's answers into `api`, its URL followed, then `look` once it
 * shows. Fails with the state's name when one never shows.
 */
export async function walkOnline(
  api: OnlineAnswers,
  look: (state: OnlineState) => Promise<void>,
): Promise<void> {
  for (const state of ONLINE_STATES) {
    Object.assign(api, await state.answers(Date.now()));
    await follow(state.search);
    await until(state.ready, 8_000, state.name, false);
    await state.then?.();
    await settle();
    if (screenOn() === undefined) throw new Error(`${state.name}: no screen`);
    await look(state);
  }
}
