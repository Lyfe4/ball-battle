// A person's sheet on the Friends tab (ADR 0086, social S 5), on the shared sheet (sheet.ts): tap a
// row and this opens. A friend's: their disc ringed in their status's colour, name and status;
// Challenge · live when it can succeed; Remove friend as a row; then, apart, Report name and Block
// in the danger look. Remove and Block are confirmed with what they do (Cancel the default); Report
// asks why, with "Also block". A request to you has Accept and Decline, then Report and Block; a
// request you sent has Cancel request; a blocked player has Unblock. One close, the ×; whatever an
// action did is said on the tab once the sheet closes.
import type { FriendEntry, ReportReason } from '../../api/friends.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';
import { createSheet } from '../sheet.ts';
import {
  BLOCK_STEP,
  personStatus,
  REMOVE_STEP,
  REPORT_CHOICES,
  reportTitle,
  SHEET_LINES,
} from '../../screens/friends-text.ts';

export interface FriendSheetHost {
  /** Challenge · live: the vs Friend setup, the challenge going to this friend. */
  readonly challenge?: (friend: FriendEntry) => void;
  /** Take turns (ADR 0085, where the build has it): by turns, its lineup first; any time. */
  readonly turns?: (friend: FriendEntry) => void;
  /** Each change to a friendship; resolves true when it was made (the tab redrew). */
  readonly remove: (id: string) => Promise<boolean>;
  readonly block: (id: string) => Promise<boolean>;
  readonly report: (id: string, reason: ReportReason) => Promise<boolean>;
  readonly accept: (id: string) => Promise<boolean>;
  readonly decline: (id: string) => Promise<boolean>;
  readonly unblock: (id: string) => Promise<boolean>;
  /** A line for the tab once the sheet closes ("Jo is blocked …"). */
  readonly said: (line: string) => void;
}

export type PersonKind = 'friend' | 'incoming' | 'outgoing' | 'blocked';

export interface FriendSheet {
  readonly element: HTMLDialogElement;
  /** Opens `person`'s sheet; `waiting` when they wait on you in a lobby (not "In a match"). */
  open(person: FriendEntry, kind: PersonKind, waiting?: boolean): void;
}

/** The person's disc: their initial, ringed in their status's colour (friends-section.css). */
export function personDisc(person: FriendEntry, size: 'row' | 'sheet'): HTMLElement {
  const disc = element('span', `friends-disc friends-disc-${size}`, person.name.slice(0, 1));
  disc.setAttribute('aria-hidden', 'true');
  if (person.status !== undefined) disc.dataset['status'] = person.status;
  return disc;
}

