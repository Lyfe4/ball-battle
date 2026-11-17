import { TOSS_FLIP_MS } from '../../api/live.ts';
import {
  coinFace,
  offlineToss,
  nextStageChange,
  tossStage,
  tossWords,
  type TossStage,
  type TossTimes,
} from '../../app/coin-toss.ts';
import type { Side } from '../../sim/series.ts';
import { element, setAttr, setText } from '../dom.ts';
import { BOT_SEATS, otherSide, type Seats } from './seats.ts';
import type { SeriesMoment } from './series-view.ts';

/** One toss to show: who won it, a key that names it, the seats, and its moments on `now`'s clock. */
export interface TossPlay {
  readonly first: Side;
  readonly key: string;
  readonly seats: Seats;
  readonly times: TossTimes;
  /** The clock `times` are on: this device's (offline) or the server's as this page knows it. */
  readonly now: () => number;
}

export interface CoinToss {
  readonly element: HTMLElement;
  /** Shows `play` at its stage now (hidden when undefined or over); returns that stage. */
  show(play: TossPlay | undefined): TossStage | undefined;
}

/**
 * The flip: up, five whole turns, down onto the winner's face with a squash. It rises by a share of
 * the coin's own height (a translate percentage), so it scales with the coin at every screen size.
 */
const FLIP: Keyframe[] = [
  {
    offset: 0,
    transform: 'translateY(0) rotateX(0deg) scale(1, 1)',
    easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
  },
  {
    offset: 0.42,
    transform: 'translateY(-70%) rotateX(1080deg) scale(1.08, 1.08)',
    easing: 'cubic-bezier(0.6, 0, 0.9, 0.45)',
  },
  { offset: 0.8, transform: 'translateY(0) rotateX(1800deg) scale(1, 1)', easing: 'ease-out' },
  {
    offset: 0.88,
    transform: 'translateY(0) rotateX(1800deg) scale(1.12, 0.84)',
    easing: 'ease-out',
  },
  { offset: 1, transform: 'translateY(0) rotateX(1800deg) scale(1, 1)' },
];
/** The shadow under it shrinks and fades as the coin rises. */
const SHADOW: Keyframe[] = [
  { offset: 0, transform: 'scale(1)', opacity: 1, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' },
  {
    offset: 0.42,
    transform: 'scale(0.55)',
    opacity: 0.45,
    easing: 'cubic-bezier(0.6, 0, 0.9, 0.45)',
  },
  { offset: 0.8, transform: 'scale(1)', opacity: 1 },
  { offset: 1, transform: 'scale(1)', opacity: 1 },
];

/**
 * Reveal's coin toss as a moment (ADR 0061), the same part offline and live: a big Sticker Pop coin,
 * "You" on the player's yellow face and the other side's short label ("Bot", "P4821") on the pink
 * one, that flips for TOSS_FLIP_MS and lands on the winner, then says who shows first in full under
 * it. Live, "Get ready" comes first, and a page that learns of the toss late joins the flip where it
 * has got to (the animation's own clock), so both phones show the same moment. With reduced motion
 * the coin stays still, a "?" over it, and fades to the winner's face as it lands.
 */
export function createCoinToss(onStage: () => void): CoinToss {
  const root = element('div', 'coin-toss');
  root.hidden = true;
  const stage = element('div', 'coin-toss-stage');
  stage.setAttribute('aria-hidden', 'true');
  const coin = element('div', 'coin-toss-coin');
  const front = element('span', 'coin-toss-face');
  const back = element('span', 'coin-toss-face coin-toss-back');
  const frontLabel = element('span', 'coin-toss-label');
  const backLabel = element('span', 'coin-toss-label');
  front.append(frontLabel);
  back.append(backLabel);
  coin.append(front, back, element('span', 'coin-toss-blank', '?'));
  const shadow = element('div', 'coin-toss-shadow');
  stage.append(coin, shadow);
  const words = element('p', 'coin-toss-words');
  words.setAttribute('aria-live', 'polite');
  root.append(stage, words);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current: TossPlay | undefined;
  let shown: TossStage | undefined;
  let timer: number | undefined;
  let flips: Animation[] = [];

  function stopFlip(): void {
    for (const flip of flips) flip.cancel();
    flips = [];
  }

  /** The flip from where it has got to (`elapsed` ms in), on the animation's own clock. */
  function startFlip(elapsed: number): void {
    stopFlip();
    if (reducedMotion.matches) return;
    flips = [coin.animate(FLIP, TOSS_FLIP_MS), shadow.animate(SHADOW, TOSS_FLIP_MS)];
    for (const flip of flips) flip.currentTime = Math.min(TOSS_FLIP_MS, Math.max(0, elapsed));
  }

  /** Draws the stage now and sets one timer for the moment it next changes. */
  function draw(): TossStage | undefined {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    const play = current;
    if (play === undefined) {
      root.hidden = true;
      stopFlip();
      shown = undefined;
      return undefined;
    }
    const now = play.now();
    const next = tossStage(play.times, now);
    root.hidden = next === 'done';
    if (next !== shown) {
      if (next === 'flipping') startFlip(now - play.times.flipAt);
      else stopFlip();
      shown = next;
      setAttr(root, 'data-stage', next);
      setText(words, tossWords(next, play.first, play.seats));
    }
    const wait = nextStageChange(play.times, now);
    if (wait !== undefined) {
      timer = window.setTimeout(() => {
        draw();
        onStage();
      }, wait);
    }
    return next;
  }

  return {
    element: root,
    show(play) {
      const same =
        play?.key === current?.key &&
        play?.times.flipAt === current?.times.flipAt &&
        play?.times.doneAt === current?.times.doneAt;
      if (same && shown !== undefined) return shown;
      current = play;
      shown = undefined;
      if (play !== undefined) {
        // The winner's face lands up; the colours follow the seats: yellow is always the player's.
        setAttr(coin, 'data-first', play.first === play.seats.you ? 'you' : 'them');
        setText(frontLabel, coinFace(play.seats, play.first));
        setText(backLabel, coinFace(play.seats, otherSide(play.first)));
      }
      return draw();
    },
  };
}

export interface SeriesToss {
  readonly element: HTMLElement;
  /**
   * Shows round 1's toss (`first`, who won it; undefined when there is none) while it plays; true
   * until it is over. Live, its times are the server's (none before both players are here);
   * otherwise it flips as the pick (`picking`) first shows, once per series.
   */
  tossing(moment: SeriesMoment, first: Side | undefined, picking: boolean): boolean;
}

/** The series panel's toss: a rematch opened here offline, or a live match. */
export function createSeriesToss(onStage: () => void): SeriesToss {
  const toss = createCoinToss(onStage);
  const tossed = new Map<number, TossTimes>();
  const deviceNow = () => Date.now();
  return {
    element: toss.element,
    tossing(moment, first, picking) {
      const seed = moment.state.setup.seed;
      let times: TossTimes | undefined;
      if (first !== undefined && moment.online?.live === true) times = moment.online.toss;
      else if (first !== undefined) {
        times = tossed.get(seed);
        if (times === undefined && picking) {
          times = offlineToss(deviceNow());
          tossed.set(seed, times);
        }
      }
      const stage = toss.show(
        first === undefined || times === undefined
          ? undefined
          : {
              first,
              key: String(seed),
              seats: moment.seats ?? BOT_SEATS,
              times,
              now: moment.online?.now ?? deviceNow,
            },
      );
      return stage !== undefined && stage !== 'done';
    },
  };
}
