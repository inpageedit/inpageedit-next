'use strict'
;(window.RLQ ||= []).push(() => {
  mw.hook('InPageEdit.ready').add((ipe) => {
    ipe.plugin({
      name: 'autoload-plugin',
      inject: [],
      apply(ctx) {
        console.log('autoload-plugin', ctx)
      },
    })
  })
})