function row(text: string, label: string, danger = false): HTMLButtonElement {
  const button = element('button', `sheet-row${danger ? ' danger-row' : ''}`, text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  return button;
}

export function createFriendSheet(host: FriendSheetHost): FriendSheet {
  const sheet = createSheet({ id: 'friend-sheet-title', title: '', name: 'friend-sheet' });

  /** Runs `act`; once it is made, the sheet closes and the tab says `line` (if any). */
  const doing = (act: () => Promise<boolean>, line?: string) => async () => {
    if (!(await act())) return;
    sheet.close();
    if (line !== undefined) host.said(line);
  };

  function dangerZone(person: FriendEntry): HTMLElement {
    const zone = element('div', 'sheet-danger');
    const report = row(SHEET_LINES.report, `Report ${person.name}’s name`, true);
    report.addEventListener('click', () => {
      showReport(person);
    });
    const block = row(SHEET_LINES.block, `Block ${person.name}`, true);
    block.addEventListener('click', () => {
      void sheet.confirm(BLOCK_STEP(person.name)).then((yes) => {
        if (yes) void doing(() => host.block(person.id), SHEET_LINES.blocked(person.name))();
      });
    });
    zone.append(report, block);
    return zone;
  }

  /** Report name: why, as the shared choice rows, "Also block", and Send report in red. */
  function showReport(person: FriendEntry): void {
    const form = element('div', 'friend-sheet-report');
    const reasons = element('div', 'segmented-rows friend-sheet-reasons');
    reasons.setAttribute('role', 'radiogroup');
    reasons.setAttribute('aria-label', reportTitle(person.name));
    let reason: ReportReason | undefined;
    const send = element('button', 'hud-button danger-button', SHEET_LINES.sendReport);
    send.type = 'button';
    send.setAttribute('aria-disabled', 'true');
    const choices = REPORT_CHOICES.map((choice) => {
      const option = element('button', 'segmented-button choice', choice.text);
      option.type = 'button';
      option.setAttribute('role', 'radio');
      option.setAttribute('aria-checked', 'false');
      option.addEventListener('click', () => {
        reason = choice.reason;
        for (const other of choices) other.setAttribute('aria-checked', String(other === option));
        send.setAttribute('aria-disabled', 'false');
      });
      return option;
    });
    reasons.append(...choices);
    const also = element('label', 'friend-sheet-also');
    const box = element('input', 'friend-sheet-also-box');
    box.type = 'checkbox';
    also.append(box, element('span', '', SHEET_LINES.alsoBlock(person.name)));
    const cancel = element('button', 'hud-button', 'Cancel');
    cancel.type = 'button';
    cancel.dataset['sound'] = 'back';
    cancel.addEventListener('click', () => {
      open(person, 'friend');
    });
    busyOnClick(send, async () => {
      if (reason === undefined) return;
      const reported = await host.report(person.id, reason);
      if (!reported) return;
      if (box.checked) await host.block(person.id);
      sheet.close();
      host.said(SHEET_LINES.reported);
    });
    form.append(reasons, also, send, cancel);
    sheet.title.textContent = reportTitle(person.name);
    sheet.content.replaceChildren(form);
    sheet.title.focus();
  }

  function open(person: FriendEntry, kind: PersonKind, waiting = false): void {
    sheet.title.textContent = person.name;
    const head = element('div', 'friend-sheet-person');
    const status = element('p', 'friends-status', personStatus(person, kind, waiting));
    if (kind === 'friend')
      status.dataset['status'] = waiting ? 'waiting' : (person.status ?? 'offline');
    head.append(personDisc(person, 'sheet'), status);
    const actions = element('div', 'friend-sheet-actions');
    if (kind === 'friend') {
      const challenge = host.challenge;
      if (challenge !== undefined && person.status === 'online') {
        const live = element('button', 'hud-button hud-button-primary', SHEET_LINES.challenge);
        live.type = 'button';
        live.setAttribute('aria-label', `Challenge ${person.name} live`);
        live.addEventListener('click', () => {
          sheet.close();
          challenge(person);
        });
        actions.append(live);
      }
      const turns = host.turns;
      if (turns !== undefined) {
        const take = element('button', 'hud-button', SHEET_LINES.turns);
        take.type = 'button';
        take.setAttribute('aria-label', `Take turns with ${person.name}`);
        take.addEventListener('click', () => {
          sheet.close();
          turns(person);
        });
        actions.append(take);
      }
      const remove = row(SHEET_LINES.remove, `Remove ${person.name}`);
      remove.addEventListener('click', () => {
        void sheet.confirm(REMOVE_STEP(person.name)).then((yes) => {
          if (yes) void doing(() => host.remove(person.id), SHEET_LINES.removed(person.name))();
        });
      });
      actions.append(remove);
      sheet.content.replaceChildren(head, actions, dangerZone(person));
    } else if (kind === 'incoming') {
      const accept = element('button', 'hud-button hud-button-primary', 'Accept');
      accept.type = 'button';
      accept.setAttribute('aria-label', `Accept ${person.name}`);
      busyOnClick(
        accept,
        doing(() => host.accept(person.id)),
      );
      const decline = element('button', 'hud-button', 'Decline');
      decline.type = 'button';
      decline.setAttribute('aria-label', `Decline ${person.name}`);
      busyOnClick(
        decline,
        doing(() => host.decline(person.id)),
      );
      actions.append(accept, decline);
      sheet.content.replaceChildren(head, actions, dangerZone(person));
    } else {
      const button = element(
        'button',
        'hud-button',
        kind === 'outgoing' ? SHEET_LINES.cancelRequest : 'Unblock',
      );
      button.type = 'button';
      button.setAttribute(
        'aria-label',
        kind === 'outgoing' ? `Cancel your request to ${person.name}` : `Unblock ${person.name}`,
      );
      busyOnClick(
        button,
        doing(() => (kind === 'outgoing' ? host.decline(person.id) : host.unblock(person.id))),
      );
      actions.append(button);
      sheet.content.replaceChildren(head, actions);
    }
    sheet.open();
  }

  return { element: sheet.element, open };
}
