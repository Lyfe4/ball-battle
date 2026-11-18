// Measures live friend matches (ADR 0053) on a deployed online build: two phones (browser contexts
// at 390 x 664 on this one machine, so one clock) play a match and this prints what it measured as
// JSON. Not a test: the page carries no instrumentation, so everything is read from outside it.
//   node scripts/live-measure.ts <base url> <bo3|bo5|disconnect> [--slow] [--shots <dir>]
// bo3/bo5: the lobby, a whole match with picks after 3-12 s, the same each run so runs compare (the
// friend lets their first pick run out), how far apart the two screens start each fight (when each page's countdown card lifts),
// how long a pick takes to reach the other screen (the first read there with the new version),
// the requests both pages made and how long a read takes.
// disconnect: the friend drops for 12 s and comes back, then drops for good (a forfeit).
// --slow: the friend's connection gets 150 ms more each way.
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { pct, phone, player, startMatch, type Phone } from './live-phones.ts';

const [base = 'http://localhost:8888', mode = 'bo3', ...rest] = process.argv.slice(2);
const slow = rest.includes('--slow');
const shotsAt = rest.indexOf('--shots');
const shots = shotsAt >= 0 ? rest[shotsAt + 1] : undefined;
if (shots !== undefined) mkdirSync(shots, { recursive: true });
const bestOf = mode === 'bo5' ? 5 : 3;

const shot = async (page: Page, name: string) => {
  if (shots !== undefined) await page.screenshot({ path: `${shots}/${name}.png` });
};

/** The page's own clock estimate: the shortest round trip of all its answers (live-clock.ts). */
function offsetOf(clock: Phone['clock']): number | undefined {
  const best = [...clock].sort((x, y) => x.received - x.sent - (y.received - y.sent))[0];
  return best === undefined ? undefined : Math.round(best.server - (best.sent + best.received) / 2);
}

/** When the other page first had a version newer than the one it had when the pick was sent. */
function reached(picks: readonly number[], other: Phone): number[] {
  return picks.flatMap((at) => {
    const before = other.versions.filter((v) => v.at <= at).at(-1)?.version ?? -1;
    const next = other.versions.find((v) => v.version > before && v.at >= at);
    return next === undefined ? [] : [next.at - at];
  });
}

/**
 * The other player shown away: the pick card's clock between fights (ADR 0055), the line under a
 * fight (live-match.online.test.ts reads it the same way).
 */
const awayOn = (page: Page) =>
  page
    .locator('#online-series .pick-clock[data-kind="away"]:visible')
    .or(page.locator('.live-line:visible', { hasText: /disconnected · \d+ s/ }));

const browser = await chromium.launch();
try {
  const begun = Date.now();
  const sender = await phone(browser, 'sender');
  const friend = await phone(browser, 'friend', { slow });
  const { lobbyToMatchMs } = await startMatch(base, bestOf, sender, friend, shot);
  if (mode === 'disconnect') {
    await sender.page.waitForTimeout(5_000);
    await friend.context.setOffline(true);
    const dropped = Date.now();
    await awayOn(sender.page).first().waitFor({ timeout: 30_000 });
    const noticeAfterMs = Date.now() - dropped;
    await shot(sender.page, 'disconnected');
    await sender.page.waitForTimeout(Math.max(0, 12_000 - noticeAfterMs));
    await friend.context.setOffline(false);
    const back = Date.now();
    while ((await awayOn(sender.page).count()) > 0 && Date.now() - back < 30_000) {
      await sender.page.waitForTimeout(50);
    }
    const noticeGoneAfterMs = Date.now() - back;
    const stillOpen = !(await sender.page.locator('#online-series .series-result').isVisible());
    await sender.page.goto(`${base}/`);
    await sender.page.getByRole('button', { name: /^Back to your match/ }).waitFor();
    await shot(sender.page, 'home-match');
    await sender.page.getByRole('button', { name: /^Back to your match/ }).click();
    await friend.context.setOffline(true);
    const gone = Date.now();
    await sender.page.locator('#online-series .series-result').waitFor({ timeout: 90_000 });
    await shot(sender.page, 'forfeit');
    console.log(
      JSON.stringify(
        {
          mode,
          lobbyToMatchMs,
          noticeAfterMs,
          noticeGoneAfterMs,
          stillOpenAfterReturn: stillOpen,
          forfeitShownAfterMs: Date.now() - gone,
          note: await sender.page.locator('#online-series .series-note').innerText(),
        },
        null,
        2,
      ),
    );
  } else {
    const picks = { sender: [] as number[], friend: [] as number[] };
    // How long each player takes over each pick: 3-12 s, the same every run.
    const WAITS = [5_000, 9_000, 3_500, 11_000, 6_500, 4_000, 8_000, 12_000, 7_000, 3_000];
    const waitOf = (who: number) => (n: number) => WAITS[(n * 3 + who) % WAITS.length] ?? 5_000;
    let autoSeenAt: number | undefined;
    await Promise.all([
      player(sender, waitOf(0), picks.sender),
      player(friend, (n) => (n === 0 ? undefined : waitOf(1)(n)), picks.friend),
      (async () => {
        await friend.page
          .locator('#online-series .series-note', { hasText: /random ball/ })
          .waitFor({ timeout: 120_000 })
          .catch(() => undefined);
        autoSeenAt = Date.now();
        await shot(friend.page, 'auto-pick');
      })(),
    ]);
    await shot(sender.page, 'result');
    const [a, b] = [await sender.starts(), await friend.starts()];
    const gaps = a.flatMap((at) => {
      const near = b.reduce(
        (best, x) => (Math.abs(x - at) < Math.abs(best - at) ? x : best),
        Infinity,
      );
      return Math.abs(near - at) < 5_000 ? [Math.abs(near - at)] : [];
    });
    const reads = [...sender.requests, ...friend.requests]
      .filter((r) => r.route === 'GET /api/v1/series/:id')
      .map((r) => r.ms);
    const delays = [...reached(picks.sender, friend), ...reached(picks.friend, sender)];
    const byRoute: Record<string, number> = {};
    for (const r of [...sender.requests, ...friend.requests]) {
      const key = `${r.route} ${String(r.status)}`;
      byRoute[key] = (byRoute[key] ?? 0) + 1;
    }
    console.log(
      JSON.stringify(
        {
          mode,
          slow,
          seconds: Math.round((Date.now() - begun) / 1000),
          seriesReadsPerMinute:
            Math.round(
              ([...sender.requests, ...friend.requests].filter(
                (r) => r.route === 'GET /api/v1/series/:id',
              ).length /
                ((Date.now() - begun) / 60_000)) *
                10,
            ) / 10,
          lobbyToMatchMs,
          sawRandomPick: autoSeenAt !== undefined,
          fights: { sender: a.length, friend: b.length },
          fightStartGapsMs: gaps,
          pickToOtherScreenMs: delays,
          clockOffsetsMs: { sender: offsetOf(sender.clock), friend: offsetOf(friend.clock) },
          requests: {
            sender: sender.requests.length,
            friend: friend.requests.length,
            total: sender.requests.length + friend.requests.length,
          },
          byRoute,
          seriesReadMs: { p50: pct(reads, 0.5), p90: pct(reads, 0.9), max: pct(reads, 1) },
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
