/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * "1" in builds with online play (deploy previews, the main branch deploy, `netlify dev`); unset
   * in production until launch (ADR 0052 section 6, `src/app/online-build.ts`).
   */
  readonly VITE_ONLINE?: string;
}
