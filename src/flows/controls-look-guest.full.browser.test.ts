// As a guest: one button and row system at 1920 x 1080 (button.css, controls-look-flow.ts): every control at least a
// tap target tall, its label off its edges, none touching another, on every screen and sheet.
import { describe, it } from 'vitest';
import { checkControlsLook, WALK_TIMEOUT_MS } from './controls-look-flow.ts';

describe('buttons and rows', () => {
  it(
    'keep their size, padding and gap on every screen a guest sees',
    { timeout: WALK_TIMEOUT_MS },
    async () => {
      await checkControlsLook(false);
    },
  );
});
