// Whether this build offers play by turns to a friend (ADR 0085): the two-phone playtest ADR 0083
// asks for before ranked builds on it. Only with online play, and only where `VITE_TURNS` is 1:
// deploy previews and the main branch deploy (staging), from netlify.toml; production's command
// blanks it, so it is never on there. Vite writes the value in, so without it the choice is left
// out of the bundle (`scripts/check-bundle.ts`, TURNS_MARK).
import { ONLINE_BUILD } from './online-build.ts';

export const TURNS_BUILD: boolean = ONLINE_BUILD && import.meta.env.VITE_TURNS === '1';
