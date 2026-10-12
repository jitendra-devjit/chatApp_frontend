import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // without the React plugin, names used only in JSX (<motion.div>, <Icon />) look unused
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|^motion$', argsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // a context file exports the context next to its provider
    files: ['src/context/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
