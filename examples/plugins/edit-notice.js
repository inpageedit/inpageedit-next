/**
 * @typedef {import('../../src').InPageEdit} InPageEdit
 */

mw.hook('InPageEdit.ready').add(
  /** @param {InPageEdit} ipe */
  (ipe) => {
    ipe.plugin({
      name: 'edit-notice',
      inject: [],
      apply(ctx) {
        ctx.on('quickEdit/wikiPage', ({ modal, wikiPage }) => {
          const content = modal.get$content()
          content.before(
            $('<p>').text(`You are editting ${wikiPage.title}`).css({
              color: 'red',
              fontSize: '30px',
              fontWeight: 'bold',
            })
          )
        })
      },
    })
  }
)
