const styles = `
  :root { color-scheme: light; background: #f5f3ec; color: #172820; font: 16px/1.5 Georgia, serif }
  * { box-sizing: border-box }
  body { margin: 0 }
  main { max-width: 56rem; margin: clamp(2rem, 8vw, 6rem) auto; padding: 0 1.35rem 3rem }
  header { border-top: 4px solid #215328; padding: 1.15rem 0 1.65rem }
  h1 { font-size: clamp(2rem, 7vw, 4rem); line-height: 1.08; margin: .35rem 0 }
  h2 { font-size: 1.3rem; margin: 0 0 .6rem }
  p, ol { margin: 0 0 1rem }
  ol { padding-left: 1.35rem }
  li + li { margin-top: .7rem }
  .label, label, small, button { font-family: ui-monospace, monospace }
  .label { letter-spacing: .075em; text-transform: uppercase; font-size: .8rem; color: #335341 }
  .layout { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); gap: clamp(1.4rem, 5vw, 3rem) }
  form { background: #fffefa; border: 1px solid #a7b0a1; padding: 1.3rem }
  aside { border-top: 1px solid #a7b0a1; padding-top: 1.1rem }
  label { display: block; font-size: .86rem; font-weight: 700 }
  input { display: block; width: 100%; min-height: 2.7rem; margin: .3rem 0 .95rem; border: 1px solid #8b9b8e;
    border-radius: 0; background: #fffefa; color: inherit; padding: .55rem; font: 1rem/1.4 ui-monospace, monospace }
  input[readonly] { background: #efefe7 }
  :focus-visible { outline: 2px solid #265d3c; outline-offset: 3px }
  button { width: 100%; min-height: 2.8rem; border: 1px solid #215328; background: #215328; color: #fff;
    font-size: .95rem; font-weight: 700; cursor: pointer }
  button:hover { background: #143b25 }
  small { display: block; margin-top: .85rem; color: #385044; font-size: .78rem }
  a { color: #215328; text-underline-offset: .2em }
  .error { color: #791d18; border-left: 3px solid; padding-left: .7rem }
  code { overflow-wrap: anywhere }
  @media (max-width: 43rem) { .layout { grid-template-columns: 1fr } }
`

function escapeHtml(value = '') {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]
  )
}

function guideLink(api) {
  const endpoint = URL.parse(api || '')
  if (
    endpoint &&
    ['https:', 'http:'].includes(endpoint.protocol) &&
    !endpoint.username &&
    !endpoint.password &&
    endpoint.pathname.endsWith('/api.php')
  ) {
    return new URL('./index.php?title=Special%3ABotPasswords', endpoint).href
  }
  return 'https://www.mediawiki.org/wiki/Manual:Bot_passwords'
}

export function loginPage({ name, api, loginName, locked, error, saved }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wiki login · InPageEdit CLI</title>
  <style>${styles}</style>
</head>
<body>
<main>
  <header>
    <div class="label">InPageEdit CLI</div>
    <h1>${saved ? 'Profile saved' : 'Connect a Wiki account'}</h1>
    <p>Profile <code>${escapeHtml(name)}</code>${saved ? ` is ready to use as <strong>${escapeHtml(saved.username)}</strong>. You can close this tab.` : '.'}</p>
  </header>
  ${
    saved
      ? ''
      : `
    <div class="layout">
      <form method="post" autocomplete="off">
        ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
        <label for="api">Action API URL</label>
        <input id="api" name="api" type="url" value="${escapeHtml(api)}" placeholder="https://wiki.example.org/w/api.php" required ${locked ? 'readonly' : ''}>
        <label for="loginName">Bot Password login name</label>
        <input id="loginName" name="loginName" value="${escapeHtml(loginName)}" placeholder="Username@Bot" required>
        <label for="password">Bot Password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" required>
        <button type="submit">Verify and save profile</button>
        <small>The password goes into your system credential store.</small>
      </form>
      <aside>
        <h2>Get a Bot Password</h2>
        <ol>
          <li>Sign in to your Wiki and open <a href="${escapeHtml(guideLink(api))}" target="_blank" rel="noopener noreferrer">Special:BotPasswords</a>.</li>
          <li>Create a Bot Password and select the permissions the CLI needs.</li>
          <li>Copy the generated login name and password into this form.</li>
        </ol>
      </aside>
    </div>`
  }
</main>
</body>
</html>`
}
