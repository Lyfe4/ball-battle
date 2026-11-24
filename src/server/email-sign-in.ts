// Signing in with an email code (ADR 0079). Sending always answers the same "We sent a code",
// whether or not the address has an account; which path it took lives in a sealed cookie:
// - `link`: a guest's email change; the code makes the guest an account, same user id.
// - `existing`: the address already has an account (Auth's `email_exists`), so the code is a
//   sign-in to it, offered as "Switch to it?" once checked. Only then does the player learn it.
// - `signin`: a device without a guest, after the 16+ question; the code signs in or makes one.
// Every code is counted before Auth is asked (rate-limit.ts): per address, guest and network, then
// everyone's caps under Resend Free's, which answer `email_busy` alike for every player.
import { decodeSendCode, decodeVerifyCode, type SignInResponse } from '../api/accounts.ts';
import { AuthError, type AuthSession } from './auth.ts';
import { expectAuth, newTicket } from './auth-tickets.ts';
import { requestEmailChange, sendSignInCode, verifyCode } from './auth-sign-in.ts';
import { jsonBody } from './guard.ts';
import { ApiError, type RouteContext } from './http.ts';
import { report } from './monitor.ts';
import {
  EMAIL_BUSY,
  emailSubject,
  EVERYONE,
  ipSubject,
  LIMITS,
  spendAll,
  type Limit,
} from './rate-limit.ts';
import { clearedCookie, openCookie, sealCookie } from './sealed-cookie.ts';
import {
  checkNotLiveNow,
  EMAIL_COOKIE,
  holdPending,
  signInAs,
  signInNewDevice,
  signInPlayer,
  whileNotLive,
} from './sign-in.ts';

type Path = 'link' | 'existing' | 'signin';

/** A sending failure as the player reads it; Auth's own trouble is reported. */
async function sendFailure(error: unknown, context: RouteContext): Promise<never> {
  if (!(error instanceof AuthError)) throw error;
  if (error.status === 400 || error.status === 422) {
    throw new ApiError(400, 'bad_email', 'We can’t send to that address: check it and try again');
  }
  // Auth's own email limit, Resend refusing, or Auth out of reach: the same words as our caps.
  await report(error, { route: 'auth.email', requestId: context.requestId });
  throw new ApiError(503, 'email_busy', EMAIL_BUSY, { 'Retry-After': '3600' });
}

/** POST /api/v1/auth/email. */
export async function sendCode(request: Request, context: RouteContext): Promise<void> {
  const { config, sql } = context.deps;
  const body = decodeSendCode(await jsonBody(request));
  if (body === undefined) {
    throw new ApiError(400, 'bad_email', 'That email address doesn’t look right');
  }
  if (!config.emailCodes) {
    throw new ApiError(503, 'email_busy', 'Email codes are off for now: continue with Google');
  }
  const guest = await signInPlayer(request, context);
  if (guest === undefined && body.adult !== true) {
    throw new ApiError(400, 'age_unconfirmed', 'Online play is for players 16 and over');
  }
  if (guest !== undefined) await checkNotLiveNow(context.deps, [guest.userId]);

  // The player's own limits first: a refused one never spends everyone's.
  const address = await emailSubject(config, body.email);
  const network = context.ip === undefined ? undefined : await ipSubject(config, context.ip);
  const own: { subject: string; limit: Limit }[] = [
    { subject: address, limit: LIMITS.codesToAddress },
    { subject: address, limit: LIMITS.codesToAddressDaily },
  ];
  if (guest !== undefined) own.push({ subject: guest.userId, limit: LIMITS.codesByGuest });
  if (network !== undefined) {
    own.push({ subject: network, limit: LIMITS.codesFromNetwork });
    own.push({ subject: network, limit: LIMITS.codesFromNetworkDaily });
  }
  await spendAll(sql, own);
  await spendAll(sql, [
    { subject: EVERYONE, limit: LIMITS.codesDaily },
    { subject: EVERYONE, limit: LIMITS.codesMonthly },
  ]);

  // Auth's hooks send only what we expect (ADR 0082): one email to this address, and for a device
  // without a guest, perhaps a new user. A guest's refused email change sends nothing, so the
  // one email ticket is still there for the sign-in code that follows it.
  const signUp = guest === undefined ? newTicket() : undefined;
  await expectAuth(sql, { email: body.email, ...(signUp === undefined ? {} : { signUp }) });
  let path: Path = 'signin';
  try {
    if (guest === undefined) {
      await sendSignInCode(config, context.ip, body.email, signUp);
    } else {
      const change = await requestEmailChange(config, context.ip, guest.tokens.access, body.email);
      path = change === 'sent' ? 'link' : 'existing';
      if (path === 'existing') await sendSignInCode(config, context.ip, body.email, undefined);
    }
  } catch (error) {
    await sendFailure(error, context);
  }
  context.setCookie(
    await sealCookie(config, EMAIL_COOKIE, {
      e: body.email,
      p: path,
      g: guest?.userId ?? null,
      n: crypto.randomUUID(),
    }),
  );
}

