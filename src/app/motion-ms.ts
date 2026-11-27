// A motion token's text as milliseconds (tokens.css, ADR 0087), pure: `tokenMs` (src/ui) reads the
// token itself. A token that is missing or unreadable is the fallback, never NaN, which
// Element.animate() throws on.

/** `--motion-quick: 160ms` or `0.16s` as 160; `fallback` when it isn't a length. */
export function msOf(value: string, fallback: number): number {
  const trimmed = value.trim();
  const amount = Number.parseFloat(trimmed);
  if (!Number.isFinite(amount)) return fallback;
  if (trimmed.endsWith('ms')) return amount;
  return trimmed.endsWith('s') ? amount * 1000 : fallback;
}
