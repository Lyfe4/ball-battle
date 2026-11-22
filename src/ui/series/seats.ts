// Who sits where in a series on screen (ADR 0052): the player's own side, and how to name the one
// across. Offline the player is always side A against the bot; online they may be either side,
// against a player with a name ("Player 4821") or one who was deleted. The series' rules never
// change with the seats: only which side the screens call "you", and the words for the other.
import type { Side } from '../../sim/series.ts';

export interface Seats {
  /** The player's side. */
  readonly you: Side;
  /** The other side's short label: "Bot", "Player 4821" (the track, the score line, the coin). */
  readonly them: string;
  /** The other side in a sentence: "the bot", "Player 4821". */
  readonly they: string;
  /** Theirs: "the bot’s", "Player 4821’s". */
  readonly their: string;
}

/** Every offline series: the player is side A, against the bot. */
export const BOT_SEATS: Seats = { you: 'a', them: 'Bot', they: 'the bot', their: 'the bot’s' };

/** An online series, seen from `you`, against a player (null: one who has been deleted). */
export function playerSeats(you: Side, opponent: string | null): Seats {
  const name = opponent ?? 'Deleted player';
  return { you, them: name, they: name, their: `${name}’s` };
}

export const otherSide = (side: Side): Side => (side === 'a' ? 'b' : 'a');

/** The side across from the player. */
export const theirSide = (seats: Seats): Side => otherSide(seats.you);

/**
 * The other side at the start of a sentence: "The bot plays…"; a player's name is kept as they
 * chose it, "sam_99 plays…" (ADR 0079).
 */
export const capital = (text: string): string =>
  text.startsWith('the ') ? `T${text.slice(1)}` : text;

/** "You" or the other side's label, for a side. */
export const labelOf = (seats: Seats, side: Side): string =>
  side === seats.you ? 'You' : seats.them;
