// The inbox's one answer on the page's own parts (ADR 0081): the Friends tab's badge and the Play
// tab's status strip. Nothing (signed out, a guest, accounts off): no badge and no strip.
import type { InboxResponse } from '../api/friends.ts';
import { statusLine, waitingCount } from './friends-text.ts';

export function inboxViews(
  shell: { waiting(count: number): void },
  home: { setStatus(line: string | undefined): void },
): (inbox: InboxResponse | undefined) => void {
  return (inbox) => {
    shell.waiting(inbox === undefined ? 0 : waitingCount(inbox));
    home.setStatus(inbox === undefined ? undefined : statusLine(inbox));
  };
}
