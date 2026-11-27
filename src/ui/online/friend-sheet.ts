// A person's sheet on the Friends tab (ADR 0086, social S 5), on the shared sheet (sheet.ts): tap a
// row and this opens. A friend's: their disc ringed in their status's colour, name and status;
// Challenge, always (unavailable, with why, when it can't succeed), which opens "Who do you want to
// play?" with them picked (ADR 0089 addendum of 2026-11-27); Remove friend as a row; then, apart,
// Report name and Block
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
  handleOf,
  headToHead,
  challengeUnavailable,
  personStatus,
  REMOVE_STEP,
  REPORT_CHOICES,
  reportTitle,
  SHEET_LINES,
} from '../../screens/friends-text.ts';

export interface FriendSheetHost {
  /** Challenge: "Who do you want to play?" with this friend picked (the one path). */
  readonly challenge?: (friend: FriendEntry) => void;
  /** Whether the build plays by turns (ADR 0085): a friend not online can still be challenged. */
  readonly turns?: boolean;
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
    // It opens the reasons: the one row here with a "›".
    report.dataset['opens'] = '';
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
    const form = element('div', 'action-stack friend-sheet-report');
    const reasons = element('div', 'segmented-rows friend-sheet-reasons');
    reasons.setAttribute('role', 'radiogroup');
    reasons.setAttribute('aria-label', reportTitle(person.name));
    let reason: ReportReason | undefined;
    const send = element(
      'button',
      'hud-button hud-button-main danger-button',
      SHEET_LINES.sendReport,
    );
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
    const cancel = element('button', 'hud-button hud-button-main', 'Cancel');
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

  /** A main action: full width, the primary or a secondary, named for the person it acts on. */
  function action(text: string, label: string, primary: boolean): HTMLButtonElement {
    const look = primary ? ' hud-button-primary' : '';
    const button = element('button', `hud-button hud-button-main${look}`, text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    return button;
  }

  /** A quiet line under an action, its description (`aria-describedby`). */
  function hint(button: HTMLElement, text: string, id: string): HTMLElement {
    const line = element('p', 'action-hint', text);
    line.id = id;
    button.setAttribute('aria-describedby', id);
    return line;
  }

  /**
   * The person's head: their disc, their @username (none for a made-up "Player 1234") and status
   * on one line under the sheet's title, which is their name; a friend's head-to-head under it
   * where they have finished a series together (ADR 0088).
   */
  function headOf(person: FriendEntry, kind: PersonKind, waiting: boolean): HTMLElement {
    const head = element('div', 'friend-sheet-person');
    const who = element('p', 'friend-sheet-who');
    const handle = handleOf(person.name);
    if (handle !== undefined) who.append(element('span', 'friend-sheet-handle', handle));
    const status = element('span', 'friends-status', personStatus(person, kind, waiting));
    if (kind === 'friend')
      status.dataset['status'] = waiting ? 'waiting' : (person.status ?? 'offline');
    who.append(status);
    const words = element('div', 'friend-sheet-words');
    words.append(who);
    if (kind === 'friend' && person.record !== undefined) {
      const { shown, said } = headToHead(person.record, person.name);
      const record = element('p', 'friend-sheet-record');
      const visible = element('span', '', shown);
      visible.setAttribute('aria-hidden', 'true');
      record.append(visible, element('span', 'visually-hidden', said));
      words.append(record);
    }
    head.append(personDisc(person, 'sheet'), words);
    return head;
  }

  /** A friend's actions: Challenge, always, into the one path with them picked. */
  function friendActions(person: FriendEntry, waiting: boolean): HTMLElement {
    const actions = element('div', 'action-stack friend-sheet-actions');
    const challenge = host.challenge;
    // Challenge always shows, so the sheet keeps one shape (ADR 0086, 2026-11-26). When nothing can
    // start with the friend now, it stays focusable but unavailable, and one line under it says why.
    const why = challengeUnavailable(person, waiting, host.turns === true);
    if (challenge !== undefined) {
      const go = action(SHEET_LINES.challenge, `Challenge ${person.name}`, why === undefined);
      go.addEventListener('click', () => {
        if (go.getAttribute('aria-disabled') === 'true') return;
        sheet.close();
        challenge(person);
      });
      actions.append(go);
      if (why !== undefined) {
        go.setAttribute('aria-disabled', 'true');
        actions.append(hint(go, why, 'friend-sheet-why'));
      }
    }
    return actions;
  }

  function open(person: FriendEntry, kind: PersonKind, waiting = false): void {
    sheet.title.textContent = person.name;
    const head = headOf(person, kind, waiting);
    if (kind === 'friend') {
      const remove = row(SHEET_LINES.remove, `Remove ${person.name}`);
      remove.addEventListener('click', () => {
        void sheet.confirm(REMOVE_STEP(person.name)).then((yes) => {
          if (yes) void doing(() => host.remove(person.id), SHEET_LINES.removed(person.name))();
        });
      });
      const rows = element('div', 'action-stack friend-sheet-rows');
      rows.append(remove);
      sheet.content.replaceChildren(head, friendActions(person, waiting), rows, dangerZone(person));
    } else if (kind === 'incoming') {
      const actions = element('div', 'action-stack friend-sheet-actions');
      const accept = action('Accept', `Accept ${person.name}`, true);
      busyOnClick(
        accept,
        doing(() => host.accept(person.id)),
      );
      const decline = action('Decline', `Decline ${person.name}`, false);
      busyOnClick(
        decline,
        doing(() => host.decline(person.id)),
      );
      actions.append(accept, decline);
      sheet.content.replaceChildren(head, actions, dangerZone(person));
    } else {
      const outgoing = kind === 'outgoing';
      const button = action(
        outgoing ? SHEET_LINES.cancelRequest : 'Unblock',
        outgoing ? `Cancel your request to ${person.name}` : `Unblock ${person.name}`,
        false,
      );
      busyOnClick(
        button,
        doing(() => (outgoing ? host.decline(person.id) : host.unblock(person.id))),
      );
      const actions = element('div', 'action-stack friend-sheet-actions');
      actions.append(button);
      sheet.content.replaceChildren(head, actions);
    }
    sheet.open();
  }

  return { element: sheet.element, open };
}
