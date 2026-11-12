// Reload-safe series (ADR 0042), through the real page in a frame that is reloaded as a browser (or
// Safari in the background) reloads it. Run at 375 x 812, 390 x 664 and 1280 x 800. At every step
// of a series in every format (the lineup, round 1's pick, the Fight! moment, mid-fight, between
// rounds, after a draw, sudden death and the result) a reload comes back to exactly the same
// screen; a fight that was under way starts again from its Fight! moment, drawing the same opening.
// The bot's hidden lineup is never in the URL or on screen before its time. Leave series and New
// series forget the series, and a save from another ruleset, or a broken one, is dropped with a
// way on.
import { expect } from 'vitest';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { pagePositions, SUDDEN_DEATH } from '../app/series-save-support.ts';
import {
  loadSeries,
  saveSeries,
  SERIES_SETUP_STORAGE_KEY,
  SERIES_STORAGE_KEY,
} from '../app/series-save.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { READY_CARD_STORAGE_KEY, TIPS_STORAGE_KEY } from '../app/tips.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import type { Format, Lineup } from '../sim/series.ts';
import { settle } from './page-support.ts';
import {
  backIn,
  buttonIn,
  openFramed,
  paramOf,
  reload,
  seriesPhase,
  shown,
  visit,
  waitFor,
  type Framed,
} from './reload-support.ts';

import {
  checkBotHidden,
  fightShown,
  reloadsTo,
  steady,
  storage,
  tapBall,
  wait,
  type Screen,
} from './reload-screen.ts';

/** A decided series' link, and the balls of its round 1. */
interface Shared {
  readonly search: string;
  readonly round1: readonly [string, string];
}

/** A whole series played live, reloaded at every step and once left with Back and resumed. */
async function liveSeries(
  framed: Framed,
  format: Format,
  level: string,
  own: Lineup,
): Promise<Shared> {
  storage().setItem(BOT_LEVEL_STORAGE_KEY, level);
  const fmt = format === 'blind' ? '' : `&fmt=${format}`;
  await visit(framed, `?mode=bo3${fmt}&step=lineup`);
  const label = `${format} (${level})`;

  // The lineup: a tray half built survives a reload.
  tapBall(framed, own[0] ?? '');
  tapBall(framed, own[1] ?? '');
  await reloadsTo(framed, `${label}: lineup`, false);
  tapBall(framed, own[2] ?? '');
  shown(framed, '.lineup-step .screen-footer .hud-button-primary')[0]?.click();
  await settle();

  if (format !== 'blind') {
    // Round 1's pick: the same toss, the same bot ball shown, the same rows.
    expect(paramOf(framed, 'step')).toBe('answer');
    await reloadsTo(framed, `${label}: round 1 pick`, false);
    shown(framed, '.answer-step .pick-row-pick')[0]?.click();
    await settle();
  }

  for (let round = 1; ; round += 1) {
    const where = `${label}: round ${String(round)}`;
    await waitFor(() => fightShown(framed), 15_000, `${where} Fight!`);
    checkBotHidden(framed, `${where} Fight!`);
    const ready = await reloadsTo(framed, `${where} Fight!`, true);
    // The words and Fight! are compared mid-fight; the drawn opening was compared just above, on
    // the same path (the match put back from its Fight! moment).
    const readyWords: Screen = { search: ready.search, title: ready.title, parts: ready.parts };

    // Mid-fight: the round starts again from its Fight! moment, the same opening drawn.
    shown(framed, '.ready-fight')[0]?.click();
    await wait(700);
    expect(seriesPhase(framed)).toBe('playing');
    await reloadsTo(framed, `${where} mid-fight`, false, readyWords);

    shown(framed, '.ready-fight')[0]?.click();
    await waitFor(() => seriesPhase(framed) !== 'playing', 150_000, `${where} to end`);
    const decided = seriesPhase(framed) === 'finished';
    checkBotHidden(framed, `${where} result`);
    const between = await reloadsTo(
      framed,
      `${where} ${decided ? 'series result' : 'between rounds'}`,
      false,
    );
    if (decided) break;

    if (round === 1) {
      // Back holds the series (ADR 0025); a reload keeps it held, and Resume carries on.
      await backIn(framed);
      expect(paramOf(framed, 'step')).toBe('lineup');
      await reloadsTo(framed, `${where} held`, false);
      buttonIn(framed, 'Resume series').click();
      await settle();
      expect({ where, ...(await steady(framed, false)) }).toStrictEqual({ where, ...between });
    }
    const pick = shown(framed, '#series .pick-row-pick')[0];
    if (pick !== undefined) pick.click();
    else
      buttonIn(framed, shown(framed, '#series .hud-button-primary')[0]?.textContent ?? '').click();
    await settle();
  }

  // Decided: now the link names both lineups. New series forgets it.
  expect(paramOf(framed, 'lb')).not.toBeNull();
  const first = loadSeries(storage, BALL_LOOKUP)?.state.rounds[0];
  if (first === undefined) throw new Error('No round 1 saved');
  const shared: Shared = { search: framed.win().location.search, round1: [first.a, first.b] };
  buttonIn(framed, 'New series').click();
  await settle();
  expect(paramOf(framed, 'step')).toBe('lineup');
  expect(storage().getItem(SERIES_STORAGE_KEY)).toBeNull();
  expect(shown(framed, '.resume-card')).toHaveLength(0);
  return shared;
}

