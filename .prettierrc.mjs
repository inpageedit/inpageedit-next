/**
 * @type {import('prettier').Options}
 * @see https://prettier.io/docs/en/options.html
 */
export default {
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  printWidth: 100,
  plugins: ['@prettier/plugin-pug'],
}
