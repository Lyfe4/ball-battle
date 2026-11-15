// Friend challenges on the page (ADR 0052): sending one (a lineup, then the link to share) and
// answering one (the card that says who sent it, then a lineup without seeing theirs). The guest
// is made here, on the first online action only, after the 16+ confirmation: one short card in
// the flow, never on load. Every state has a way on (ADR 0027).
import type { ErrorCode } from '../api/errors.ts';
import { callApi, failureKindOf, type ApiFailure } from '../app/api.ts';
import { inAppBrowserOf } from '../app/in-app-browser.ts';
import { hasGuest, rememberGuest, type DeviceStorage } from '../app/online-device.ts';
import { writeChallengeParams, writeOnlineSeriesParams } from '../app/online-url.ts';
import type { Accepted, ChallengeInfo, ChallengeLink } from '../api/challenges.ts';
import type { BestOf, Format, Lineup } from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import type { Draft } from '../ui/lineup-draft.ts';
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createLineupStep } from '../ui/series/lineup-step.ts';
import { inAMatchCard } from './current-match.ts';
import { adultCard, cardFor, shareLink } from './online-challenge-text.ts';
import { onlineNotice } from './online-text.ts';

/** How often a sender's lobby asks whether the friend has accepted: the lobby's heartbeat. */
const LOBBY_POLL_MS = 2_000;

export interface ChallengeHost {
  /** Moves by the Back rules (ADR 0025). */
  go(write: (params: URLSearchParams) => void): void;
  /** Shows another screen in place of this entry. */
  replaceWith(write: (params: URLSearchParams) => void): void;
  /** In-app Back, or `toParent` when there is no history to go back to. */
  back(toParent: () => void): void;
  home(): void;
  /** Other modes, where challenges are sent from. */
  modes(): void;
  readonly storage: DeviceStorage;
}

export interface ChallengeScreens {
  setVisible(visible: boolean): void;
  /** A friend's link: its card, or the lineup that accepts it. */
  showChallenge(token: string, step: 'card' | 'lineup'): void;
  /** The lineup for a challenge to send. */
  showSend(format: Format, bestOf: BestOf): void;
  /** The page is visible again: a waiting lobby asks now. */
  resumed(): void;
}

/** Refusals of an accept that the link's own card explains; any other shows its message. */
const CARD_SAYS: ReadonlySet<ErrorCode> = new Set([
  'not_found',
  'challenge_taken',
  'challenge_expired',
  'own_challenge',
]);

