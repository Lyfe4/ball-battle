// Whether this build has the Realtime poke (ADR 0082): only with online play, and only where
// `VITE_POKE` is 1. Unset everywhere but local builds and tests until the owner says (previews,
// staging and production too). Vite writes the value in, so without it every `if (POKE_BUILD)`
// branch, and with it the socket, is left out of the bundle (`scripts/check-bundle.ts` makes sure).
import { ONLINE_BUILD } from './online-build.ts';

export const POKE_BUILD: boolean = ONLINE_BUILD && import.meta.env.VITE_POKE === '1';
