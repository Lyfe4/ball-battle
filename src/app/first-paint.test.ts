import { describe, expect, it } from 'vitest';
import {
  FIRST_PAINT_FONT,
  FONT_WAIT_MS,
  STAGE_SHOWN_MARK,
  firstPaintReady,
  showStage,
  type FirstPaintWindow,
} from './first-paint.ts';

/** A window whose font, timer and frames are settled by the test; it logs what is asked of it. */
function fakeWindow(font: Promise<unknown> | undefined, loaded = true) {
  const log: string[] = [];
  let fire: (() => void) | undefined;
  const win: FirstPaintWindow = {
    document: {
      ...(font === undefined
        ? {}
        : {
            fonts: {
              load: (what: string) => {
                log.push(`load ${what}`);
                return font;
              },
              check: () => loaded,
            },
          }),
      getElementById: (id) => ({ remove: () => log.push(`remove #${id}`) }),
    },
    performance: {
      mark: (name, options) => log.push(`mark ${name} ${JSON.stringify(options.detail)}`),
    },
    setTimeout: (handler, ms) => {
      log.push(`wait ${String(ms)}`);
      fire = handler;
    },
    requestAnimationFrame: (callback) => {
      log.push('frame');
      callback();
    },
  };
  return { win, log, timeout: () => fire?.() };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the first paint', () => {
  it('shows in the frame after the font is ready', async () => {
    const { win, log } = fakeWindow(Promise.resolve([]));
    await expect(firstPaintReady(win)).resolves.toBe('font');
    expect(log).toStrictEqual([
      `load ${FIRST_PAINT_FONT}`,
      `wait ${String(FONT_WAIT_MS)}`,
      'frame',
    ]);
  });

  it('waits no longer than FONT_WAIT_MS for a font that never comes', async () => {
    const { win, log, timeout } = fakeWindow(new Promise(() => undefined));
    let which: string | undefined;
    void firstPaintReady(win).then((one) => {
      which = one;
    });
    await tick();
    expect(which).toBeUndefined();
    expect(log).not.toContain('frame');
    timeout();
    await tick();
    expect(which).toBe('timeout');
    expect(log.at(-1)).toBe('frame');
  });

  it('shows at once when the font fails, or the browser has no font set', async () => {
    await expect(
      firstPaintReady(fakeWindow(Promise.reject(new Error('blocked'))).win),
    ).resolves.toBe('font');
    await expect(firstPaintReady(fakeWindow(undefined).win)).resolves.toBe('font');
  });

  it('sizes the canvas before the stage shows, then drops the reload line and marks it', () => {
    const { win, log } = fakeWindow(Promise.resolve([]), false);
    const stage = { dataset: { booting: '' } as Record<string, string | undefined> };
    showStage(win, stage, () =>
      log.push(`fit while booting: ${String('booting' in stage.dataset)}`),
    );
    expect(stage.dataset).toStrictEqual({});
    expect(log).toStrictEqual([
      'fit while booting: true',
      'remove #boot-fallback',
      `mark ${STAGE_SHOWN_MARK} {"fontReady":false}`,
    ]);
  });
});
