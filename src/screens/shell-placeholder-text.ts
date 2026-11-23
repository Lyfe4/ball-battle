// What the shell's screens say before their own pull requests fill them (ADR 0081, build plan):
// Friends, Profile and Ranks, each a notice with one way on, so none is a dead end (ADR 0027).
// Pure, so the words and where each button leads are tested without a DOM.
import type { ShellView } from '../app/route.ts';

export type PlaceholderWay = 'send' | 'signin' | 'home';

export interface PlaceholderText {
  readonly title: string;
  readonly body: string;
  readonly button: string;
  /** Where the button leads: the send screen, the account screen, or Play (home). */
  readonly to: PlaceholderWay;
}

export const PLACEHOLDERS: Readonly<Record<ShellView, PlaceholderText>> = {
  friends: {
    title: 'Friends',
    body: 'Your friends and challenges get their own place here soon. You can challenge a friend with a link now.',
    button: 'Challenge a friend',
    to: 'send',
  },
  profile: {
    title: 'Profile',
    body: 'Your profile gets its own screen here soon. For now, your account is on the account screen.',
    button: 'Your account',
    to: 'signin',
  },
  ranks: {
    title: 'Ranks',
    body: 'Ranks open with ranked play. Until then, every match is for fun.',
    button: 'Play',
    to: 'home',
  },
};
