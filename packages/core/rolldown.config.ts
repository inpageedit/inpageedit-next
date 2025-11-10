// rolldown.config.ts
import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import AutoImport from 'unplugin-auto-import/rolldown'

export default defineConfig({
  input: './src/index.ts',
  tsconfig: 'tsconfig.app.json',
  plugins: [
    AutoImport({
      dirs: [
        './src/components/**',
        './src/constants',
        './src/utils',
        './src/polyfills',
        './src/decorators',
      ],
      imports: [
        {
          from: '@/plugins/BasePlugin',
          imports: [['default', 'BasePlugin']],
        },
      ],
      dts: './src/auto-imports.d.ts',
      dtsMode: 'overwrite',
    }),
    dts({ sourcemap: false, tsconfig: 'tsconfig.app.json', vue: true, emitDtsOnly: true }),
    /**
     * FIXME:
     * This is a very dirty hack to fix the index.d.ts file.
     * @see https://github.com/sxzz/rolldown-plugin-dts/issues/134
     *
     * After the index.d.ts file is generated, we need to fix the index.d.ts file,
     * replace all `declare module '[@.]/.+?'` with `declare module '.'`
     */
    {
      name: 'shamfully-fix-dts-index',
      async writeBundle(options, bundle) {
        console.info('shamfully-fix-dts-index', options, bundle)
        const outDir = (options as any)?.dir || 'dist'
        const indexDtsPath = resolve(import.meta.dirname, outDir, 'index.d.ts')
        if (!(await stat(indexDtsPath)).isFile()) return
        const content = await readFile(indexDtsPath, 'utf-8')
        const replaced = content.replace(
          /declare\s+module\s+(['"][@\.]\/.+?['"])\s*\{/g,
          // prettier-ignore
          [
            '//              ↓ $1',
            "declare module '.' {"
          ].join('\n')
        )
        if (replaced !== content) {
          await writeFile(indexDtsPath, replaced, 'utf-8')
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': './src',
    },
  },
  // 忽略 .scss/.css/.vue 文件，因为我们只需要暴露 JS API 即可，组件和样式不重要
  external: [/\.scss$/, /\.css$/, /\.vue$/],
  output: [{ dir: 'dist', format: 'es', cssEntryFileNames: 'style.css' }],
})
