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
import { formatOf, remainingOf, type Format, type Lineup } from '../sim/series.ts';
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

const storage = () => window.localStorage;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the player sees: the URL, the title, every visible part's words, and the court. */
interface Screen {
  readonly search: string;
  readonly title: string;
  readonly parts: readonly string[];
  /** The court's size and pixels, where the opening drawn is checked. */
  readonly court?: string;
}

/** The parts of the page a series screen is made of. The Winner sticker (see-through between rounds, ADR 0033) is left out. */
const PARTS = [
  '#series-setup',
  '#series',
  '#series-exit',
  '#hud-status',
  '#hud-speed',
  '.ready-layer',
];

function screenOf(framed: Framed, court: boolean): Screen {
  const doc = framed.doc();
  const parts = PARTS.map((selector) => {
    const part = doc.querySelector<HTMLElement>(selector);
    if (part?.closest('[hidden]') !== null) return `${selector}: -`;
    return `${selector}: ${part.innerText.replace(/\s+/g, ' ').trim()}`;
  });
  const canvas = doc.querySelector<HTMLCanvasElement>('#arena');
  const drawn =
    court && canvas !== null
      ? `${String(canvas.width)}x${String(canvas.height)} ${canvas.toDataURL()}`
      : undefined;
  return {
    search: framed.win().location.search,
    title: doc.title,
    parts,
    ...(drawn === undefined ? {} : { court: drawn }),
  };
}

/** Waits for the screen to stop changing (the ready moment's pop-in, a layout settling). */
async function steady(framed: Framed, court: boolean): Promise<Screen> {
  let last = screenOf(framed, court);
  for (let tries = 0; tries < 40; tries += 1) {
    await wait(400);
    const now = screenOf(framed, court);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
}

/** Reloads and checks the page comes back to `expected` (by default, the screen before it). */
async function reloadsTo(framed: Framed, where: string, court: boolean, expected?: Screen) {
  const before = expected ?? (await steady(framed, court));
  await reload(framed);
  const end = Date.now() + 15_000;
  let after = screenOf(framed, court);
  while (JSON.stringify(after) !== JSON.stringify(before) && Date.now() < end) {
    await wait(300);
    after = screenOf(framed, court);
  }
  expect({ where, ...after }).toStrictEqual({ where, ...before });
  return before;
}

/**
 * In Blind the bot's balls stay hidden until each round starts (ADR 0017): none it hasn't played
 * yet is in the URL, the page's words or any accessible name, unless the player has it too.
 */
function checkBotHidden(framed: Framed, where: string): void {
  const session = loadSeries(storage, BALL_LOOKUP);
  if (session === undefined || formatOf(session.state.setup) !== 'blind') return;
  if (session.state.winner !== undefined) return;
  const { state, current } = session;
  const hidden = remainingOf(state, 'b').filter(
    (id) => id !== current?.b && !state.setup.a.includes(id),
  );
  const doc = framed.doc();
  const said = [
    framed.win().location.href,
    doc.body.innerText,
    ...shown(framed, '[aria-label], [title]').map(
      (node) => `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''}`,
    ),
  ].join(' ');
  const named = hidden.filter(
    (id) => said.includes(id) || said.includes(BALL_LOOKUP.get(id)?.name ?? id),
  );
  expect({ where, named, lineupInUrl: paramOf(framed, 'lb') }).toStrictEqual({
    where,
    named: [],
    lineupInUrl: null,
  });
}

function tapBall(framed: Framed, id: string): void {
  const name = BALL_LOOKUP.get(id)?.name;
  const tile = shown(framed, '.lineup-step .ball-tile').find((node) =>
    node.textContent.includes(name ?? id),
  );
  if (tile === undefined) throw new Error(`No tile for ${id}`);
  tile.click();
}

const fightShown = (framed: Framed) => shown(framed, '.ready-fight').length === 1;

/** A whole series played live, reloaded at every step and once left with Back and resumed. */
async function liveSeries(framed: Framed, format: Format, level: string, own: Lineup) {
  storage().setItem(BOT_LEVEL_STORAGE_KEY, level);
  const fmt = format === 'blind' ? '' : `&fmt=${format}`;
  await visit(framed, `?mode=bo3${fmt}&step=lineup`);
  const label = `${format} (${level})`;

  // The lineup: a tray half built survives a reload.
  tapBall(framed, own[0]);
  tapBall(framed, own[1]);
  await reloadsTo(framed, `${label}: lineup`, false);
  tapBall(framed, own[2]);
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
  buttonIn(framed, 'New series').click();
  await settle();
  expect(paramOf(framed, 'step')).toBe('lineup');
  expect(storage().getItem(SERIES_STORAGE_KEY)).toBeNull();
  expect(shown(framed, '.resume-card')).toHaveLength(0);
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
  buttonIn(framed, 'Leave series').click();
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

  await liveSeries(framed, 'blind', 'normal', ['storm', 'venom', 'quake']);
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
