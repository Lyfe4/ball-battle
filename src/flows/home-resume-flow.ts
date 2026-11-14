// Home's Resume series (ADR 0046), through the real page in a frame it can reload (ADR 0042): with a
// series held, home's main button resumes it in one tap and says its format and score; a reload
// keeps it; "New series" beside it forgets it and opens Reveal's lineup, after which home plays
// again, reload or not. The series is pinned (fixed-seed.ts): seed 85 at Normal draws round 1, so
// the flow also proves a drawn round is replayed before home offers to resume.
import { expect } from 'vitest';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SERIES_STORAGE_KEY } from '../app/series-save.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { pinSeed } from './fixed-seed.ts';
import { backIn, openFramed, reload, shown, waitFor, type Framed } from './reload-support.ts';
import { settle } from './page-support.ts';

const search = (framed: Framed) => framed.win().location.search;
const step = (framed: Framed) => new URLSearchParams(search(framed)).get('step');
/** The score a line shows ("You 1 – 0 Bot" on the bar, "You 1–0 Bot" on home) as [you, bot]. */
function scoreIn(line: string | null | undefined): [number, number] {
  const found = /You\s*(\d)\s*–\s*(\d)\s*Bot/.exec(line ?? '');
  return found === null ? [0, 0] : [Number(found[1]), Number(found[2])];
}

/** The score the series screen shows: on the bar mid-round, on the track between rounds. */
const seriesScore = (framed: Framed) =>
  shown(framed, '.series-bar-score-text, .series-track-score')[0]?.textContent;

const phase = (framed: Framed) =>
  framed.doc().querySelector<HTMLElement>('#series')?.dataset['phase'];

function one(framed: Framed, selector: string): HTMLElement {
  const found = shown(framed, selector);
  expect(found, selector).toHaveLength(1);
  const [only] = found;
  if (only === undefined) throw new Error(`No ${selector}`);
  return only;
}

async function press(framed: Framed, selector: string): Promise<void> {
  one(framed, selector).click();
  await settle();
}

/** Home's main button: its words, and whether New series shows beside it. */
function home(framed: Framed) {
  expect(search(framed)).toBe('');
  const play = one(framed, '.home-play');
  return {
    label: play.querySelector('.home-play-label')?.textContent,
    meta: play.querySelector('.home-play-meta')?.textContent,
    spoken: play.getAttribute('aria-label'),
    fresh: shown(framed, '.home-new-series').length,
  };
}

/** The between-rounds button a drawn round leaves, if it shows. */
const replayOffered = (framed: Framed) =>
  shown(framed, '#series button').find((node) => node.textContent.trim() === '↻ Replay round');

/** Plays a Reveal series from home until round 1 is decided, then leaves it with two Backs. */
async function holdAfterRound1(framed: Framed): Promise<string> {
  await press(framed, '.home-play');
  for (const id of ['storm', 'berserker', 'brawler']) {
    await press(framed, `.lineup-step .ball-tile[data-ball-id="${id}"]`);
  }
  await press(framed, '.lineup-step .screen-footer .hud-button-primary');
  shown(framed, '.answer-step .pick-row-pick')[0]?.click();
  await settle();
  expect(step(framed)).toBe('play');
  // Round 1, played out: a draw is replayed (its own button, then a new Fight!), so wait until a
  // side has won it.
  let replayed = false;
  await waitFor(
    framed,
    () => {
      shown(framed, '.ready-fight')[0]?.click();
      const replay = replayOffered(framed);
      replay?.click();
      replayed ||= replay !== undefined;
      const [you, bot] = scoreIn(seriesScore(framed));
      return you + bot === 1;
    },
    120_000,
    'round 1 to be decided',
  );
  // The pinned seed draws round 1; if a new ruleset moves it, pick another drawn seed (see DRAWN_ROUND_1).
  expect(replayed, 'round 1 was drawn and replayed').toBe(true);
  const score = seriesScore(framed) ?? '';
  await backIn(framed);
  expect(step(framed)).toBe('lineup');
  await backIn(framed);
  return score;
}

/** Seed 85 at Normal: round 1 (Storm against the bot's Spider) is a draw, then replayed. */
const DRAWN_ROUND_1 = 85;

export async function runHomeResumeFlow(): Promise<void> {
  window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
  window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'normal');
  pinSeed(DRAWN_ROUND_1);
  const framed = await openFramed('');

  // Nothing held: Play, and no New series.
  expect(home(framed)).toMatchObject({ label: 'Play', fresh: 0 });

  const score = await holdAfterRound1(framed);
  const held = home(framed);
  expect(held.label).toBe('Resume series');
  expect(held.meta).toMatch(/^Best of 3 · Reveal · You [01]–[01] Bot$/);
  expect(scoreIn(held.meta)).toStrictEqual(scoreIn(score));
  expect(held.spoken).toMatch(/^Resume series: Best of 3, Reveal, you [01], bot [01]$/);
  expect(held.fresh).toBe(1);
  expect(framed.doc().activeElement?.classList.contains('home-play')).toBe(true);

  // One tap resumes it where it was: after round 1, same score.
  await press(framed, '.home-play');
  expect(step(framed)).toBe('play');
  expect(phase(framed)).not.toBe('playing');
  expect(scoreIn(seriesScore(framed))).toStrictEqual(scoreIn(score));
  await backIn(framed);
  expect(home(framed)).toStrictEqual(held);

  // A reload keeps it, and Resume still carries on.
  await reload(framed);
  expect(home(framed)).toStrictEqual(held);
  await press(framed, '.home-play');
  expect(step(framed)).toBe('play');
  expect(scoreIn(seriesScore(framed))).toStrictEqual(scoreIn(score));
  await backIn(framed);

  // New series forgets it and opens Reveal's lineup with nothing to resume.
  await press(framed, '.home-new-series');
  expect(search(framed)).toBe('?mode=bo3&fmt=reveal&step=lineup');
  expect(shown(framed, '.resume-card')).toHaveLength(0);
  expect(framed.win().localStorage.getItem(SERIES_STORAGE_KEY)).toBeNull();
  await backIn(framed);
  expect(home(framed)).toMatchObject({ label: 'Play', fresh: 0 });
  await reload(framed);
  expect(home(framed)).toMatchObject({ label: 'Play', fresh: 0 });
}
