// /api/v1/auth/* (ADR 0079): signing in, only while accounts are switched on.
// - GET options: the ways in this deploy offers (Google only where its client is set up).
// - POST email {email, adult?}: always "We sent a code"; POST email/verify {code}.
// - GET google, GET google/callback: Google, through our own callback (a redirect each).
// - POST switch: take the existing account a code or Google found, deleting the guest (as Forget
//   me does; nothing is merged). DELETE switch: stay as the guest.
// None of them runs during a live match or lobby (`in_a_match`, sign-in.ts).
import type { AuthOptions, SignInResponse } from '../../api/accounts.ts';
import { signOut } from '../auth.ts';
import { deleteUser } from '../auth-admin.ts';
import { sendCode, verifySentCode } from '../email-sign-in.ts';
import { finishGoogle, startGoogle } from '../google-sign-in.ts';
import { guard } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import {
  clearPending,
  pendingOf,
  requireAccounts,
  signInAs,
  signInPlayer,
  whileNotLive,
} from '../sign-in.ts';

export const authOptions: RouteHandler = (request, context) => {
  requireAccounts(context);
  guard(request, ['GET']);
  const { config } = context.deps;
  const body: AuthOptions = { google: config.google !== undefined, emailCodes: config.emailCodes };
  return Promise.resolve(json(200, body));
};

export const authEmail: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['POST']);
  await sendCode(request, context);
  return json(202, { sent: true });
};

export const authEmailVerify: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['POST']);
  return json(200, await verifySentCode(request, context));
};

export const authGoogle: RouteHandler = (request, context) => {
  requireAccounts(context);
  guard(request, ['GET']);
  return startGoogle(request, context);
};

export const authGoogleCallback: RouteHandler = (request, context) => {
  requireAccounts(context);
  guard(request, ['GET']);
  return finishGoogle(request, context);
};

const nothingHeld = () =>
  new ApiError(400, 'sign_in_expired', 'That sign-in has expired: sign in again');

export const authSwitch: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['POST', 'DELETE']);
  const pending = await pendingOf(request, context);
  if (request.method === 'DELETE') {
    // Stay as the guest: the account's session waiting here is ended.
    if (pending !== undefined) await signOut(context.deps.config, pending.account.tokens.access);
    clearPending(context);
    return json(204, null);
  }
  const guest = await signInPlayer(request, context);
  if (pending === undefined || guest?.userId !== pending.guestId) {
    clearPending(context);
    throw nothingHeld();
  }
  // Neither the guest nor the account may be in a live match or lobby; the pending cookie stays
  // if one is, so the player can finish and switch within its 10 minutes.
  await whileNotLive(context.deps, [guest.userId, pending.account.userId], async (db) => {
    await deleteUser(context.deps.config, guest.userId);
    await signInAs(db, context, pending.account);
  });
  clearPending(context);
  const body: SignInResponse = { outcome: 'signed_in' };
  return json(200, body);
};
