import { defineConfig, UserConfig } from 'vite'
import { version } from './package.json'
import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'

const DEV = process.env.NODE_ENV === 'development'
const BUILD_FORMAT = process.env.VITE_BUILD_FORMAT || 'import'

export default defineConfig(() => {
  const config: UserConfig = {
    plugins: [],
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
    optimizeDeps: {},
    mode: process.env.NODE_ENV,
  }

  switch (BUILD_FORMAT) {
    case 'import': {
      config.build = {
        target: 'es2022',
        lib: {
          entry: {
            index: './src/index.ts',
          },
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
        ...config.plugins!,
        dts({
          tsconfigPath: './tsconfig.app.json',
          entryRoot: './src',
          bundleTypes: true,
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
          name: 'LoggerSaikou',
          formats: ['umd', 'cjs', 'iife'],
          fileName(format) {
            return format === 'cjs' ? 'index.cjs' : `index.${format}.cjs`
          },
          cssFileName: 'style',
        },
        rollupOptions: {
          output: {
            globals: {
              vue: 'Vue',
            },
          },
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
