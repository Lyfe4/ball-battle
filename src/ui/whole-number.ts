// A number as a player reads it: whole (2026-11-23: the Vampire's top speed read
// "1012.5000000000001"). For display only; the sim and its rulesets keep their exact values.
export function wholeNumber(value: number): string {
  return String(Math.round(value));
}
