/**
 * Where focus goes in a grid of `count` items laid out `columns` wide when a key is pressed, or
 * undefined if the key doesn't move it. Arrows move one step (up and down by a row) and stop at
 * the edges; Home and End jump to the first and last item.
 */
export function gridMove(
  index: number,
  key: string,
  count: number,
  columns: number,
): number | undefined {
  if (count <= 0) return undefined;
  const width = Math.max(1, Math.floor(columns));
  const clamp = (value: number): number => Math.min(count - 1, Math.max(0, value));
  switch (key) {
    case 'ArrowRight':
      return clamp(index + 1);
    case 'ArrowLeft':
      return clamp(index - 1);
    case 'ArrowDown':
      return index + width < count ? index + width : index;
    case 'ArrowUp':
      return index - width >= 0 ? index - width : index;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}
