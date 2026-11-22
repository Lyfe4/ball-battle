// Whether this build has accounts (ADR 0079): sign-in with Google or an email code. Only with online
// play, and only where `VITE_ACCOUNTS` is 1 (deploy previews, the main branch deploy, `pnpm
// build:online`); production is built without it until accounts launch with friends. Vite writes
// the value in, so without it every `if (ACCOUNTS_BUILD)` branch is left out of the bundle
// (`scripts/check-bundle.ts` makes sure).
import { ONLINE_BUILD } from './online-build.ts';

export const ACCOUNTS_BUILD: boolean = ONLINE_BUILD && import.meta.env.VITE_ACCOUNTS === '1';