interface Sent {
  readonly email: string;
  readonly path: Path;
  readonly guestId: string | null;
  /** This code's own id: its tries are counted apart from the address's. */
  readonly id: string;
}

async function sentOf(request: Request, context: RouteContext): Promise<Sent | undefined> {
  const sealed = await openCookie(context.deps.config, request, EMAIL_COOKIE);
  if (sealed === undefined) return undefined;
  const { e, p, g, n } = sealed;
  if (typeof e !== 'string' || typeof n !== 'string') return undefined;
  if (p !== 'link' && p !== 'existing' && p !== 'signin') return undefined;
  if (g !== null && typeof g !== 'string') return undefined;
  return { email: e, path: p, guestId: g, id: n };
}

const expired = (context: RouteContext): ApiError => {
  context.setCookie(clearedCookie(EMAIL_COOKIE));
  return new ApiError(400, 'sign_in_expired', 'That code has expired: send a new one');
};

/** Auth refused the code: wrong, or past its 10 minutes. */
function wrongCode(error: unknown): never {
  if (error instanceof AuthError && (error.status === 400 || error.status === 403)) {
    throw new ApiError(400, 'wrong_code', 'That code is wrong or has expired');
  }
  throw error;
}

/** POST /api/v1/auth/email/verify: signed in, or an existing account to switch to. */
export async function verifySentCode(
  request: Request,
  context: RouteContext,
): Promise<SignInResponse> {
  const { config, sql } = context.deps;
  const body = decodeVerifyCode(await jsonBody(request));
  if (body === undefined) {
    throw new ApiError(400, 'wrong_code', 'Type the 6 digits from the email');
  }
  const sent = await sentOf(request, context);
  if (sent === undefined) throw expired(context);
  const guest = await signInPlayer(request, context);
  // The code was sent for this device as it was then: the same guest, or still none.
  if ((guest?.userId ?? null) !== sent.guestId) throw expired(context);

  const address = await emailSubject(config, sent.email);
  const tries: { subject: string; limit: Limit }[] = [
    { subject: `${address}:${sent.id}`, limit: LIMITS.triesAtCode },
    { subject: address, limit: LIMITS.triesAtAddress },
  ];
  if (context.ip !== undefined) {
    tries.push({ subject: await ipSubject(config, context.ip), limit: LIMITS.triesFromNetwork });
  }
  await spendAll(sql, tries).catch((error: unknown) => {
    // A code tried too often is dead: a new one is needed.
    if (error instanceof ApiError && error.code === 'wrong_code') {
      context.setCookie(clearedCookie(EMAIL_COOKIE));
    }
    throw error;
  });

  const check = (): Promise<AuthSession> =>
    verifyCode(
      config,
      context.ip,
      sent.path === 'link' ? 'email_change' : 'email',
      sent.email,
      body.code,
    ).catch(wrongCode);

  if (guest === undefined) {
    await signInNewDevice(context.deps, context, await check());
    context.setCookie(clearedCookie(EMAIL_COOKIE));
    return { outcome: 'signed_in' };
  }
  const outcome = await whileNotLive(context.deps, [guest.userId], async (db) => {
    const session = await check();
    if (sent.path === 'existing') {
      await holdPending(context, guest.userId, session);
      return 'switch' as const;
    }
    // An email change keeps the guest's own id (ADR 0079): anything else is not this guest.
    if (session.userId !== guest.userId) throw new Error('An email change answered another user');
    await signInAs(db, context, session);
    return 'signed_in' as const;
  });
  context.setCookie(clearedCookie(EMAIL_COOKIE));
  return { outcome };
}
