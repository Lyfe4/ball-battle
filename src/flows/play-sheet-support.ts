// The Play tab's mode box and its sheet (ADR 0081 addendum, Option B), as the page flows use them:
// what the box says, opening the sheet, a choice in it, and Done.
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle, visible } from './page-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

/** What the mode box says Play starts: who, then the rules. */
export const playMeta = () =>
  visible('.play-box-who, .play-box-rules')
    .map((line) => line.textContent)
    .join(' · ');

/** Opens the mode box's sheet: a modal dialog, focus inside it. */
export async function openSheet(): Promise<HTMLDialogElement> {
  const box = visible('.play-box')[0];
  if (box === undefined) throw new Error('No mode box');
  await click(box);
  const sheet = document.querySelector('dialog.play-sheet');
  if (!(sheet instanceof HTMLDialogElement) || !sheet.open) throw new Error('No sheet');
  expect(sheet.contains(document.activeElement)).toBe(true);
  return sheet;
}

/** A choice in the open sheet, by its words. */
export async function sheetChoice(name: string): Promise<void> {
  const found = visible('dialog.play-sheet .segmented-button').find(
    (node) => node.querySelector('.segmented-text')?.textContent === name,
  );
  if (found === undefined) throw new Error(`No ${name} in the sheet`);
  await click(found);
}

/** Closes the sheet with its full-width Done: focus back on the box. */
export async function closeSheet(): Promise<void> {
  const done = visible('.play-sheet-done')[0];
  if (done === undefined) throw new Error('No Done');
  await click(done);
  await settle();
  expect(document.activeElement).toBe(visible('.play-box')[0]);
}
