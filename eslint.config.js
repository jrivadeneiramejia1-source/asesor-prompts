// Revisión del código con ESLint (npm run lint).
import js from '@eslint/js';
import globals from 'globals';

const reglas = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-control-regex': 'off'
};

export default [
  { ignores: ['node_modules/**', 'capturas/**', '.lighthouseci/**'] },
  js.configs.recommended,
  { files: ['js/tema.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser } }, rules: reglas },
  { files: ['js/*.js'], ignores: ['js/tema.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } }, rules: reglas },
  { files: ['sw.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.serviceworker } }, rules: reglas },
  { files: ['lighthouserc.cjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } }, rules: reglas },
  { files: ['pruebas/**/*.mjs', 'eslint.config.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser, axe: 'readonly' } }, rules: { ...reglas, 'no-unused-vars': 'off' } }
];
