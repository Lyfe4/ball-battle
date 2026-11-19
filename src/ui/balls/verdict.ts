import { counterFor } from '../../sim/counter-map.ts';
import { favouredOf, levelOf, oddsWordsOf, type Lean } from './matchups.ts';

export interface Verdict {
  /** E.g. "Storm is strongly favoured", "Even matchup". */
  readonly headline: string;
  /** Why, from the counter map. */
  readonly reason: string;
  /** How ball A fares, for colour and symbol. */
  readonly leanOfA: Lean;
}

/**
 * What the counter map says about a quick match before it starts: who should win more, by how
 * much (ADR 0073), and why. A counter is favoured, never certain, so the wording says "favoured"
 * and its level's odds in words, never "wins".
 */
export function verdictOf(a: string, b: string, nameOf: (id: string) => string): Verdict {
  if (a === b) {
    return {
      headline: 'Mirror match',
      reason: 'The same ball on both sides: an even fight.',
      leanOfA: 'even',
    };
  }
  const reason = counterFor(a, b)?.reason ?? '';
  const favoured = favouredOf(a, b);
  if (favoured === undefined) return { headline: 'Even matchup', reason, leanOfA: 'even' };
  const how = levelOf(a, b) === 'strong' ? 'strongly' : 'slightly';
  return {
    headline: `${nameOf(favoured)} is ${how} favoured`,
    reason: `Wins ${oddsWordsOf(a, b)}. ${reason}`,
    leanOfA: favoured === a ? 'favoured' : 'unfavoured',
  };
}
