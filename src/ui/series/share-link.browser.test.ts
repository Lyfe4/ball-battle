// Copy link at a finished series' result: where there is no clipboard at all (an insecure context,
// some in-app browsers), the tap says to copy the address bar instead of throwing.
import { describe, expect, it } from 'vitest';
import { createShareLink } from './share-link.ts';

describe('Copy link', () => {
  it('says to copy the address bar where there is no clipboard', async () => {
    const share = createShareLink();
    document.body.replaceChildren(share.element);
    share.show(true);
    const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      share.element.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(share.element.textContent).toBe('Copy the address bar to share');
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
      if (real !== undefined) Object.defineProperty(Navigator.prototype, 'clipboard', real);
    }
  });
});
