// A stand-in Google for the database tests (ADR 0079): the consent screen, its token endpoint
// (which checks PKCE as Google does), and Supabase's ID-token grant, which can't check a token we
// signed ourselves. Every other request (Auth's keys, the rest of Auth) goes through for real.
import { vi } from 'vitest';
import { GOOGLE_TOKEN_URL } from '../google-sign-in.ts';
import type { SessionTokens } from '../cookie.ts';

const realFetch = globalThis.fetch.bind(globalThis);

interface Issued {
  readonly challenge: string | undefined;
  readonly nonce: string | undefined;
  used: boolean;
}

/** What the grant was asked, as Supabase would see it. */
export interface GrantCall {
  readonly body: Record<string, unknown>;
  readonly bearer: string | undefined;
}

export interface FakeGoogle {
  /** The player agrees at Google: the callback's path for the redirect `location` started. */
  consent(location: string, overrides?: { readonly nonce?: string }): string;
  /** Calls to Google's token endpoint. */
  readonly exchanges: number[];
  /** Calls to Supabase's ID-token grant. */
  readonly grants: GrantCall[];
  /** What the grant answers next: a session (as `{userId, tokens}`) or Auth's refusal. */
  answer(next: (call: GrantCall) => Response): void;
}

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sha256url = async (text: string) =>
  Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).toString(
    'base64url',
  );

/** Supabase's answer with a session. */
export const sessionAnswer = (userId: string, tokens: SessionTokens): Response =>
  Response.json({
    access_token: tokens.access,
    refresh_token: tokens.refresh,
    user: { id: userId },
  });

/** Supabase's refusal. */
export const refusalAnswer = (status: number, errorCode: string): Response =>
  Response.json({ code: status, error_code: errorCode, msg: errorCode }, { status });

export function fakeGoogle(): FakeGoogle {
  const issued = new Map<string, Issued>();
  const exchanges: number[] = [];
  const grants: GrantCall[] = [];
  let next: (call: GrantCall) => Response = () => refusalAnswer(500, 'unexpected_failure');

  async function token(body: URLSearchParams): Promise<Response> {
    exchanges.push(Date.now());
    const grant = issued.get(body.get('code') ?? '');
    if (grant === undefined || grant.used) return Response.json({}, { status: 400 });
    grant.used = true;
    // Google refuses a code whose challenge the verifier doesn't answer.
    if (grant.challenge !== undefined) {
      const verifier = body.get('code_verifier') ?? '';
      if ((await sha256url(verifier)) !== grant.challenge) {
        return Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
    }
    const idToken = [
      base64url({ alg: 'RS256' }),
      base64url({ sub: 'google-123', email: 'player@gmail.com', nonce: grant.nonce }),
      'signature',
    ].join('.');
    return Response.json({ id_token: idToken, access_token: 'google-access' });
  }

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === GOOGLE_TOKEN_URL) return token(new URLSearchParams(init?.body as string));
    if (url.includes('/auth/v1/token?grant_type=id_token')) {
      const headers = new Headers(init?.headers);
      const call: GrantCall = {
        body: JSON.parse(init?.body as string) as Record<string, unknown>,
        bearer: headers.get('Authorization')?.replace(/^Bearer /, ''),
      };
      grants.push(call);
      return next(call);
    }
    return realFetch(input, init);
  });

  return {
    consent(location, overrides = {}) {
      const at = new URL(location);
      const code = crypto.randomUUID();
      issued.set(code, {
        challenge: at.searchParams.get('code_challenge') ?? undefined,
        nonce: overrides.nonce ?? at.searchParams.get('nonce') ?? undefined,
        used: false,
      });
      const state = at.searchParams.get('state') ?? '';
      return `/api/v1/auth/google/callback?${new URLSearchParams({ code, state }).toString()}`;
    },
    exchanges,
    grants,
    answer(handler) {
      next = handler;
    },
  };
}

/** The tokens in a browser's session cookie. */
export function tokensOf(cookie: string): SessionTokens {
  const { a, r } = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8')) as {
    a: string;
    r: string;
  };
  return { access: a, refresh: r };
}
