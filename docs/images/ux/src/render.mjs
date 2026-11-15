// Renders the UX proposal's mockups (ADR 0055 draft) to PNG beside this folder:
//   node docs/images/ux/src/render.mjs
// Each page at a phone (390 x 664) or desktop (1280 x 800) size, as its name says.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..');
const browser = await chromium.launch();
for (const file of readdirSync(here).filter((name) => name.endsWith('.html'))) {
  const desktop = file.includes('desktop');
  const page = await browser.newPage({
    viewport: desktop ? { width: 1280, height: 800 } : { width: 390, height: 664 },
    deviceScaleFactor: desktop ? 1 : 2,
  });
  await page.goto(pathToFileURL(join(here, file)).href);
  await page.evaluate(() => document.fonts.ready);
  const name = file.replace('.html', desktop ? '.png' : '-phone.png');
  await page.screenshot({ path: join(out, name) });
  await page.close();
}
await browser.close();
