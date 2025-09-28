import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

export default {
  load: async () => {
    const { version } = await readFile(
      resolve(import.meta.dirname, '../packages/core/package.json'),
      'utf-8'
    ).then((res) => JSON.parse(res))
    const gitHash = execSync('git rev-parse --short HEAD').toString().trim()
    const gitTime = execSync('git log -1 --format=%cd --date=iso').toString().trim()
    return {
      version,
      gitHash,
      gitTime,
    }
  },
}
