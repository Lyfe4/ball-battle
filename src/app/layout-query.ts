/**
 * The beside layout's media query (ADR 0067): any landscape screen, a phone turned sideways
 * included. The one script copy of the stylesheets' query, for the rare behaviour that differs
 * there (where focus scrolls to); layout-queries.test.ts holds it to the CSS.
 */
export const BESIDE_LAYOUT = '(min-aspect-ratio: 5/4)';
