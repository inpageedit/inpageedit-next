export class PluginSample {
  constructor(ctx) {
    console.info('module-plugin', ctx)
    ctx.on('dispose', () => {
      console.info('dispose module-plugin')
    })
  }
}
