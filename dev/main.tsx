import loaderTemplate from './loader.template.js?raw'

const entryURL = new URL(import.meta.env.DEV ? '/src/index.ts' : '/index.js', location.href)
const app = document.getElementById('app')!

app.innerText = ''
app.append(
  <>
    <h1>InPageEdit Next</h1>
    <h2>Entrypoint</h2>
    <div>
      <a href={entryURL.toString()}>{entryURL.toString()}</a>{' '}
      <button onClick={() => copyText(entryURL.toString())}>Copy</button>
    </div>
    <h2>Loader</h2>
    <div style={{ position: 'relative' }}>
      <pre id="loader">...</pre>
      <button
        onClick={() => copyText(document.getElementById('loader')!.innerText)}
        style={{ position: 'absolute', right: '1rem', top: '1rem' }}
      >
        Copy
      </button>
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
  return loaderTemplate.replaceAll('/*__ENTRY_URL__*/', entryURL.toString().replace(/['"]/g, ''))
}

function copyText(str = '') {
  const t = document.createElement('textarea')
  t.value = str.toString()
  document.body.appendChild(t)
  t.select()
  document.execCommand('copy')
  t.remove()
}
