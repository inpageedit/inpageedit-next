export default {
  load: async () => {
    const { version: devVersion } = await import('../package.json', { assert: { type: 'json' } })
    const npmData: any = await fetch('https://registry.npmjs.com/@inpageedit/core').then((res) =>
      res.json()
    )
    return {
      devVersion,
      npmVersion: npmData['dist-tags'].latest,
    }
  },
}
