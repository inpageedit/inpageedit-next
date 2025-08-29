/**
 * Plugin example
 * This is a simple plugin that adds a button to the toolbox.
 *
 * @typedef {import('../../src').InPageEdit} InPageEdit
 */

mw.hook('InPageEdit.ready').add(
  /** @param {InPageEdit} ipe */
  (ipe) => {
    ipe.plugin(
      class PluginHelloWorld {
        static inject = ['toolbox', 'modal']
        /**
         * @param {InPageEdit} ctx
         */
        constructor(ctx) {
          ctx.toolbox.addButton({
            id: 'hello-world',
            icon: '❤️',
            tooltip: 'Click me',
            onClick: () => {
              alert('hello, world')
            },
          })
        }
      }
    )
  }
)
