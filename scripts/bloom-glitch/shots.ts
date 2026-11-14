// Proto only: screenshots of the style guide's Bloom, Glitch and glitched sections and the phone
// arena, at phone width (390, 2x) and large (1280), into docs/bloom-glitch/. Needs `pnpm dev`.
import { chromium } from 'playwright';

const browser = await chromium.launch();
for (const [label, width, scale] of [
  ['phone', 390, 2],
  ['large', 1280, 1],
] as const) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: scale,
  });
  await page.goto('http://localhost:5199/styleguide.html');
  await page.waitForTimeout(1500);
  for (const [name, start] of [
    ['bloom', /^Bloom:/],
    ['glitch', /^Glitch:/],
    ['glitched', /^Glitched \(/],
  ] as const) {
    const block = page
      .locator('h2', { hasText: start })
      .first()
      .locator('xpath=following-sibling::div[1]');
    await block.screenshot({ path: `docs/bloom-glitch/${name}-${label}.png` });
  }
  if (label === 'phone') {
    await page
      .locator('section', { has: page.locator('h2', { hasText: 'Phone arena' }) })
      .screenshot({ path: 'docs/bloom-glitch/phone-arena.png' });
  }
  await page.close();
}
await browser.close();
