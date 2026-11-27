// What a waiting card says (waiting.ts), as data: pure, so the screens' words are tested without a
// DOM.

/** Its title, one quiet line, and whom it waits for (their disc beside the title). */
export interface WaitingContent {
  readonly title: string;
  readonly line: string;
  readonly who?: string;
}
