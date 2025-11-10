// rolldown.config.ts
import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import { resolve } from 'node:path'

export default defineConfig({
  input: './src/index.ts',
  plugins: [dts({ sourcemap: false, tsconfig: 'tsconfig.app.json', vue: true, emitDtsOnly: true })],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  // 忽略 .scss/.css/.vue 文件，因为我们只需要暴露 JS API 即可，组件和样式不重要
  external: [/\.scss$/, /\.css$/, /\.vue$/],
  output: [{ dir: 'dist', format: 'es', cssEntryFileNames: 'style.css' }],
})
