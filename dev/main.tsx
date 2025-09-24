import { JSX } from 'jsx-dom/jsx-runtime'
import loaderTemplate from './loader.template.js?raw'
// @ts-ignore
import { codeToHtml } from 'https://esm.run/shiki@3.13.0'

const entryURL = new URL(import.meta.env.DEV ? '/src/index.ts' : '/index.js', location.href)

main()

function main() {
  const root = document.getElementById('app')!
  root.innerText = ''

  let loaderRef: HTMLElement, codeRef: HTMLElement
  root.append(
    <>
      <h1>InPageEdit NEXT</h1>
      <h2>Entrypoint</h2>
      <div>
        <a href={entryURL.toString()}>{entryURL.toString()}</a>{' '}
        <CopyButton value={entryURL.toString()} />
      </div>
      <h2>Loader</h2>
      <div style={{ position: 'relative' }}>
        <div ref={(ref) => (loaderRef = ref)}>...</div>
        <CopyButton
          value={() => document.getElementById('loader')!.innerText}
          style={{ position: 'absolute', right: '1rem', top: '1rem' }}
        />
      </div>
      <h2>Entrypoint Source</h2>
      <details>
        <summary>{entryURL.href}</summary>
        <div ref={(ref) => (codeRef = ref)}>...</div>
      </details>
    </>
  )

  fetch(entryURL, { headers: { accept: 'text/plaintext' } })
    .then((res) => res.text())
    .then((text) =>
      codeToHtml(text, {
        lang: 'js',
        theme: 'one-dark-pro',
      })
    )
    .then((code) => (codeRef.innerHTML = code))

  codeToHtml(getLoaderString(loaderTemplate, entryURL), {
    lang: 'js',
    theme: 'one-dark-pro',
  }).then((code: string) => (loaderRef.innerHTML = code))
}

function getLoaderString(templateString: string, entryURL: URL) {
  return templateString.replaceAll('__ENTRY_URL__', entryURL.href)
}

function copyText(str = '') {
  const t = document.createElement('textarea')
  t.value = str.toString()
  document.body.appendChild(t)
  t.select()
  document.execCommand('copy')
  t.remove()
}

function CopyButton(
  props: {
    value: string | (() => string) | undefined
  } & Omit<JSX.IntrinsicElements['button'], 'value'>
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const { value, ...rest } = props
  return (
    <button
      {...rest}
      onClick={(e) => {
        e.preventDefault()
        copyText(typeof value === 'function' ? value() : value?.toString())
        if (timer) {
          clearTimeout(timer)
        }
        ;(e.target as HTMLButtonElement).innerText = 'Copied'
        timer = setTimeout(() => {
          ;(e.target as HTMLButtonElement).innerText = 'Copy'
          timer = null
        }, 1500)
      }}
    >
      Copy
    </button>
  )
}
