/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * "1" in builds with online play (deploy previews, the main branch deploy, `netlify dev`); unset
   * in production until launch (ADR 0052 section 6, `src/app/online-build.ts`).
   */
  readonly VITE_ONLINE?: string;
  readonly VITE_ACCOUNTS?: string;
  /** "1" in builds with the Realtime poke (ADR 0082): local and tests only, for now. */
  readonly VITE_POKE?: string;
  /** "1" in builds offering play by turns (ADR 0085): previews and staging, never production. */
  readonly VITE_TURNS?: string;
}
