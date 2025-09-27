mw.hook('InPageEdit.ready').add((ipe) => {
  ipe.plugin({
    name: 'wiki-editor',
    apply(ctx) {
      ctx.on('quickEdit/wikiPage', async (payload) => {
        const $textarea = payload.modal.get$content().find('textarea[name="text"]')
        const registered = !!mw.loader.getState('ext.wikiEditor')
        if (!$textarea.length || !registered) {
          return
        }
        await mw.loader.using(['ext.wikiEditor'])
        if (typeof window.mw?.addWikiEditor === 'function') {
          mw.addWikiEditor($textarea)
        }
      })
    },
  })

  ipe.plugin({
    name: 'code-mirror-v6',
    apply(ctx) {
      let cmweInitialized = false
      ctx.on('quickEdit/wikiPage', async (payload) => {
        const $textarea = payload.modal.get$content().find('textarea[name="text"]')
        const registered = !!mw.loader.getState('ext.CodeMirror.v6')
        if (!$textarea.length || !registered) {
          return
        }
        const require = await mw.loader.using([
          'ext.CodeMirror.v6',
          'ext.CodeMirror.v6.mode.mediawiki',
          'ext.CodeMirror.v6.WikiEditor',
        ])
        const CodeMirror = require('ext.CodeMirror.v6')
        const CodeMirrorWikiEditor = require('ext.CodeMirror.v6.WikiEditor')
        const mwLang = require('ext.CodeMirror.v6.mode.mediawiki')
        if (mw.loader.getState('ext.WikiEditor')) {
          if (cmweInitialized) {
            return
          }
          cmweInitialized = true
          mw.hook('wikiEditor.toolbarReady').add(($textarea) => {
            const cmWE = new CodeMirrorWikiEditor($textarea, mwLang({}))
            cmWE.addCodeMirrorToWikiEditor()
          })
        } else {
          const cm = new CodeMirror($textarea.get(0))
          cm.initialize([cm.defaultExtensions, mwLang({})])
        }
      })
    },
  })
})
