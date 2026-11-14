// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ADR = 'See docs/decisions/0001-deterministic-simulation.md.';

/** Math functions whose results are not guaranteed bit-identical across JS engines. */
const NON_DETERMINISTIC_MATH = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
];

/** Globals that are non-deterministic or belong to the browser, never the sim. */
const SIM_BANNED_GLOBALS = [
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'window',
  'document',
  'navigator',
  'crypto',
  'globalThis',
];

/** An import pattern that leaves src/sim from a file at that depth. */
function leavesSim(group) {
  return {
    group: [group],
    message: `src/sim must not import anything outside it: no app, UI, rendering or wiring. ${ADR}`,
  };
}

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Keeps files small enough to review; split a module before it grows past this.
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Plain JS config files are not part of any tsconfig, so skip type-aware rules.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/sim/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: `Use the seeded PRNG in src/sim/rng.ts. ${ADR}`,
        },
        ...NON_DETERMINISTIC_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Math.${property} is not guaranteed identical across engines. ${ADR}`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: `The ** operator has the same cross-engine latitude as Math.pow. ${ADR}`,
        },
        {
          selector: "AssignmentExpression[operator='**=']",
          message: `The **= operator has the same cross-engine latitude as Math.pow. ${ADR}`,
        },
      ],
      'no-restricted-globals': [
        'error',
        ...SIM_BANNED_GLOBALS.map((name) => ({
          name,
          message: `src/sim must be pure and deterministic. ${ADR}`,
        })),
      ],
    },
  },
  // Nothing outside src/sim may be imported by it: a server runs the sim on its own (ADR 0022), and
  // tsconfig.sim.json only catches an outside import that happens to use the DOM. Patterns match the
  // import text, so the ban counts the levels up to src/sim from each depth of folder.
  {
    files: ['src/sim/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [leavesSim('../**')] }] },
  },
  {
    files: ['src/sim/*/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [leavesSim('../../**')] }] },
  },
  prettier,
);
