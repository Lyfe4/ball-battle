// How much of each live fight's countdown (ADR 0053) each phone shows: two phones play a whole live
// match and this prints, for every fight on each, how long its countdown card showed before the
// fight started, the lines it showed in order, and whether it showed the whole 3-2-1. A phone shows
// the card from the moment it learns the round is ready (its next read, or its own pick's answer),
// so this is how late each phone learns, as the player sees it. Not a test: it depends on the
// network and the machine.
//   node scripts/live-countdown.ts <base url> [bo3|bo5] [--cpu N] [--fps N] [--slow] [--runs N]
// --cpu, --fps, --slow apply to the friend's phone: CPU throttling (Chromium), a frame-rate cap
// (30: Low Power Mode) and 150 ms more each way on its connection.
import { chromium } from 'playwright';
import { pct, phone, player, startMatch, type CardMoment } from './live-phones.ts';

const [base = 'http://localhost:8888', mode = 'bo3', ...rest] = process.argv.slice(2);
const option = (name: string) => {
  const at = rest.indexOf(name);
  return at >= 0 ? Number(rest[at + 1]) : undefined;
};
const bestOf = mode === 'bo5' ? 5 : 3;
const runs = option('--runs') ?? 1;
const friendOptions = { cpu: option('--cpu'), fps: option('--fps'), slow: rest.includes('--slow') };

interface Countdown {
  /** From the card first showing to the fight's start. */
  readonly shownMs: number;
  /** Its lines in order ("Get ready", "Fight in 3…", …). */
  readonly lines: readonly string[];
  /** It showed "Fight in 3…", "2…" and "1…", each for most of its second. */
  readonly whole: boolean;
}

/** Each fight's countdown on one page, from its card's moments. */
function countdowns(card: readonly CardMoment[]): Countdown[] {
  const out: Countdown[] = [];
  let from: number | undefined;
  let lines: { text: string; at: number }[] = [];
  for (const moment of card) {
    if (moment.held) {
      from ??= moment.at;
      if (lines.at(-1)?.text !== moment.text) lines.push({ text: moment.text, at: moment.at });
      continue;
    }
    if (from === undefined) continue;
    const end = moment.at;
    const lasted = (n: number) => {
      const index = lines.findIndex((line) => line.text === `Fight in ${String(n)}…`);
      if (index < 0) return 0;
      return (lines[index + 1]?.at ?? end) - (lines[index]?.at ?? end);
    };
    out.push({
      shownMs: end - from,
      lines: lines.map((line) => line.text),
      whole: [3, 2, 1].every((n) => lasted(n) >= 800),
    });
    from = undefined;
    lines = [];
  }
  return out;
}

const all = { sender: [] as Countdown[], friend: [] as Countdown[] };
const browser = await chromium.launch();
try {
  for (let run = 0; run < runs; run += 1) {
    const sender = await phone(browser, 'sender');
    const friend = await phone(browser, 'friend', friendOptions);
    await startMatch(base, bestOf, sender, friend);
    const wait = () => 2_000 + Math.random() * 4_000;
    await Promise.all([player(sender, wait, []), player(friend, wait, [])]);
    all.sender.push(...countdowns(await sender.card()));
    all.friend.push(...countdowns(await friend.card()));
    await sender.context.close();
    await friend.context.close();
  }
} finally {
  await browser.close();
}

const summary = (list: readonly Countdown[]) => ({
  fights: list.length,
  whole321: list.filter((c) => c.whole).length,
  shownMs: {
    min: pct(
      list.map((c) => c.shownMs),
      0,
    ),
    p50: pct(
      list.map((c) => c.shownMs),
      0.5,
    ),
    max: pct(
      list.map((c) => c.shownMs),
      1,
    ),
  },
  each: list.map((c) => `${String(c.shownMs)} ms: ${c.lines.join(' / ')}`),
});
console.log(
  JSON.stringify(
    {
      base,
      mode,
      friend: friendOptions,
      sender: summary(all.sender),
      friendPhone: summary(all.friend),
    },
    null,
    2,
  ),
);
