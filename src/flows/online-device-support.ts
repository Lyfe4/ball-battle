// The device every online flow starts on (ADR 0090): past its guided first series, as the browser
// flows' devices are (browser-setup.ts), so Play has its box and What to play; and one that chose
// Best of 3 against a friend, the length these flows' live matches were written and timed for
// (`liveMatchBudgetMs`, the shards' measured times). The Best of 5 default itself is checked by
// modes.test.ts and the browser flows. Written only where the device has no choice of its own, so
// a flow that changes them keeps its change across a navigation.
import type { BrowserContext } from 'playwright';
import { FIRST_SERIES_STORAGE_KEY } from '../app/first-series.ts';

const SCRIPT = `
  for (const [key, value] of [
    ['${FIRST_SERIES_STORAGE_KEY}', 'done'],
    ['ballbattle.friendBestOf', '3'],
  ]) {
    try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    } catch {}
  }
`;

/** Starts every page of `context` as that device. */
export async function asOnlineFlowDevice(context: BrowserContext): Promise<void> {
  await context.addInitScript(SCRIPT);
}
