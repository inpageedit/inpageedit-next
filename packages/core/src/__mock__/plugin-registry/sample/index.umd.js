'use strict'

function InPageEditPluginSample(ctx) {
  console.info('umd-plugin', ctx)
  ctx.on('dispose', () => {
    console.info('dispose umd-plugin')
  })
}

window.InPageEditPluginSample = InPageEditPluginSample
