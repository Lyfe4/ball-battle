// What the shell's screens say before their own pull requests fill them (ADR 0081, build plan):
// Ranks, a notice with one way on, so it is no dead end (ADR 0027). Profile (profile.ts, PR 5) and
// Friends (friends-tab.ts, PR 6) have their own screens.
// Pure, so the words and where each button leads are tested without a DOM.
import type { ShellView } from '../app/route.ts';

export type PlaceholderWay = 'home';

/** The shell's screens still drawn as placeholders. */
export type PlaceholderView = Exclude<ShellView, 'profile' | 'friends'>;
export const PLACEHOLDER_VIEWS: readonly PlaceholderView[] = ['ranks'];

export interface PlaceholderText {
  readonly title: string;
  readonly body: string;
  readonly button: string;
  /** Where the button leads: Play (home). */
  readonly to: PlaceholderWay;
}

export const PLACEHOLDERS: Readonly<Record<PlaceholderView, PlaceholderText>> = {
  ranks: {
    title: 'Ranks',
    body: 'Ranks open with ranked play. Until then, every match is for fun.',
    button: 'Play',
    to: 'home',
  },
};
