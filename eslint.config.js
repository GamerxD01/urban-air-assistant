import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-console': ['error', { allow: ['error', 'log'] }],
      'no-implicit-coercion': ['error', { allow: ['!!'] }],
      'no-shadow': 'error',
      'no-param-reassign': ['error', { props: false }],
      complexity: ['warn', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
