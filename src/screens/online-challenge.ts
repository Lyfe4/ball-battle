// Friend challenges on the page (ADR 0052, 0055, 0080): sending one (the vs Friend setup's Send
// challenge, then the lobby with the link to share) and answering one (the card that says who sent
// it, with Accept). Once accepted, both players pick their lineups together on one screen
// (`?start=`, start-lineup.ts), the same screen a rematch uses. The guest is made here after the 16+
// confirmation, asked once per device at the start of either flow (opening the vs Friend setup, or
// Accept on a friend's card); never on load. Every state has a way on (ADR 0027).
import { callApi } from '../app/api.ts';
import { inAppBrowserOf } from '../app/in-app-browser.ts';
import { rememberGuest } from '../app/online-device.ts';
import {
  writeChallengeParams,
  writeOnlineSeriesParams,
  writeStartParams,
} from '../app/online-url.ts';
import type { Accepted, ChallengeInfo, ChallengeLink } from '../api/challenges.ts';
import type { BestOf, Format } from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createLineupStep } from '../ui/series/lineup-step.ts';
import type { SetupChoices } from '../ui/series/rules-step.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { createFriendSetup } from './friend-setup.ts';
import { createGuestGate } from './guest-gate.ts';
import { CARD_SAYS, cardFor } from './online-challenge-text.ts';
import type { ChallengeHost, ChallengeScreens } from './online-challenge-types.ts';
import { challengeUrl, copyLink, shareLink } from './online-share.ts';
import { createStartLineup } from './start-lineup.ts';

export type { ChallengeHost, ChallengeScreens } from './online-challenge-types.ts';

/** How often a sender's lobby asks whether the friend has accepted: the lobby's heartbeat. */
const LOBBY_POLL_MS = 2_000;

