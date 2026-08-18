/// <reference types='@inpageedit/core/services/SiteMetadataService' />
/// <reference types='@inpageedit/core/plugins/quick-edit/index' />
/// <reference types='@inpageedit/core/plugins/in-article-links/index' />

/**
 * IPE Plugin: Category Edit Links
 * This plugin adds a "Edit" link after each page entry in the category page.
 *
 * @author dragon-fish <dragon-fish@qq.com>
 * @license MIT
 */
mw.hook('InPageEdit.ready').add((ctx) => {
  ctx.plugin({
    name: 'category-edit-link',
    inject: ['sitemeta', 'quickEdit', 'inArticleLinks'],
    apply(ctx) {
      const ns = ctx.sitemeta.mwConfig.get('wgNamespaceNumber')
      if (ns !== 14) return
      const anchors = ctx.inArticleLinks.scanAnchors(document.querySelector('.mw-category'))
      anchors.forEach(({ $el, title }) => {
        const editLink = Object.assign(document.createElement('a'), {
          href: title.getURL({ action: 'edit' }).href,
          textContent: '编辑',
        })
        editLink.addEventListener('click', (e) => {
          e.preventDefault()
          ctx.quickEdit({
            title: title.getPrefixedDBKey(),
          })
        })
        const wrapper = document.createElement('span')
        wrapper.classList.add('in-page-edit-category-edit-link')
        wrapper.append(' (', editLink, ')')
        $el.after(wrapper)
      })
    },
  })
})