export function createChallengeScreens(
  roots: { readonly notice: HTMLElement; readonly lineup: HTMLElement },
  balls: readonly BallDefinition[],
  host: ChallengeHost,
): ChallengeScreens {
  let visible = false;
  let draft: Draft = [];
  let info: ChallengeInfo | undefined;
  let token: string | undefined;
  /** One id per challenge being sent, so a retry after a lost answer gets the same link. */
  let requestId = crypto.randomUUID();
  let sending: { readonly format: Format; readonly bestOf: BestOf } | undefined;
  /** The lobby's next ask, while the sender waits in it. */
  let lobby: number | undefined;

  const notice = createNotice(roots.notice, () => {
    host.back(() => {
      host.home();
    });
  });
  const lineup = createLineupStep(balls, {
    onBack: () => {
      host.back(() => {
        if (sending !== undefined || token === undefined) host.modes();
        else
          host.replaceWith((url) => {
            writeChallengeParams(url, token ?? '');
          });
      });
    },
    onLevel: () => undefined,
    onChange: (tray) => {
      draft = tray;
    },
    // Send challenge and Accept challenge are requests: the button shows it is working.
    onDone: (own) => (sending === undefined ? accept(own) : send(own)),
  });
  roots.lineup.classList.add('series-setup');
  roots.lineup.replaceChildren(lineup.element);

  function stopLobby(): void {
    if (lobby !== undefined) window.clearTimeout(lobby);
    lobby = undefined;
  }

  function show(part: 'notice' | 'lineup', content?: NoticeContent): void {
    stopLobby();
    roots.notice.hidden = !visible || part !== 'notice';
    roots.lineup.hidden = !visible || part !== 'lineup';
    if (content !== undefined) notice.show(content);
  }

  const home = () => {
    host.home();
  };

  /** A failure as a notice; an `unauthenticated` one first asks for the 16+ confirmation. */
  function failed(answer: ApiFailure, retry: () => Promise<unknown>): void {
    if (answer.kind === 'error' && answer.code === 'unauthenticated') {
      rememberGuest(host.storage, false);
      show(
        'notice',
        adultCard(
          () => startGuest(retry),
          () => {
            host.back(home);
          },
        ),
      );
      return;
    }
    const reason = answer.kind === 'error' ? answer.message : undefined;
    if (answer.kind === 'error' && answer.code === 'in_a_match') {
      show(
        'notice',
        inAMatchCard(
          answer.message,
          (write) => {
            host.go(write);
          },
          home,
        ),
      );
      return;
    }
    show('notice', onlineNotice(failureKindOf(answer), retry, home, reason));
  }

  /**
   * The first online action on a device with no guest asks for the 16+ confirmation before any
   * request (a device that lost its cookie meets the same card after a 401). True when it asked.
   */
  function askFirst(then: () => Promise<unknown>): boolean {
    if (hasGuest(host.storage)) return false;
    show(
      'notice',
      adultCard(
        () => startGuest(then),
        () => {
          host.back(home);
        },
      ),
    );
    return true;
  }

  /** Makes the guest (the first online action), then does what was asked. */
  async function startGuest(then: () => Promise<unknown>): Promise<void> {
    const made = await callApi<unknown>('POST', 'session', { adult: true });
    if (!made.ok) {
      failed(made, () => startGuest(then));
      return;
    }
    rememberGuest(host.storage, true);
    // The age card's button stays busy through the request it was asked for.
    await then();
  }

  async function send(own: Lineup): Promise<void> {
    if (sending === undefined || askFirst(() => send(own))) return;
    // Live (ADR 0053): both players in the match until it ends.
    const body = { ...sending, lineup: own, requestId, live: true };
    const answer = await callApi<ChallengeLink>('POST', 'challenges', body);
    if (!answer.ok) {
      failed(answer, () => send(own));
      return;
    }
    const link = answer.body;
    if (link === undefined) return;
    requestId = crypto.randomUUID();
    // The sender's own card shares the link; this lineup entry becomes it.
    host.replaceWith((url) => {
      writeChallengeParams(url, link.token);
    });
  }

  async function accept(own: Lineup): Promise<void> {
    if (token === undefined || askFirst(() => accept(own))) return;
    const answer = await callApi<Accepted>('POST', `challenges/${token}/accept`, { lineup: own });
    if (!answer.ok) {
      if (answer.kind === 'error' && answer.code !== undefined && CARD_SAYS.has(answer.code)) {
        // Taken, expired, the sender's own or gone: the card says so with a way on.
        await loadCard();
        return;
      }
      failed(answer, () => accept(own));
      return;
    }
    const seriesId = answer.body?.seriesId;
    if (seriesId === undefined) return;
    rememberGuest(host.storage, true);
    host.replaceWith((url) => {
      writeOnlineSeriesParams(url, seriesId);
    });
  }

  async function loadCard(): Promise<void> {
    if (token === undefined) return;
    const answer = await callApi<ChallengeInfo>('GET', `challenges/${token}`);
    if (!answer.ok || answer.body === undefined) {
      if (!answer.ok && answer.kind === 'error' && answer.status === 404) {
        show('notice', cardFor(undefined, cardActions()));
      } else if (!answer.ok) failed(answer, () => loadCard());
      return;
    }
    info = answer.body;
    // The sender's live link was accepted: straight into the match, in place of the lobby.
    const started = info.seriesId;
    if (info.live && info.own && started !== null) {
      host.replaceWith((url) => {
        writeOnlineSeriesParams(url, started);
      });
      return;
    }
    show('notice', cardFor(info, cardActions(), inAppBrowserOf(navigator.userAgent)));
    // Waiting in the lobby: ask again soon (each ask keeps the link open).
    if (info.live && info.status === 'yours' && visible) {
      lobby = window.setTimeout(() => void loadCard(), LOBBY_POLL_MS);
    }
  }

  /** The sender stops waiting: the link stops, and they go home (or into the match, if taken). */
  async function cancel(): Promise<void> {
    if (token === undefined) return;
    stopLobby();
    const answer = await callApi<ChallengeInfo>('POST', `challenges/${token}/cancel`, {});
    const started = answer.ok ? answer.body?.seriesId : undefined;
    if (started != null) {
      host.replaceWith((url) => {
        writeOnlineSeriesParams(url, started);
      });
    } else host.home();
  }

  function cardActions() {
    const current = token ?? '';
    return {
      token: current,
      home,
      lineup: () => {
        host.go((url) => {
          writeChallengeParams(url, current, 'lineup');
        });
      },
      series: (id: string) => {
        host.go((url) => {
          writeOnlineSeriesParams(url, id);
        });
      },
      sendOwn: () => {
        host.modes();
      },
      share: () => shareLink(current),
      cancel: () => cancel(),
    };
  }

  return {
    setVisible(next) {
      visible = next;
      if (!next) show('notice');
    },
    resumed() {
      // Back from a share sheet or another app: the lobby asks at once.
      if (visible && lobby !== undefined) {
        stopLobby();
        void loadCard();
      }
    },
    showChallenge(next, step) {
      sending = undefined;
      if (token !== next) info = undefined;
      token = next;
      if (step === 'lineup' && info?.status === 'open') {
        show('lineup');
        lineup.open(info.format, draft, undefined, info.bestOf, 'Accept challenge');
        return;
      }
      if (step === 'lineup') {
        // Opened straight from a URL: the card first, which knows the format.
        host.replaceWith((url) => {
          writeChallengeParams(url, next);
        });
        return;
      }
      show('notice', { title: 'Loading…', body: [], buttons: [{ text: 'Home', onClick: home }] });
      void loadCard();
    },
    showSend(format, bestOf) {
      sending = { format, bestOf };
      token = undefined;
      show('lineup');
      lineup.open(format, draft, undefined, bestOf, 'Send challenge');
    },
  };
}
