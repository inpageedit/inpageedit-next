import loaderTemplateRaw from './loader.template.js?raw'
// @ts-ignore
import { codeToHtml } from 'https://esm.run/shiki@3.13.0'
import { CopyButton } from './components/CopyButton'

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
}
