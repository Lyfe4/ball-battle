// A row's More (ADR 0079 addendum of 2026-11-25): Report name and Block, for a friend, a request
// to you or a friend's challenge. Each is asked in place, under the row, Keep first, so a stray
// tap changes nothing; nothing pauses and no dialog opens. The Blocked list's rows carry Unblock.
import type { ReportReason } from '../../api/friends.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';
import { blockQuestion, REPORT_CHOICES, reportQuestion } from '../../screens/friends-text.ts';

/** Which question a row is asking, if any. */
export type RowAsk = 'more' | 'block' | 'report';

export interface MoreHost {
  /** Blocks the row's player; resolves once the list is drawn again. */
  readonly block: () => Promise<unknown>;
  /** Reports the row's player's name; resolves once the list is drawn again. */
  readonly report: (reason: ReportReason) => Promise<unknown>;
  /** Asks another question on this row, or none (undefined). */
  readonly ask: (next: RowAsk | undefined) => void;
}

function textButton(text: string, label: string): HTMLButtonElement {
  const button = element('button', 'text-link friends-action', text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  return button;
}

/** The row's More button. */
export function moreButton(name: string, host: MoreHost): HTMLButtonElement {
  const more = textButton('More', `More for ${name}`);
  more.addEventListener('click', () => {
    host.ask('more');
  });
  return more;
}

/** What the row asks under itself: More's choices, or the question one of them asks. */
export function askPanel(name: string, asking: RowAsk, host: MoreHost): HTMLElement {
  const panel = element('div', 'friends-ask');
  const keep = textButton(asking === 'more' ? 'Close' : 'Keep', `Keep ${name}`);
  keep.dataset['sound'] = 'back';
  keep.addEventListener('click', () => {
    host.ask(undefined);
  });
  if (asking === 'more') {
    const report = textButton('Report name', `Report ${name}’s name`);
    report.addEventListener('click', () => {
      host.ask('report');
    });
    const block = textButton('Block', `Block ${name}`);
    block.addEventListener('click', () => {
      host.ask('block');
    });
    panel.append(keep, report, block);
    return panel;
  }
  const question = element(
    'p',
    'friends-ask-question',
    asking === 'block' ? blockQuestion(name) : reportQuestion(name),
  );
  panel.append(question, keep);
  if (asking === 'block') {
    const block = element('button', 'hud-button friends-block', 'Block');
    block.type = 'button';
    block.setAttribute('aria-label', `Block ${name}`);
    busyOnClick(block, host.block);
    panel.append(block);
  } else {
    for (const choice of REPORT_CHOICES) {
      const send = element('button', 'hud-button friends-report', choice.text);
      send.type = 'button';
      send.setAttribute('aria-label', `Report ${name}’s name: ${choice.text}`);
      busyOnClick(send, () => host.report(choice.reason));
      panel.append(send);
    }
  }
  return panel;
}

/** A row's More: its button, and under the row the question being asked, if any. */
export function rowMore(
  item: HTMLElement,
  name: string,
  asking: RowAsk | undefined,
  host: MoreHost,
): HTMLButtonElement {
  if (asking !== undefined) item.append(askPanel(name, asking, host));
  const more = moreButton(name, host);
  more.classList.add('friends-more');
  more.setAttribute('aria-expanded', String(asking !== undefined));
  return more;
}
