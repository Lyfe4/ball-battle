// A canvas for a style guide figure, at the screen's pixel ratio (capped as the arena caps it). Dev only.
import { theme } from '../render/theme.ts';

export function canvasFor(cssSize: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const ratio = Math.min(window.devicePixelRatio || 1, theme.maxPixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssSize * ratio);
  canvas.height = Math.round(cssSize * ratio);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D is not supported');
  return { canvas, ctx };
}
