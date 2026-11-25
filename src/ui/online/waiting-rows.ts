// The rows that lead Waiting for you on the Friends tab (ADR 0081): a series by turns waiting on
// your pick ("Your turn", ADR 0085, with Play), then a friend's challenge (who and what, Accept and
// No thanks as buttons side by side, ADR 0086). Report name and Block are in the person's sheet: a
// tap on who opens it. Each row keeps the friends list's own look (`.friends-row`).
import type { Invite, TurnWaiting } from '../../api/friends.ts';
import { timeLeft } from '../../app/online-series.ts';
import { challengesYou, turnName } from '../../screens/friends-text.ts';
import { challengeLine } from '../../screens/online-text.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';

export interface WaitingRowsHost {
  /** A friend's challenge: Accept (its lineup) and No thanks (the line that says why not). */
  readonly accept: ((token: string) => Promise<void>) | undefined;
  readonly decline: ((token: string) => Promise<string | undefined>) | undefined;
  /** A series by turns: Play opens it (ADR 0085). */
  readonly play: ((seriesId: string) => Promise<void>) | undefined;
  /** A failure's line under the list. */
  readonly say: (line: string) => void;
  /** Opens the person's sheet for the friendship `friend` (Report name, Block, ADR 0086). */
  readonly person: (friend: string) => void;
}

function rowWith(
  name: string,
  what: string,
  open?: () => void,
): { item: HTMLElement; actions: HTMLElement } {
  const item = element('li', 'friends-row');
  const who = element(open === undefined ? 'span' : 'button', 'friends-who');
  if (who instanceof HTMLButtonElement) {
    who.type = 'button';
    who.classList.add('friends-open');
    who.addEventListener('click', () => open?.());
  }
  who.append(
    element('span', 'friends-name', name),
    element('span', 'friends-status friends-challenge-what', what),
  );
  const actions = element('span', 'friends-actions');
  item.append(who, actions);
  return { item, actions };
}

/**
 * The challenges lit on Friends (ADR 0086) once `next` replaces `before`: with Friends `showing`, a
 * live challenge that wasn't there before arrived now and lights. Unset (never heard of yet): what
 * waits then is no arrival.
 */
export function litAfter(
  lit: ReadonlySet<string> | undefined,
  before: readonly Invite[],
  next: readonly Invite[],
  showing: boolean,
): ReadonlySet<string> {
  if (lit === undefined || !showing) return lit ?? new Set();
  const arrived = next.filter((one) => one.live && !before.some((was) => was.token === one.token));
  return new Set([...lit, ...arrived.map((one) => one.token)]);
}

/** A series by turns waiting on your pick: who against, the time left, and Play. */
export function turnRow(turn: TurnWaiting, now: number, host: WaitingRowsHost): HTMLElement {
  const name = turnName(turn);
  const { item, actions } = rowWith(name, timeLeft(turn.deadline, now) ?? '');
  item.dataset['turn'] = turn.seriesId;
  const play = element('button', 'hud-button hud-button-primary friends-accept', 'Play');
  play.type = 'button';
  play.setAttribute('aria-label', `Play: ${name}`);
  // Into the series once it is read: busy until then (online-prime.ts).
  busyOnClick(play, () => host.play?.(turn.seriesId));
  actions.append(play);
  return item;
}

/** A friend's challenge: who and what (a tap opens their sheet), Accept and No thanks. */
export function challengeRow(invite: Invite, host: WaitingRowsHost): HTMLElement {
  const friend = invite.friend;
  const { item, actions } = rowWith(
    challengesYou(invite.from),
    challengeLine(invite),
    friend === undefined
      ? undefined
      : () => {
          host.person(friend);
        },
  );
  item.dataset['invite'] = invite.token;
  const accept = element('button', 'hud-button hud-button-primary friends-accept', 'Accept');
  accept.type = 'button';
  accept.setAttribute('aria-label', `Accept ${invite.from}’s challenge`);
  busyOnClick(accept, () => host.accept?.(invite.token));
  const decline = element('button', 'hud-button friends-decline', 'No thanks');
  decline.type = 'button';
  decline.setAttribute('aria-label', `No thanks to ${invite.from}’s challenge`);
  busyOnClick(decline, async () => {
    const why = await host.decline?.(invite.token);
    if (why !== undefined) host.say(why);
  });
  actions.append(decline, accept);
  return item;
}
