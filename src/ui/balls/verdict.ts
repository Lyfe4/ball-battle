import { favouredOf, oddsWordsOf, reasonOf, strengthOf, type Lean } from './matchups.ts';

export interface Verdict {
  /** E.g. "Storm is favoured", "Even matchup". */
  readonly headline: string;
  /** Why, from the counter map. */
  readonly reason: string;
  /** How ball A fares, for colour and symbol. */
  readonly leanOfA: Lean;
}

/**
 * What the counter map says about a quick match before it starts: who should win more and why. A
 * soft counter is favoured, never certain, so the wording says "favoured", not "wins".
 */
export function verdictOf(a: string, b: string, nameOf: (id: string) => string): Verdict {
  if (a === b) {
    return {
      headline: 'Mirror match',
      reason: 'The same ball on both sides: an even fight.',
      leanOfA: 'even',
    };
  }
  const reason = reasonOf(a, b);
  const favoured = favouredOf(a, b);
  if (favoured === undefined) return { headline: 'Even matchup', reason, leanOfA: 'even' };
  const how = strengthOf(a, b) === 'strong' ? 'strongly' : 'slightly';
  return {
    headline: `${nameOf(favoured)} is ${how} favoured`,
    reason: `Wins ${oddsWordsOf(a, b)}. ${reason}`,
    leanOfA: favoured === a ? 'favoured' : 'unfavoured',
  };
}
