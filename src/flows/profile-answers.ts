// Profile's record and All matches' next page (ADR 0088, 0089), as the flows' fake API answers them
// for an account with a long history: 25 matches, a forfeit of each kind among the first, and a
// second page that ends the list; and Play's "Who do you want to play?" opened for a walk. Shared
// by the controls-look and axe walks.
import { recordFixture, seriesFixture } from '../api/record-support.ts';
import type { RecentSeries } from '../api/record.ts';
import { settle, until, visible } from './page-support.ts';
import { follow, onScreen } from './shell-routes-support.ts';

const NAMES = ['Robin', 'Jo', 'Alex', 'Mina', 'Łukasz', 'Priya', 'Kai', 'Yuki'];
const ENDINGS = ['youLeft', 'theyLeft', 'yourTime', 'theirTime'] as const;
const DAY_MS = 86_400_000;

const matches = (from: number, count: number): RecentSeries[] =>
  Array.from({ length: count }, (_, at) => {
    const n = from + at;
    return seriesFixture({
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      opponent: n === 7 ? null : (NAMES[n % NAMES.length] ?? 'Jo'),
      won: n % 3 !== 1,
      live: n % 4 !== 2,
      forfeit: n >= 1 && n <= 4,
      ending: n >= 1 && n <= 4 ? (ENDINGS[n - 1] ?? null) : null,
      finishedAt: new Date(Date.now() - n * DAY_MS).toISOString(),
    });
  });

export const RECORD_ANSWERS = {
  '/api/v1/me/record': recordFixture({
    wins: 17,
    played: 25,
    recent: matches(0, 20),
    next: '2026-11-01T10:00:00.000000Z_00000000-0000-4000-8000-000000000019',
  }),
  '/api/v1/me/matches': { matches: matches(20, 5), next: null },
};

/** On Profile: opens Your stats from the record card, runs `check` on it, and closes it. */
export async function onStatsSheet(check: () => Promise<void>): Promise<void> {
  await until(() => visible('button.profile-stats').length > 0, 5_000, 'the record card', false);
  visible('button.profile-stats')[0]?.click();
  await until(() => document.querySelector('dialog[open]') !== null, 5_000, 'Your stats', false);
  await settle();
  await check();
  document
    .querySelector('dialog[open]')
    ?.querySelector<HTMLButtonElement>('.close-button')
    ?.click();
  await settle();
}

/**
 * On Play, signed in with friends: Play against a friend opens "Who do you want to play?" (ADR
 * 0089); runs `check` on it, closes it, and puts Play back on the bot.
 */
export async function onWhoSheet(check: () => Promise<void>): Promise<void> {
  localStorage.setItem('ballbattle.playOpponent', 'friend');
  await follow('?view=manual');
  await follow('');
  await onScreen('home');
  visible('.home-play')[0]?.click();
  const sheet = () => document.querySelector<HTMLDialogElement>('dialog.who-sheet');
  await until(() => sheet()?.open === true, 5_000, 'Who do you want to play?', false);
  await until(() => visible('.who-sheet .friends-name').length > 0, 5_000, 'the friends', false);
  await settle();
  await check();
  sheet()?.querySelector<HTMLButtonElement>('.close-button')?.click();
  await settle();
  localStorage.setItem('ballbattle.playOpponent', 'bot');
}