/**
 * A copied link opened in a fresh browser (nothing saved) replays the series from round 1, as links
 * always have (ADR 0017): only the device that played it carries on at its result.
 */
async function sharedLinkFromRoundOne(framed: Framed, shared: Shared): Promise<void> {
  for (const key of [SERIES_STORAGE_KEY, SERIES_SETUP_STORAGE_KEY]) storage().removeItem(key);
  await visit(framed, shared.search);
  await waitFor(() => fightShown(framed), 15_000, 'the shared link’s round 1');
  const names = shown(framed, '.hud-ball-name').map((row) => row.textContent);
  const [you, bot] = shared.round1.map((id) => BALL_LOOKUP.get(id)?.name ?? id);
  expect({
    phase: seriesPhase(framed),
    search: framed.win().location.search,
    round: shown(framed, '#series')[0]?.innerText.includes('Round 1'),
    you: names[0]?.includes(you ?? ''),
    bot: names[1]?.includes(bot ?? ''),
  }).toStrictEqual({ phase: 'playing', search: shared.search, round: true, you: true, bot: true });
}

/**
 * Leave series is asked once, in place (ADR 0042): the row says what is lost and offers Leave and
 * Stay, each a full tap target. Stay (a tap, or Escape) keeps the series as it was and puts focus
 * back on the link; only Leave leaves.
 */
