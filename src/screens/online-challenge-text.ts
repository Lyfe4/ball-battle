// A challenge's card in each state, the 16+ confirmation, and sharing a link (ADR 0052).
import type { ChallengeInfo } from '../api/challenges.ts';
import type { NoticeContent } from '../ui/notice.ts';
import { challengeLine } from './online-text.ts';

export interface CardActions {
  /** The link's token: the card shows the link as text, to copy by hand. */
  readonly token: string;
  readonly home: () => void;
  /** Build a lineup to accept it. */
  readonly lineup: () => void;
  /** Open the series it started. */
  readonly series: (id: string) => void;
  /** Send a challenge of one's own instead. */
  readonly sendOwn: () => void;
  /** Share (or copy) the sender's own link; resolves to what happened, for the button. */
  readonly share: () => Promise<string>;
  /** PROTOTYPE (live): the sender stops waiting; the link stops working. */
  readonly cancel: () => void;
}

/** The link to a challenge, on this site. */
export const challengeUrl = (token: string): string =>
  `${window.location.origin}/?challenge=${encodeURIComponent(token)}`;

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

/** What a challenge's card says and offers; `undefined` is a link nobody made. */
export function cardFor(info: ChallengeInfo | undefined, actions: CardActions): NoticeContent {
  const home = { text: 'Home', onClick: actions.home };
  const own = { text: 'Challenge a friend', onClick: actions.sendOwn };
  if (info === undefined) {
    return {
      title: 'No such challenge',
      body: ['This link doesn’t lead anywhere.'],
      buttons: [own, home],
    };
  }
  const what = challengeLine(info);
  const from = info.from ?? 'A deleted player';
  switch (info.status) {
    case 'open':
      return {
        title: `${from} challenges you`,
        body: [what, 'Build your lineup without seeing theirs. Then you play live: 30 s a pick.'],
        buttons: [{ text: 'Build your lineup', onClick: actions.lineup }, home],
      };
    case 'yours': {
      const series = info.seriesId;
      if (series !== null) {
        return {
          title: 'Your challenge was accepted',
          body: [what],
          buttons: [
            {
              text: 'Open the series',
              onClick: () => {
                actions.series(series);
              },
            },
            home,
          ],
        };
      }
      // PROTOTYPE (live): the lobby. The match starts the moment the friend accepts.
      return {
        title: 'Waiting for your friend…',
        body: [
          what,
          'Send them this link and stay here: the match starts as soon as they accept.',
          challengeUrl(actions.token),
        ],
        buttons: [shareButton(actions), { text: 'Cancel', onClick: actions.cancel }],
      };
    }
    case 'accepted': {
      const series = info.seriesId ?? '';
      return {
        title: 'You accepted this challenge',
        body: [what],
        buttons: [
          {
            text: 'Open the series',
            onClick: () => {
              actions.series(series);
            },
          },
          home,
        ],
      };
    }
    case 'taken':
      return {
        title: 'Challenge taken',
        body: ['Someone else accepted this challenge first.'],
        buttons: [own, home],
      };
    default:
      return { title: 'This challenge has expired', body: [what], buttons: [own, home] };
  }
}

function shareButton(actions: CardActions) {
  const label = typeof navigator.share === 'function' ? 'Share link' : 'Copy link';
  return {
    text: label,
    onClick: (event?: Event) => {
      const button = event?.currentTarget;
      void actions.share().then((done) => {
        if (button instanceof HTMLElement) button.textContent = done;
      });
    },
  };
}

/**
 * The first online action asks once (ADR 0052 section 6): online play is for players 16 and over,
 * and says what is kept. Confirming makes the guest.
 */
export function adultCard(confirm: () => void, cancel: () => void): NoticeContent {
  return {
    title: 'Play online',
    body: [
      'Online play is for players 16 and over.',
      'You’ll play as a guest with a made-up name. We keep a random id, your games, and when you ' +
        'confirmed your age: nothing else. “Forget me” in settings deletes it all.',
    ],
    buttons: [
      { text: 'I’m 16 or older', onClick: confirm },
      { text: 'Not now', onClick: cancel },
    ],
  };
}
