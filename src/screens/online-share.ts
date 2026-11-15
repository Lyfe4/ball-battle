// Sharing a challenge's link (ADR 0052, 0055): the system share sheet where there is one (phones),
// else the clipboard. Kept apart from the card's words, which are pure.

/** The link to a challenge, on this site. */
export const challengeUrl = (token: string): string =>
  `${window.location.origin}/?challenge=${encodeURIComponent(token)}`;

/** The link to the clipboard; resolves to what happened, for the button. */
export async function copyLink(token: string): Promise<string> {
  try {
    await navigator.clipboard.writeText(challengeUrl(token));
    return 'Copied';
  } catch {
    return 'Select the link to copy it';
  }
}

/** The system share sheet where there is one (phones), else the clipboard. */
export async function shareLink(token: string): Promise<string> {
  const url = challengeUrl(token);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'BallBattle challenge', url });
      return 'Shared';
    }
    await navigator.clipboard.writeText(url);
    return 'Link copied';
  } catch {
    return 'Copy the link above';
  }
}
