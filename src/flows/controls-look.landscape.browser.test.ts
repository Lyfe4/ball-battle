// One button and row system at 812 x 375, beside (button.css, controls-look-flow.ts): every control at least a
// tap target tall, its label off its edges, none touching another, on every screen and sheet.
import { describe, it } from 'vitest';
import { checkControlsLook, WALK_TIMEOUT_MS } from './controls-look-flow.ts';

describe('buttons and rows', () => {
  it(
    'keep their size, padding and gap on every screen and sheet',
    { timeout: WALK_TIMEOUT_MS },
    async () => {
      await checkControlsLook();
    },
  );
});
