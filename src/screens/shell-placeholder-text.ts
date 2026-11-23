// What the shell's screens say before their own pull requests fill them (ADR 0081, build plan):
// Friends and Ranks, each a notice with one way on, so none is a dead end (ADR 0027). Profile has
// its own screen (profile.ts, PR 5).
// Pure, so the words and where each button leads are tested without a DOM.
import type { ShellView } from '../app/route.ts';

export type PlaceholderWay = 'send' | 'home';

/** The shell's screens still drawn as placeholders. */
export type PlaceholderView = Exclude<ShellView, 'profile'>;
export const PLACEHOLDER_VIEWS: readonly PlaceholderView[] = ['friends', 'ranks'];

export interface PlaceholderText {
  readonly title: string;
  readonly body: string;
  readonly button: string;
  /** Where the button leads: the send screen or Play (home). */
  readonly to: PlaceholderWay;
}

export const PLACEHOLDERS: Readonly<Record<PlaceholderView, PlaceholderText>> = {
  friends: {
    title: 'Friends',
    body: 'Your friends and challenges get their own place here soon. You can challenge a friend with a link now.',
    button: 'Challenge a friend',
    to: 'send',
  },
  ranks: {
    title: 'Ranks',
    body: 'Ranks open with ranked play. Until then, every match is for fun.',
    button: 'Play',
    to: 'home',
  },
};
