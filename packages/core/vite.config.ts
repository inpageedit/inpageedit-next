import { defineConfig, UserConfig } from 'vite'
import { version } from '../../package.json'
import { resolve } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import dts from 'unplugin-dts/vite'

const DEV = process.env.NODE_ENV === 'development'
const BUILD_FORMAT = process.env.VITE_BUILD_FORMAT || 'import'

export default defineConfig(() => {
  const config: UserConfig = {
    plugins: [
      Vue({
        // 定义 custom elements
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.includes('-'),
          },
        },
      }),
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
    ],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
      },
    },
    define: {
      'import.meta.env.__VERSION__': JSON.stringify(
        DEV
          ? `${version}-dev.${new Date().toISOString().split('T')[0].replaceAll('-', '')}`
          : version
      ),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    optimizeDeps: {
      // include: ['cordis'],
    },
    mode: process.env.NODE_ENV,
    server: {
      host: true,
      port: 1005,
    },
    preview: {
      host: true,
      port: 1005,
      cors: true,
    },
  }

  switch (BUILD_FORMAT) {
    case 'import': {
      config.build = {
        target: 'es2022',
        lib: {
          entry: {
            index: 'src/index.ts',
            'components/index': 'src/components/index.ts',
          },
          name: 'InPageEditBundle',
          formats: ['es'],
          fileName: (format, entryName) => {
            return `${entryName}.js`
          },
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
      }
      config.plugins = [
        ...config.plugins,
        dts({
          tsconfigPath: './tsconfig.app.json',
          entryRoot: './src',
          // TODO: 试了一下不好使
          // bundleTypes: true,
        }),
      ]
      break
    }
    case 'bundle': {
      config.build = {
        target: 'es2020',
        outDir: 'lib',
        emptyOutDir: true,
        sourcemap: true,
        lib: {
          entry: 'src/index.ts',
          name: 'InPageEditBundle',
          formats: ['umd'],
          fileName(format) {
            return `index.${format}.js`
          },
          cssFileName: 'style',
        },
      }
      break
    }
    default: {
      throw new Error(`Invalid build mode: ${BUILD_FORMAT}`)
    }
  }

  return config
})
