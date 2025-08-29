/**
 * Plugin example
 * This is a simple plugin that adds a button to the toolbox.
 *
 * @typedef {import('../../src').InPageEdit} InPageEdit
 */

mw.hook('InPageEdit.ready').add(
  /** @param {InPageEdit} ipe */
  (ipe) => {
    /**
     * InPageEdit plugin can be registered in many ways
     * We will explore three different methods here.
     */

    // 1. Using a function
    // This is the simplest way to create a plugin
    ipe.plugin((ctx) => {
      ctx.inject(['toolbox', 'modal'], (ctx) => {
        ctx.toolbox.addButton({
          id: 'hello-world-function',
          icon: '❤️',
          tooltip: 'Click me',
          onClick: () => {
            alert('hello, function plugin')
          },
        })
      })
    })

    // 2. Using an object
    // This method is more structured and allows for easier configuration
    ipe.plugin({
      name: 'hello-world-object',
      inject: ['toolbox', 'modal'],
      apply: (ctx) => {
        ctx.toolbox.addButton({
          id: 'hello-world-object',
          icon: '💛',
          tooltip: 'Click me',
          onClick: () => {
            alert('hello, object plugin')
          },
        })
      },
    })

    // 3. Using a class
    // This is the most powerful method and allows for the most flexibility
    // For PRO TypeScript lovers :)
    ipe.plugin(
      class PluginHelloWorld {
        static inject = ['toolbox', 'modal']
        /**
         * @param {InPageEdit} ctx
         */
        constructor(ctx) {
          ctx.toolbox.addButton({
            id: 'hello-world-class',
            icon: '🩵',
            tooltip: 'Click me',
            onClick: () => {
              alert('hello, class plugin')
            },
          })
        }
      }
    )
  }
)
