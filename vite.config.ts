import { defineConfig } from 'vite'
import { version } from './package.json'
import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import dts from 'unplugin-dts/vite'

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      name: 'InPageEditBundle',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * 我们需要在 library 模式下保留 dynamic import 分片，
         * 以优化首屏加载速度。
         */
        inlineDynamicImports: false,
      },
    },
  },
  plugins: [
    AutoImport({
      dirs: ['./src/components/**', './src/constants', './src/utils', './src/polyfills'],
      imports: [
        {
          from: '@/plugins/BasePlugin',
          imports: [['default', 'BasePlugin']],
        },
      ],
      dts: './src/auto-imports.d.ts',
      dtsMode: 'overwrite',
    }),
    // FIXME: Unsupported export "Logger": reggol@1.7.1
    // dts({
    //   tsconfigPath: './tsconfig.app.json',
    //   bundleTypes: true,
    //   entryRoot: './src',
    //   exclude: ['reggol'],
    // }),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.__VERSION__': JSON.stringify(
      isDev
        ? version
        : `${version}-dev.${new Date().toISOString().split('T')[0].replaceAll('-', '')}`
    ),
  },
  optimizeDeps: {
    include: ['cordis'],
  },
  mode: process.env.NODE_ENV,
  server: {
    host: true,
    port: 1005,
  },
  preview: {
    host: true,
    port: 1225,
    cors: true,
  },
})
