// PROTOTYPE ONLY (proto/ball-looks-2): screenshots of the gallery's ?strips view, each ball's every
// state old above new, on a phone (390 x 664) and a desktop (1280 x 800). Needs `pnpm dev`.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const OUT = 'docs/proposals/ball-looks-2';
const BALLS = ['necromancer', 'bomber', 'vampire'];

const browser = await chromium.launch();
for (const [name, viewport, scale] of [
  ['phone', { width: 390, height: 664 }, 3],
  ['desktop', { width: 1280, height: 800 }, 2],
] as const) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.goto(`${BASE}/ballgallery.html?strips`);
  await page.locator('#strip-vampire canvas').first().waitFor();
  for (const id of BALLS) {
    await page.locator(`#strip-${id}`).screenshot({ path: `${OUT}/${id}-${name}.png` });
  }
  await page.goto(`${BASE}/ballgallery.html`);
  await page.locator('#vampire canvas').first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/gallery-${name}.png` });
  await page.close();
}
await browser.close();
