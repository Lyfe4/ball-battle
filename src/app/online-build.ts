// Whether this build has online play at all (ADR 0052, section 6): on in deploy previews, the main
// branch deploy and `netlify dev`; off in production until the launch checklist is done. Vite
// writes the value in at build time, so in a production build every `if (ONLINE_BUILD)` branch is
// dead code and is left out of the bundle (`scripts/check-bundle.ts` makes sure).
export const ONLINE_BUILD: boolean = import.meta.env.VITE_ONLINE === '1';
