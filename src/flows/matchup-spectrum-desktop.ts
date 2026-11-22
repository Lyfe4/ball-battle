// The matchup chart on a desktop (ADR 0073 addendum of 2026-11-23), shared by the 1280 x 800 and
// 1920 x 1080 flows: the five bands as columns left to right, the reason a strip above them, and
// against every ball no column heading past two lines.
import { expect } from 'vitest';
import {
  bands,
  box,
  checkBands,
  checkTopAndWidth,
  choose,
  detail,
  everyBall,
  headingLines,
  openChart,
  sideBySide,
} from './spectrum-support.ts';

export async function checkDesktopChart(where: string): Promise<void> {
  await openChart();
  checkBands();
  expect(sideBySide(), 'five columns side by side').toBe(true);
  await checkTopAndWidth(where);
  await choose(2);
  const card = detail();
  const first = bands()[0];
  if (card === undefined || first === undefined) throw new Error('No reason or band');
  expect(box(card).bottom, 'the reason is a strip above the columns').toBeLessThanOrEqual(
    box(first).top,
  );
  expect(box(card).width).toBeGreaterThan(box(first).width * 4);
  const long: string[] = [];
  await everyBall((ball) => {
    if (headingLines().some((lines) => lines > 2)) long.push(ball);
  });
  expect(long, 'headings over two lines').toStrictEqual([]);
}
