import { JSX } from 'jsx-dom/jsx-runtime'
import loaderTemplate from './loader.template.js?raw'

const entryURL = new URL(import.meta.env.DEV ? '/src/index.ts' : '/index.js', location.href)
const root = document.getElementById('app')!

main()

function main() {
  root.innerText = ''
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
        <pre id="loader">...</pre>
        <CopyButton
          value={() => document.getElementById('loader')!.innerText}
          style={{ position: 'absolute', right: '1rem', top: '1rem' }}
        />
      </div>
      <h2>Entrypoint Source</h2>
      <details>
        <summary>{entryURL.href}</summary>
        <pre id="code"></pre>
      </details>
    </>
  )

  fetch(`${entryURL}?raw`, { headers: { accept: 'text/plaintext' } })
    .then((i) => i.text())
    .then((i) => (document.getElementById('code')!.innerText = i))

  document.getElementById('loader')!.innerText = getLoaderString(entryURL)

  function getLoaderString(entryURL: URL) {
    return loaderTemplate.replaceAll('__ENTRY_URL__', entryURL.href)
  }
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
