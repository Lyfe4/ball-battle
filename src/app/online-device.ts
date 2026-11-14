// What this device remembers about online play (ADR 0052): only that it has a guest (so home asks
// for "Your turn" without touching the network for anyone who never played online), and how many
// rounds of each series it has watched. The guest itself lives in an HttpOnly cookie. Logout and
// "Forget me" clear every `ballbattle.*` key on the device (ADR 0051 item 5), offline settings and
// a saved series included, so nothing of the player is left behind.

const PREFIX = 'ballbattle.';
const GUEST = 'ballbattle.online.guest';
const WATCHED = 'ballbattle.online.watched';
/** Series remembered for watching; older entries are dropped first. */
const MOST_WATCHED = 30;

/** The device's storage, read through a getter as everywhere (merely reading it can throw). */
export type DeviceStorage = () => Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export const hasGuest = (storage: DeviceStorage): boolean =>
  safely(() => storage().getItem(GUEST) === '1', false);

export function rememberGuest(storage: DeviceStorage, has: boolean): void {
  safely(() => {
    if (has) storage().setItem(GUEST, '1');
    else storage().removeItem(GUEST);
  }, undefined);
}

type Watched = Record<string, number>;

function watchedMap(storage: DeviceStorage): Watched {
  return safely(() => {
    const parsed: unknown = JSON.parse(storage().getItem(WATCHED) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] >= 0,
      ),
    );
  }, {});
}

/** How many rounds of `series` this device has watched. */
export const watchedOf = (storage: DeviceStorage, series: string): number =>
  watchedMap(storage)[series] ?? 0;

export function rememberWatched(storage: DeviceStorage, series: string, rounds: number): void {
  // This series last, so the oldest are the ones dropped.
  const others = Object.entries(watchedMap(storage)).filter(([id]) => id !== series);
  const kept = [...others, [series, rounds] as const].slice(-MOST_WATCHED);
  safely(() => {
    storage().setItem(WATCHED, JSON.stringify(Object.fromEntries(kept)));
  }, undefined);
}

/** Removes every `ballbattle.*` key: logout and "Forget me". */
export function forgetDevice(storage: DeviceStorage): void {
  safely(() => {
    const store = storage();
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(PREFIX) === true) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  }, undefined);
}
