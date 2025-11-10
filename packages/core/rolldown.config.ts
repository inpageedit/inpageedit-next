import { defineConfig, OutputChunk } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import AutoImport from 'unplugin-auto-import/rolldown'

// https://rolldown.rs/options/input
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
      name: 'shamefully-fix-dts-index',
      async generateBundle(_, bundle) {
        console.info(bundle)
        const dts = Object.values(bundle).find(
          (v) => v.type === 'chunk' && v.fileName === 'index.d.ts'
        ) as OutputChunk
        if (!dts) return
        dts.code = dts.code.replace(
          /declare\s+module\s+(['"][@\.]\/.+?['"])\s*\{/g,
          // prettier-ignore
          [
            '//              ↓ $1',
            "declare module '.' {"
          ].join('\n')
        )
      },
    },
  ],
  resolve: {
    alias: {
      '@': './src',
    },
  },

  // 忽略 css 文件，因为我们只需要暴露 JS API，样式啥的不重要
  external: [/\.scss$/, /\.css$/],
  output: { dir: 'dist', format: 'es', cleanDir: false },
})
