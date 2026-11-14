// The fair-play check at the end of an online series (ADR 0051, 0052 "The end"): a ✓ line under the
// result with the details folded away (ADR 0025: show less by default). The check itself is
// `fairPlayOf` (src/app/online-series.ts): the commitments, then this device's own replay.
import type { FairPlay } from '../../app/online-series.ts';
import { element, setText } from '../dom.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import { SYMBOLS } from '../symbols.ts';

export interface FairPlayLine {
  readonly element: HTMLElement;
  /** `checking` while it runs; undefined hides it (a series still open, or nothing to check). */
  show(result: FairPlay | 'checking' | undefined): void;
}

const DETAILS: Readonly<
  Record<FairPlay | 'checking', { readonly head: string; readonly body: string }>
> = {
  checking: { head: 'Checking fair play…', body: 'Checking every seed and replaying the series.' },
  fair: {
    head: 'Fair play',
    body:
      'Every round’s seed was fixed and committed to before the first pick, and revealed only ' +
      'after both picks were locked. Each one matched its commitment, and this device replayed ' +
      'every round to the same result.',
  },
  unfair: {
    head: 'Couldn’t confirm fair play',
    body:
      'A seed didn’t match its commitment, or this device’s replay reached another result. The ' +
      'server’s result stands.',
  },
  unavailable: {
    head: 'Nothing to check',
    body: 'This series ended without being played out, so there is no replay to check.',
  },
};

export function createFairPlayLine(): FairPlayLine {
  const root = element('details', 'fair-play');
  const summary = element('summary', 'fair-play-summary');
  const mark = element('span', 'fair-play-mark', SYMBOLS.fairPlay.mark);
  mark.setAttribute('aria-hidden', 'true');
  markSymbol(mark, 'fairPlay');
  const head = element('span', 'fair-play-head');
  const body = element('p', 'fair-play-body');
  summary.append(mark, head);
  root.append(summary, body);
  root.hidden = true;
  let shown: string | undefined;
  return {
    element: root,
    show(result) {
      if (result === shown) return;
      shown = result;
      root.hidden = result === undefined || result === 'unavailable';
      if (result === undefined) return;
      root.dataset['result'] = result;
      mark.hidden = result !== 'fair';
      setText(head, DETAILS[result].head);
      setText(body, DETAILS[result].body);
    },
  };
}
