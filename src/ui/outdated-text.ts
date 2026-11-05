// What the outdated-link screen says (ADR 0022). Plain strings, so the wording is tested.

/** Which kind of replay link is outdated, and whether it is older or newer than this page. */
export interface OutdatedLink {
  readonly kind: 'match' | 'series';
  readonly newer: boolean;
}

/** The notice's text for a link (ADR 0022). Pure, so the wording is tested. */
export function outdatedText({ kind, newer }: OutdatedLink): {
  readonly title: string;
  readonly body: string;
  readonly play: string;
} {
  if (newer) {
    return {
      title: 'A newer link',
      body: `This ${kind} was played on a newer version of BallBattle than this page. Reload to get it and replay the ${kind} as it was.`,
      play: 'Play with this version',
    };
  }
  return {
    title: 'An older link',
    body: `This ${kind} was played on an earlier version of BallBattle. Balls or rules may have changed since, so it may not play out the way it did.`,
    play: 'Play with today’s rules',
  };
}
