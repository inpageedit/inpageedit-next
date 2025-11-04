import { defineBuildConfig } from 'unbuild'
import { version } from './package.json'

export default defineBuildConfig({
  sourcemap: true,
  declaration: true,
  clean: true,
  replace: {
    'import.meta.env.__VERSION__': JSON.stringify(version),
  },
})
