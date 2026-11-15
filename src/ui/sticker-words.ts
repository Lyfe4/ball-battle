// A sticker's words (sticker.ts), as data.
export interface StickerWords {
  /** Small words over the title: "A challenge from". */
  readonly above?: string;
  /** The big words: "Player 6908", "You win". */
  readonly title: string;
  /** Small words under the title: "2–1 vs Player 4821". */
  readonly below?: string;
}
