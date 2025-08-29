import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default defineConfig([
  globalIgnores(['**/*.dev.*', '**/dist', '**/*.config.*']),
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: compat.extends('eslint:recommended'),
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        $: 'readonly',
        mw: 'readonly',
        ssi_modal: 'readonly',
        InPageEdit: 'readonly',
      },
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // TypeScript 支持
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: await import('@typescript-eslint/parser'),
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': await import('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      ...compat.extends('plugin:@typescript-eslint/recommended').rules,
    },
  },
])
