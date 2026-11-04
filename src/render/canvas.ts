import { theme } from './theme.ts';

/** Size of the square canvas backing store, in device pixels. */
export interface CanvasSize {
  readonly pixels: number;
  /** The same size in CSS pixels, i.e. as large as it looks on screen. */
  readonly cssPixels: number;
}

/**
 * Keeps a square canvas as large as fits inside `container`, with a backing store sized for the
 * device pixel ratio so lines stay sharp on high-density screens. Calls `onResize` whenever the
 * size changes. Returns a function that stops watching.
 */
export function fitCanvasToContainer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  onResize: (size: CanvasSize) => void,
): () => void {
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

  return () => {
    resizeObserver.disconnect();
    pixelRatioQuery?.removeEventListener('change', onPixelRatioChange);
  };
}
