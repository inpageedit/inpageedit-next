function loadScript(src = '', attrs = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    for (const [key, value] of Object.entries(attrs)) {
      if (key && value !== undefined) {
        script.setAttribute(key, value)
      }
    }
    script.onload = () => resolve(script)
    script.onerror = (e) =>
      reject(new Error(`Failed to load script: ${src}`, { cause: e }))
    document.head.appendChild(script)
  })
}

loadScript('/*__ENTRY_URL__*/', { type: 'module', async: '' })
  .then(() => console.info('[InPageEdit] DEV MODE'))
  .catch(() =>
    loadScript('https://unpkg.com/mediawiki-inpageedit', { async: '' })
  )
