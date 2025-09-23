/**
 * @param {string} src
 * @param {Record<string, string>?} attrs
 * @returns {Promise<HTMLScriptElement>}
 */
function loadScript(src, attrs = {}) {
  return new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src })
    Object.entries(attrs).forEach(([k, v]) => k && v !== void 0 && s.setAttribute(k, v))
    s.onload = () => res(s)
    s.onerror = (e) => rej(e)
    document.head.appendChild(s)
  })
}

loadScript('__ENTRY_URL__', { type: 'module', async: '' })
  .then(() => console.info('[InPageEdit] DEV MODE'))
  .catch(() => loadScript('https://unpkg.com/mediawiki-inpageedit', { async: '' }))