async function leaveIsAskedOnce(framed: Framed): Promise<void> {
  const before = storage().getItem(SERIES_STORAGE_KEY);
  const asked = () => shown(framed, '.leave-confirm-row').length === 1;
  for (const answer of ['Stay', 'Escape'] as const) {
    buttonIn(framed, 'Leave series').click();
    await settle();
    expect(asked()).toBe(true);
    expect(shown(framed, '.series-leave')).toHaveLength(0);
    expect(framed.doc().activeElement?.textContent).toBe('Stay');
    expect(shown(framed, '.leave-confirm-question')[0]?.textContent).toBe(
      'Leave? You’ll lose this series',
    );
    for (const name of ['Leave', 'Stay']) {
      expect(buttonIn(framed, name).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    if (answer === 'Stay') buttonIn(framed, 'Stay').click();
    else {
      framed.doc().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    await settle();
    expect({ answer, asked: asked(), step: paramOf(framed, 'step') }).toStrictEqual({
      answer,
      asked: false,
      step: 'play',
    });
    expect(framed.doc().activeElement?.textContent).toBe('Leave series');
    expect(storage().getItem(SERIES_STORAGE_KEY)).toBe(before);
  }
  buttonIn(framed, 'Leave series').click();
  await settle();
  buttonIn(framed, 'Leave').click();
}

/** A saved position put back by a fresh visit to a round's URL, then reloaded again. */
async function savedPosition(
  framed: Framed,
  where: string,
  find: (s: ReturnType<typeof pagePositions>[number]) => boolean,
) {
  const session = pagePositions(SUDDEN_DEATH).find(find);
  if (session === undefined) throw new Error(`No position for ${where}`);
  saveSeries(storage, session);
  await visit(framed, '?mode=bo3&step=play');
  await waitFor(() => seriesPhase(framed) !== 'none', 10_000, where);
  const screen = await steady(framed, true);
  checkBotHidden(framed, where);
  await reloadsTo(framed, where, true, screen);
  return screen;
}

/** Draws and sudden death, from a saved Blind series whose round 1 draws three times. */
async function drawsAndSuddenDeath(framed: Framed): Promise<void> {
  const draw = await savedPosition(
    framed,
    'after a draw',
    (s) => s.recorded && s.state.pending.length === 1,
  );
  expect(draw.parts.join(' ')).toContain('Replay round');
  expect(shown(framed, '#series [data-symbol]').length).toBeGreaterThan(0);
  await savedPosition(
    framed,
    'the third play of a drawn round, at Fight!',
    (s) => !s.recorded && s.state.pending.length === 2,
  );
  expect(fightShown(framed)).toBe(true);
  const coin = await savedPosition(
    framed,
    'after sudden death',
    (s) => s.recorded && s.state.rounds[0]?.suddenDeath === true && s.state.rounds.length === 1,
  );
  expect(coin.parts.join(' ')).toContain('Play round 2');
}

/** Leave series forgets the series; a save from another ruleset or a broken one is dropped. */
async function leavingAndBadSaves(framed: Framed): Promise<void> {
  const fight = pagePositions(SUDDEN_DEATH)[0];
  if (fight === undefined) throw new Error('No first position');
  saveSeries(storage, fight);
  await visit(framed, '?mode=bo3&step=play');
  await waitFor(() => fightShown(framed), 10_000, 'Fight! before Leave');
  await leaveIsAskedOnce(framed);
  await waitFor(() => paramOf(framed, 'step') === 'lineup', 10_000, 'the lineup after Leave');
  expect(storage().getItem(SERIES_STORAGE_KEY)).toBeNull();
  expect(shown(framed, '.resume-card')).toHaveLength(0);
  await reload(framed);
  expect(shown(framed, '.resume-card')).toHaveLength(0);

  const old = JSON.stringify({
    save: 1,
    setup: { ...fight.state.setup, ruleset: RULESET_VERSION - 1 },
    plays: 0,
    recorded: false,
  });
  for (const [what, saved] of [
    ['a save from another ruleset', old],
    ['a broken save', '{"save":1,"setup":'],
  ] as const) {
    storage().setItem(SERIES_STORAGE_KEY, saved);
    await visit(framed, '?mode=bo3&step=play');
    await waitFor(() => paramOf(framed, 'step') === 'lineup', 10_000, `${what}: the lineup`);
    expect({
      what,
      resume: shown(framed, '.resume-card').length,
      saved: storage().getItem(SERIES_STORAGE_KEY),
    }).toStrictEqual({ what, resume: 0, saved: null });
    // Not a dead end: the lineup can start a series.
    expect(shown(framed, '.lineup-step .ball-tile').length).toBeGreaterThan(0);
  }
}

export async function runSeriesReloadFlow(): Promise<void> {
  // Fast, and the same ready card every time: the what-to-watch card shows once per pairing per
  // device (ADR 0037), so it would differ after a reload by design.
  storage().setItem(SPEED_STORAGE_KEY, '2');
  storage().setItem(READY_CARD_STORAGE_KEY, 'off');
  storage().setItem(TIPS_STORAGE_KEY, 'off');
  for (const key of [SERIES_STORAGE_KEY, SERIES_SETUP_STORAGE_KEY]) storage().removeItem(key);
  const framed = await openFramed('?mode=bo3');

  const blind = await liveSeries(framed, 'blind', 'normal', ['storm', 'venom', 'quake']);
  await sharedLinkFromRoundOne(framed, blind);
  await liveSeries(framed, 'reveal', 'hard', ['frost', 'titan', 'archer']);
  await liveSeries(framed, 'showdown', 'easy', ['brawler', 'ghost', 'inferno']);
  await drawsAndSuddenDeath(framed);
  await leavingAndBadSaves(framed);

  for (const key of [
    SERIES_STORAGE_KEY,
    SERIES_SETUP_STORAGE_KEY,
    SPEED_STORAGE_KEY,
    READY_CARD_STORAGE_KEY,
    TIPS_STORAGE_KEY,
    BOT_LEVEL_STORAGE_KEY,
  ]) {
    storage().removeItem(key);
  }
}
