/**
 * @typedef {import('../../src').InPageEdit} InPageEdit
 */

mw.hook('InPageEdit.ready').add(
  /** @param {InPageEdit} ipe */
  (ipe) => {
    ipe.plugin({
      name: 'my-plugin',
      // Specify any services your plugin needs
      // This will ensure the services are available in the plugin context
      // e.g. inject: ['toolbox', 'modal'],
      inject: [],
      apply(ctx) {
        // Add your plugin code here
      },
    })
  }
)
