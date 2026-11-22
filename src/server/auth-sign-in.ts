// Supabase Auth's sign-in calls (ADR 0079), from the functions only. Each is made with the secret
// key and the player's own IP in `Sb-Forwarded-For`, so Auth's per-IP limits (code checks,
// sign-ins) count the player, not our functions' shared address (ADR 0068). Tried against Auth
// v2.197.0 (the local stack): a guest's email change keeps its user id and makes it permanent
// once verified; an address that already has an account is `422 email_exists`; a wrong or expired
// code is `403 otp_expired`; `/otp` with `create_user:false` for an unknown address is
// `422 otp_disabled`.
import { AUTH_TIMEOUT_MS, fetchAuth, refusalOf, tokenCall, type AuthSession } from './auth.ts';
import type { Config } from './config.ts';

function headersOf(
  config: Config,
  ip: string | undefined,
  bearer?: string,
): Record<string, string> {
  return {
    apikey: config.supabaseSecretKey,
    ...(ip === undefined ? {} : { 'Sb-Forwarded-For': ip }),
    ...(bearer === undefined ? {} : { Authorization: `Bearer ${bearer}` }),
  };
}

/**
 * Asks Auth to send a code for adding `email` to the guest whose access token this is (an email
 * change). `taken` when the address already has an account: nothing was sent.
 */
export async function requestEmailChange(
  config: Config,
  ip: string | undefined,
  access: string,
  email: string,
): Promise<'sent' | 'taken'> {
  const response = await fetchAuth(`${config.supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headersOf(config, ip, access) },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
  if (response.ok) return 'sent';
  const refusal = await refusalOf(response, `An email change answered ${String(response.status)}`);
  if (refusal.code === 'email_exists') return 'taken';
  throw refusal;
}

/**
 * Asks Auth to send a sign-in code to `email`: to its account, or (with `create`) to a new one,
 * made once the code is checked.
 */
export async function sendSignInCode(
  config: Config,
  ip: string | undefined,
  email: string,
  create: boolean,
): Promise<void> {
  const response = await fetchAuth(`${config.supabaseUrl}/auth/v1/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headersOf(config, ip) },
    body: JSON.stringify({ email, create_user: create }),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw await refusalOf(response, `Sending a code answered ${String(response.status)}`);
  }
}

/**
 * Checks a code: `email_change` for a guest's new address (the guest's session, same id), `email`
 * for a sign-in code (that account's session).
 */
export function verifyCode(
  config: Config,
  ip: string | undefined,
  type: 'email_change' | 'email',
  email: string,
  token: string,
): Promise<AuthSession> {
  return tokenCall(config, 'verify', { type, email, token }, headersOf(config, ip));
}

/** What Google's token endpoint gave for one sign-in; it never leaves the function. */
export interface GoogleTokens {
  readonly idToken: string;
  readonly accessToken: string;
}

/**
 * A session for Google's ID token: the guest's own (`link`, its access token) with Google added,
 * or the account it belongs to (made if new). Auth checks the token's signature, audience and
 * nonce (the raw nonce, which the token carries hashed). Google's access token goes too: Auth
 * checks it against the ID token's `at_hash`, and says a later version will require it.
 */
export function idTokenSession(
  config: Config,
  ip: string | undefined,
  google: GoogleTokens,
  nonce: string,
  link?: string,
): Promise<AuthSession> {
  return tokenCall(
    config,
    'token?grant_type=id_token',
    {
      provider: 'google',
      id_token: google.idToken,
      access_token: google.accessToken,
      nonce,
      ...(link === undefined ? {} : { link_identity: true }),
    },
    headersOf(config, ip, link),
  );
}
