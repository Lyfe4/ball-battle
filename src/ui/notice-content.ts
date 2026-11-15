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
  /** A short numbered list in a box: "How it goes". */
  readonly steps?: { readonly title: string; readonly items: readonly string[] };
  /** A link in a quiet box under the buttons, with Copy where there is a clipboard. */
  readonly link?: { readonly url: string; readonly copy?: () => Promise<string> };
  /** One paragraph after the link box. */
  readonly note?: string;
  /** A quiet action, as a text link, last: Cancel challenge, Not now. */
  readonly quiet?: NoticeButton;
}