export function createChallengeScreens(
  roots: {
    readonly notice: HTMLElement;
    readonly lineup: HTMLElement;
    /** The card's layout while it loads on its own (a link opened cold, a reload). */
    readonly loading: HTMLElement;
  },
  balls: readonly BallDefinition[],
  host: ChallengeHost,
): ChallengeScreens {
  let visible = false;
  let info: ChallengeInfo | undefined;
  let token: string | undefined;
  /** One id per challenge being sent, so a retry after a lost answer gets the same link. */
  let requestId = crypto.randomUUID();
  /** The lobby's next ask, while the sender waits in it. */
  let lobby: number | undefined;
  /** The friend the challenge being sent is for (ADR 0079 PR (d)), if any. */
  let inviting: { readonly id: string; readonly name: string } | undefined;

  const home = () => {
    host.home();
  };
  const back = () => {
    host.back(home);
  };
  const notice = createNotice(roots.notice, back);
  createSkeleton(roots.loading, 'card', back);
  const setup = createFriendSetup({
    back,
    rewrite: (write) => {
      host.rewrite(write);
    },
    send: (chosen) => send(chosen),
  });
  const lineup = createLineupStep(balls, {
    // Back holds the lineups: the clock runs on, and home leads back to them (ADR 0080).
    onBack: back,
    onLevel: () => undefined,
    onChange: (tray) => {
      start.changed(tray);
    },
    // Lock in is a request: the button shows it is working.
    onDone: (own) => start.lock(own),
  });
  roots.lineup.classList.add('series-setup');
  roots.lineup.replaceChildren(setup.element, lineup.element);

  const start = createStartLineup(lineup, {
    showLineup: () => {
      show('lineup');
    },
    show: (content, focus) => {
      show('notice', content, focus);
    },
    loading: () => {
      show('loading');
    },
    intoSeries: (id) => intoSeries(id),
    home,
    failed: (answer, retry) => {
      failed(answer, retry);
    },
  });

  function stopLobby(): void {
    if (lobby !== undefined) window.clearTimeout(lobby);
    lobby = undefined;
  }

  /** Shows one part; `focus` false keeps focus where it is (the lobby's card, asked again). */
  function show(
    part: 'notice' | 'setup' | 'lineup' | 'loading',
    content?: NoticeContent,
    focus = true,
  ): void {
    stopLobby();
    roots.notice.hidden = !visible || part !== 'notice';
    roots.lineup.hidden = !visible || (part !== 'lineup' && part !== 'setup');
    setup.element.hidden = part !== 'setup';
    lineup.element.hidden = part !== 'lineup';
    roots.loading.hidden = !visible || part !== 'loading';
    if (content !== undefined) notice.show(content, focus);
  }

  /** Into series `id` once it is read, in place of this screen. */
  async function intoSeries(id: string): Promise<void> {
    await host.primeSeries(id);
    host.replaceWith((url) => {
      writeOnlineSeriesParams(url, id);
    });
  }

  /** Into the lineups picked together once read: in place of the card, or moved to (`go`). */
  async function intoStart(id: string, how: 'replace' | 'go' = 'replace'): Promise<void> {
    await start.prime(id);
    const write = (url: URLSearchParams) => {
      writeStartParams(url, id);
    };
    if (how === 'go') host.go(write);
    else host.replaceWith(write);
  }

  // The 16+ question and failures, as notices in this screen's place.
  const { failed, askFirst } = createGuestGate({
    storage: host.storage,
    show: (content) => {
      show('notice', content);
    },
    back,
    home,
    toMatch: (match) => host.toMatch(match),
  });

  /** Sends the challenge from the vs Friend setup: no lineup (ADR 0080), straight to the lobby. */
  async function send(chosen: SetupChoices): Promise<void> {
    if (askFirst(() => send(chosen))) return;
    // Live (ADR 0053): both players in the match until it ends.
    const body = {
      format: chosen.format,
      bestOf: chosen.bestOf,
      requestId,
      live: true,
      ...(inviting === undefined ? {} : { friend: inviting.id }),
    };
    const answer = await callApi<ChallengeLink>('POST', 'challenges', body);
    if (!answer.ok) {
      failed(answer, () => send(chosen));
      return;
    }
    const link = answer.body;
    if (link === undefined) return;
    requestId = crypto.randomUUID();
    inviting = undefined;
    // The sender's own card (the lobby) shares the link. It is read first, so the button stays
    // busy until the lobby can show, which takes this setup's place.
    token = link.token;
    const card = await callApi<ChallengeInfo>('GET', `challenges/${link.token}`);
    info = card.ok ? card.body : undefined;
    host.go((url) => {
      writeChallengeParams(url, link.token);
    });
  }

  /** Accepts the link on screen: into the lineups picked together (`how`: from the inbox, go). */
  async function accept(how: 'replace' | 'go' = 'replace'): Promise<void> {
    const current = token;
    if (current === undefined || askFirst(() => accept(how))) return;
    const answer = await callApi<Accepted>('POST', `challenges/${current}/accept`, {});
    if (!answer.ok) {
      if (answer.kind === 'error' && answer.code !== undefined && CARD_SAYS.has(answer.code)) {
        // Taken, expired, the sender's own or gone: the card says so with a way on.
        if (how === 'go') {
          host.go((url) => {
            writeChallengeParams(url, current);
          });
        } else await loadCard();
        return;
      }
      failed(answer, () => accept(how));
      return;
    }
    rememberGuest(host.storage, true);
    const accepted = answer.body;
    if (accepted?.startId != null) await intoStart(accepted.startId, how);
    else if (accepted?.seriesId != null) await intoSeries(accepted.seriesId);
  }

  /** Asks for the card; `focus` false when it already shows (the lobby asking again). */
  async function loadCard(focus = true): Promise<void> {
    if (token === undefined) return;
    const answer = await callApi<ChallengeInfo>('GET', `challenges/${token}`);
    if (!answer.ok || answer.body === undefined) {
      if (!answer.ok && answer.kind === 'error' && answer.status === 404) {
        show('notice', cardFor(undefined, cardActions()));
      } else if (!answer.ok) failed(answer, () => loadCard());
      return;
    }
    info = answer.body;
    // The sender's live link was accepted: straight to the lineups (or the match), in its place.
    if (info.live && info.own && info.status === 'yours') {
      if (info.seriesId !== null) {
        await intoSeries(info.seriesId);
        return;
      }
      if (info.startId !== null) {
        await intoStart(info.startId);
        return;
      }
    }
    showCard(info, focus);
  }

  /** The card for `card`; a waiting lobby asks again soon (each ask keeps the link open). */
  function showCard(card: ChallengeInfo, focus: boolean): void {
    show('notice', cardFor(card, cardActions(), inAppBrowserOf(navigator.userAgent)), focus);
    if (card.live && card.status === 'yours' && visible) {
      lobby = window.setTimeout(() => void loadCard(false), LOBBY_POLL_MS);
      host.lobbyWaits?.();
    }
  }

  /** The sender stops waiting: the link stops, and they go home (or on, if it was accepted). */
  async function cancel(): Promise<void> {
    if (token === undefined) return;
    stopLobby();
    const answer = await callApi<ChallengeInfo>('POST', `challenges/${token}/cancel`, {});
    const card = answer.ok ? answer.body : undefined;
    if (card?.seriesId != null) await intoSeries(card.seriesId);
    else if (card?.startId != null) await intoStart(card.startId);
    else host.home();
  }

  function cardActions() {
    const current = token ?? '';
    return {
      token: current,
      home,
      // The 16+ question comes first, on a device that hasn't answered it (askFirst).
      accept: () => accept(),
      lineups: (id: string) => intoStart(id, 'go'),
      series: (id: string) => {
        host.go((url) => {
          writeOnlineSeriesParams(url, id);
        });
      },
      sendOwn: () => {
        host.friend();
      },
      share: () => shareLink(current),
      url: challengeUrl(current),
      canShare: typeof navigator.share === 'function',
      copy: () => copyLink(current),
      cancel: () => cancel(),
    };
  }

  return {
    setVisible(next) {
      // Leaving these screens forgets a friend being challenged: a later challenge is a link.
      if (!next && visible) inviting = undefined;
      visible = next;
      if (!next) {
        show('notice');
        start.stop();
      }
    },
    resumed() {
      // Back from a share sheet or another app: the lobby asks at once.
      if (visible && lobby !== undefined) {
        stopLobby();
        void loadCard(false);
      }
    },
    showChallenge(next) {
      start.stop();
      if (token !== next) info = undefined;
      token = next;
      // Read just before (the lobby after Send challenge): shown at once, and asked again as the
      // lobby does. Else the card's layout until it comes (ADR 0054).
      if (info === undefined) {
        show('loading');
        void loadCard();
      } else {
        showCard(info, true);
        // A card seen before is asked again (it may have been taken); a lobby asks on its own.
        if (lobby === undefined) void loadCard(false);
      }
    },
    showStart(id) {
      start.open(id);
    },
    rematchShown: () => start.rematchOf(),
    async openInvite(next) {
      token = next;
      info = undefined;
      await accept('go');
    },
    challengeFriend(friend) {
      inviting = friend;
      host.friend();
    },
    showSend(format: Format, bestOf: BestOf) {
      token = undefined;
      start.stop();
      // The start of the vs Friend flow: the 16+ question first, on a device that hasn't answered.
      const open = () => {
        show('setup');
        setup.open({ format, bestOf, level: '' });
      };
      if (!askFirst(open)) open();
    },
  };
}
