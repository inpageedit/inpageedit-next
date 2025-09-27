import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export default {
  load: async () => {
    const { version: devVersion } = await readFile(
      resolve(import.meta.dirname, '../packages/core/package.json'),
      'utf-8'
    ).then((res) => JSON.parse(res))
    const npmData: any = await fetch('https://registry.npmjs.com/@inpageedit/core').then((res) =>
      res.json()
    )
    return {
      devVersion,
      npmVersion: npmData['dist-tags'].latest,
    }
  },
}
