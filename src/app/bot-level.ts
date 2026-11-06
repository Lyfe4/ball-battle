// The bot level a player last chose (ADR 0035), remembered on their device so the rules step opens
// on it. Storage can be missing or throw (private windows, blocked site data), and that only ever
// means the default level, like the remembered speed (speed.ts).
import { BOT_LEVELS, DEFAULT_BOT } from '../sim/bot.ts';

/** The browser storage key the choice is remembered under. */
export const BOT_LEVEL_STORAGE_KEY = 'ballbattle.botLevel';

/** A level's id, if `raw` names one a player can choose; else the default. */
export function parseBotLevel(raw: string | null | undefined): string {
  const id = raw?.trim().toLowerCase();
  return BOT_LEVELS.find((bot) => bot.id === id)?.id ?? DEFAULT_BOT.id;
}

/** The remembered level. Takes a getter because merely reading `localStorage` can throw. */
export function loadBotLevel(storage: () => Pick<Storage, 'getItem'>): string {
  try {
    return parseBotLevel(storage().getItem(BOT_LEVEL_STORAGE_KEY));
  } catch {
    return DEFAULT_BOT.id;
  }
}

/** Remembers the level, if storage allows; failing to is not an error. */
export function saveBotLevel(storage: () => Pick<Storage, 'setItem'>, level: string): void {
  try {
    storage().setItem(BOT_LEVEL_STORAGE_KEY, level);
  } catch {
    // Not remembered this time; the choice still holds for this visit.
  }
}
