// Cents each repeat of a sound is moved by in turn (sound.ts), so a run of the same sound never
// sounds copied: at most 20 either way, so a tonal sound stays on its note of the scale (ADR 0064;
// it reached 55). DOM-free, so the rule is tested in Node.
export const VARIETY: readonly number[] = [0, 12, -10, 20, -18, 6];
