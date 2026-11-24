// The local Realtime socket under `netlify dev`'s CSP, for the online flows only (ADR 0082, PR 5).
// `netlify dev` serves netlify.toml's headers, whose connect-src names only the hosted projects'
// Realtime (it must never name a local address: `security-headers.test.ts`). The flows' phones
// therefore have each page's policy rewritten on its way in, adding only the local stack's
// Realtime to connect-src: the same policy `pnpm preview` serves (`LOCAL_SECURITY_HEADERS`, which
// that test checks this equals). Nothing outside a test ever sees it.

/** The local stack's Realtime socket (`supabase start`). */
export const LOCAL_REALTIME_ORIGIN = 'ws://127.0.0.1:54321';

/** `policy` with the local Realtime added to its connect-src; any other policy is refused. */
export function withLocalRealtime(policy: string): string {
  const directives = policy.split(';').map((part) => part.trim());
  const connect = directives.findIndex((part) => part.startsWith('connect-src '));
  if (connect === -1) throw new Error(`No connect-src in the served policy: ${policy}`);
  if (directives[connect]?.includes(LOCAL_REALTIME_ORIGIN)) return policy;
  directives[connect] = `${directives[connect] ?? ''} ${LOCAL_REALTIME_ORIGIN}`;
  return directives.join('; ');
}
