import loaderTemplateRaw from './loader.template.js?raw'
// @ts-ignore
import { codeToHtml } from 'https://esm.run/shiki@3.13.0'
import { CopyButton } from './components/CopyButton'
import { InPageEdit } from '@/InPageEdit.js'
import { createMockIPE } from './__mock__/createMockIPE'
import '@/styles/index.scss'

const ENTRY_URL = new URL(import.meta.env.DEV ? '/src/index.ts' : '/index.js', location.href)
const LOADER_TEMPLATE = loaderTemplateRaw.replaceAll('__ENTRY_URL__', ENTRY_URL.href)

main()

function main() {
  const root = document.getElementById('app')!
  root.innerText = ''

  let loaderRef: HTMLElement
  let codeRef: HTMLElement
  root.append(
    <>
      <h1>InPageEdit NEXT</h1>
      <h2>Entrypoint</h2>
      <section className="card">
        <a href={ENTRY_URL.toString()}>{ENTRY_URL.toString()}</a>{' '}
        <CopyButton value={ENTRY_URL.toString()} />
      </section>
      <h2>Loader</h2>
      <section className="card">
        <div style={{ position: 'relative' }}>
          <div ref={(ref) => (loaderRef = ref)}>Loading...</div>
          <CopyButton
            value={() => loaderRef.innerText}
            style={{ position: 'absolute', right: '1rem', top: '1rem' }}
          />
        </div>
      </section>
      <h2>Entrypoint Source Code</h2>
      <section>
        <details>
          <summary>{ENTRY_URL.href}</summary>
          <div ref={(ref) => (codeRef = ref)}>Loading...</div>
        </details>
      </section>
    </>
  )

  fetch(ENTRY_URL, { headers: { accept: 'text/plaintext' } })
    .then((res) => res.text())
    .then((text) =>
      codeToHtml(text, {
        lang: 'js',
        theme: 'one-dark-pro',
      })
    )
    .then((code) => (codeRef.innerHTML = code))

  codeToHtml(LOADER_TEMPLATE, {
    lang: 'js',
    theme: 'one-dark-pro',
  }).then((code: string) => (loaderRef.innerHTML = code))

  // Boot mock InPageEdit instance
  bootMockIPE()
}

function bootMockIPE() {
  const ipe = createMockIPE(InPageEdit)

  ipe.on('quick-edit/edit-notice', ({ editNotices }) => {
    const notice = document.createElement('div')
    notice.innerHTML =
      "This is a simulated interface. Feel free to click the Save button -- it won't break anything."
    notice.style.cssText =
      'background: #f0f0f0; border-radius: 0.5em; margin-bottom: 1em; color: #333; border-left: 6px solid #007bff; padding: 0.5em; padding-left: 1.5em; font-size: 14px;'
    editNotices.unshift(notice)
  })

  // Dispose analytics plugin to prevent sending data in dev
  ipe.inject(['analytics', 'storage'], async (ctx) => {
    await ctx.storage.simpleKV.set('analytics/confirm-shown', 1)
    ctx.analytics.ctx.scope.dispose()
  })

  ipe.start().then(() => {
    ipe
      .logger('DEV')
      .info(
        '\n' +
          '    ____      ____                   ______    ___ __ \n' +
          '   /  _/___  / __ \\____ _____ ____  / ____/___/ (_) /_\n' +
          '   / // __ \\/ /_/ / __ `/ __ `/ _ \\/ __/ / __  / / __/\n' +
          ' _/ // / / / ____/ /_/ / /_/ /  __/ /___/ /_/ / / /_  \n' +
          '/___/_/ /_/_/    \\__,_/\\__, /\\___/_____/\\__,_/_/\\__/  \n' +
          '                      /____/                v' +
          ipe.version
      )
  })

  // Expose to console for debugging
  ;(window as any).ipe = ipe
}
