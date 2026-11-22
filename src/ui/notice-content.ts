// What a notice says and offers (notice.ts), as data: pure, so a screen's words are tested
// without a DOM.
import type { StickerWords } from './sticker-words.ts';

export interface NoticeButton {
  readonly text: string;
  /** A request (it returns a promise) shows on the button until it settles (busy-button.ts). */
  readonly onClick: () => unknown;
  /** An accessible name, when the text alone isn't enough. */
  readonly label?: string;
  /** The request resolves to the button's new words ("Link copied"). */
  readonly relabel?: boolean;
}

/**
 * One thing to type (ADR 0079: an email, a sign-in code), between the body and the buttons. Its
 * input is kept while the notice shows the same kind of field, so a new message never loses what
 * was typed; Enter presses the first button.
 */
export interface NoticeField {
  readonly kind: 'email' | 'code';
  readonly label: string;
  /** Each change, as typed. */
  readonly onInput: (value: string) => void;
  /** What went wrong with it, under it (read out at once). */
  readonly error?: string;
}

export interface NoticeContent {
  readonly title: string;
  /** One paragraph per entry. */
  readonly body: readonly string[];
  /** In order; the first is the primary. Empty only while something loads. */
  readonly buttons: readonly NoticeButton[];
  /** A sticker in the title's place (a friend's card): the title is then for screen readers. */
  readonly sticker?: StickerWords;
  /** Short facts as chips under the sticker: "Best of 3", "Reveal", "Live · 30 s a pick". */
  readonly chips?: readonly string[];
  /** A waiting card with a bouncing ball (the lobby): its heading and one quiet line. */
  readonly waiting?: { readonly title: string; readonly line: string };
  /** A field to type in (an email, a code). */
  readonly field?: NoticeField;
  /** A short numbered list in a box: "How it goes". */
  readonly steps?: { readonly title: string; readonly items: readonly string[] };
  /** A link in a quiet box under the buttons, with Copy where there is a clipboard. */
  readonly link?: { readonly url: string; readonly copy?: () => Promise<string> };
  /** Pages to read, as links after the body (the privacy policy and terms); each opens in a tab of
   * its own, so the screen it was read from stays where it was. */
  readonly links?: readonly { readonly text: string; readonly href: string }[];
  /** One paragraph after the link box. */
  readonly note?: string;
  /** A quiet action, as a text link, last: Cancel challenge, Not now. */
  readonly quiet?: NoticeButton;
}
