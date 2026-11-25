// One button and row system at 390 x 664 (what Safari leaves of an iPhone) (button.css, controls-look-flow.ts): every control at least a
// tap target tall, its label off its edges, none touching another, on every screen and sheet.
import { describe, it } from 'vitest';
import { checkControlsLook } from './controls-look-flow.ts';

describe('buttons and rows', () => {
  it('keep their size, padding and gap on every screen and sheet', async () => {
    await checkControlsLook();
  });
});
