import { theme } from './theme.ts';

/** Size of the square canvas backing store, in device pixels. */
export interface CanvasSize {
  readonly pixels: number;
  /** The same size in CSS pixels, i.e. as large as it looks on screen. */
  readonly cssPixels: number;
}

/** A canvas kept to its container: `fit` sizes it to the layout now, `stop` stops watching. */
export interface CanvasFit {
  fit(): void;
  stop(): void;
}

/** The container's content box (its padding is the page gutter), as a ResizeObserver reports it. */
function contentSizeOf(container: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(container);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return {
    width: container.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
    height: container.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
  };
}

/**
 * Keeps a square canvas as large as fits inside `container`, with a backing store sized for the
 * device pixel ratio so lines stay sharp on high-density screens. Calls `onResize` whenever the
 * size changes. It is sized at once, from the layout as it stands, so nothing is ever drawn at the
 * canvas's default 300 x 150 (ADR 0087); `fit` sizes it again from the layout, for the moment a
 * screen is laid out before a resize observer has said so.
 */
export function fitCanvasToContainer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  onResize: (size: CanvasSize) => void,
): CanvasFit {
  let cssWidth = 0;
  let cssHeight = 0;

  const apply = (): void => {
    const cssSize = Math.max(0, Math.floor(Math.min(cssWidth, cssHeight)));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, theme.maxPixelRatio);
    const pixels = Math.round(cssSize * pixelRatio);

    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    onResize({ pixels, cssPixels: cssSize });
  };

  const fit = (): void => {
    ({ width: cssWidth, height: cssHeight } = contentSizeOf(container));
    apply();
  };
  fit();

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry === undefined) return;
    // contentRect excludes the container's padding, which provides the page gutter.
    cssWidth = entry.contentRect.width;
    cssHeight = entry.contentRect.height;
    apply();
  });
  resizeObserver.observe(container);

  // devicePixelRatio changes without a resize when the window moves between monitors or the
  // user zooms. A resolution media query fires once per change, so re-arm it each time.
  let pixelRatioQuery: MediaQueryList | undefined;
  const watchPixelRatio = (): void => {
    pixelRatioQuery?.removeEventListener('change', onPixelRatioChange);
    pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    pixelRatioQuery.addEventListener('change', onPixelRatioChange);
  };
  function onPixelRatioChange(): void {
    watchPixelRatio();
    apply();
  }
  watchPixelRatio();

  return {
    fit,
    stop: () => {
      resizeObserver.disconnect();
      pixelRatioQuery?.removeEventListener('change', onPixelRatioChange);
    },
  };
}
