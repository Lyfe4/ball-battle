/** A link to a ball's manual entry, from a screen that shows the ball (the quick setup's ⓘ). */
export interface BallInfoLink {
  /** The URL of a ball's manual entry, so the link also opens in a new tab. */
  readonly href: (id: string) => string;
  /** A plain click: open the entry in the app, so Back returns here. */
  readonly open: (id: string) => void;
}
