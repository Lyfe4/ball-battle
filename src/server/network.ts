// The network a client IP stands for, for guest creation's limit (rate-limit.ts), pure. An IPv4
// address is one network: a home, a school or a café behind one router, or many strangers behind a
// phone carrier's shared address. IPv6 gives every home and phone a whole /64 and lets it change the
// rest at will (privacy addresses change daily), so a full IPv6 address is no network at all: keyed
// on it, anyone with a /64 could make guests without limit. The /64 is the household or the phone.

/** The network `ip` belongs to: an IPv4 address as is, an IPv6 address as its /64. */
export function networkOf(ip: string): string {
  const address = ip.trim().replace(/%.*$/, '').toLowerCase();
  if (!address.includes(':')) return address;
  const groups = ipv6Groups(address);
  if (groups === undefined) return address;
  // An IPv4 address written as IPv6 (::ffff:203.0.113.7) is that IPv4 address.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const v4 = groups.slice(6).flatMap((group) => [group >> 8, group & 0xff]);
    return v4.join('.');
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}

/** The eight 16-bit groups of an IPv6 address, or undefined if it isn't one. */
function ipv6Groups(address: string): number[] | undefined {
  const halves = address.split('::');
  if (halves.length > 2) return undefined;
  const partsOf = (half: string | undefined): number[] | undefined => {
    if (half === undefined || half === '') return [];
    const out: number[] = [];
    for (const part of half.split(':')) {
      if (part.includes('.')) {
        const octets = part.split('.').map(Number);
        if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
          return undefined;
        }
        const [a = 0, b = 0, c = 0, d = 0] = octets;
        out.push(a * 256 + b, c * 256 + d);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return undefined;
        out.push(parseInt(part, 16));
      }
    }
    return out;
  };
  const head = partsOf(halves[0]);
  const tail = partsOf(halves[1]);
  if (head === undefined || tail === undefined) return undefined;
  if (halves.length === 1) return head.length === 8 ? head : undefined;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return undefined;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}
