// PROTOTYPE ONLY (proto/ball-looks): old vs new draw cost per ball, from the gallery's bench, in
// Chromium as is and with its CPU slowed 6x (as ADR 0063 measured). Needs `pnpm dev`.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const browser = await chromium.launch();
for (const slow of [1, 6]) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 3,
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
  await page.goto(`${BASE}/ballgallery.html?strips`);
  await page.waitForFunction(() => 'galleryBench' in globalThis, undefined, { timeout: 60_000 });
  const rows = await page.evaluate(() =>
    (globalThis as unknown as { galleryBench: () => unknown[] }).galleryBench(),
  );
  console.log(
    `\nCPU ${String(slow)}x: microseconds per ball drawn (best of 6 passes of 600 states)`,
  );
  console.table(rows);
  await page.close();
}
await browser.close();
