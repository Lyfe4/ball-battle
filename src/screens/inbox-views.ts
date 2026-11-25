// The inbox's one answer on the page's own parts (ADR 0081): the Friends tab's badge, what waits on
// the player. Play shows nothing social (ADR 0086): no strip. Nothing (signed out, a guest,
// accounts off): no badge.
import type { InboxResponse } from '../api/friends.ts';
import { waitingCount } from './friends-text.ts';

export function inboxViews(shell: {
  waiting(count: number): void;
}): (inbox: InboxResponse | undefined) => void {
  return (inbox) => {
    shell.waiting(inbox === undefined ? 0 : waitingCount(inbox));
  };
}
