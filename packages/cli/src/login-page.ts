import { readFileSync } from 'node:fs'

// Inlined because the page's CSP allows no other origin and the server answers one path only.
const logo = `data:image/webp;base64,${readFileSync(new URL('../assets/logo.webp', import.meta.url)).toString('base64')}`

const styles = `
  :root {
    --blue: #1a6dff; --blue-deep: #0050d8; --blue-soft: #e8f1ff; --ink: #14254a; --muted: #5a6b8c;
    --line: #cddcf7; --error: #d6336c;
    color-scheme: light; color: var(--ink);
    font: 16px/1.6 ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "PingFang SC",
      "Microsoft YaHei", system-ui, sans-serif;
    background:
      radial-gradient(circle at 12% 18%, #ffd6e4 0 5rem, transparent 5.1rem),
      radial-gradient(circle at 88% 12%, #d4f4f7 0 6rem, transparent 6.1rem),
      radial-gradient(circle at 92% 88%, #ffe9b8 0 4.5rem, transparent 4.6rem),
      radial-gradient(#d3e3ff 1.5px, transparent 1.6px) 0 0 / 22px 22px,
      #f4f8ff;
    min-height: 100%;
  }
  * { box-sizing: border-box }
  body { margin: 0 }
  main { max-width: 34rem; margin: 0 auto; padding: clamp(1.5rem, 6vw, 3.5rem) 1.1rem 3rem }
  .logo { display: block; width: min(19rem, 78%); margin: 0 auto .3rem }
  .card {
    background: #fff; border: 2px solid var(--line); border-radius: 1.6rem;
    box-shadow: 0 6px 0 var(--line), 0 18px 40px -18px #1a6dff55; padding: clamp(1.2rem, 5vw, 2rem);
  }
  h1 { font-size: 1.55rem; line-height: 1.25; margin: 0 0 .3rem; text-align: center }
  .lead { text-align: center; color: var(--muted); margin: 0 0 1.4rem }
  .pill {
    display: inline-block; padding: .05rem .6rem; border-radius: 99px; background: var(--blue-soft);
    color: var(--blue-deep); font-weight: 700; font-family: ui-monospace, monospace; font-size: .9em;
  }
  label { display: block; font-weight: 700; font-size: .92rem; margin-bottom: .35rem }
  .field { margin-bottom: 1rem }
  input {
    display: block; width: 100%; min-height: 2.9rem; padding: .6rem .9rem; border: 2px solid var(--line);
    border-radius: .9rem; background: #fbfdff; color: inherit; font: 1rem/1.4 ui-monospace, monospace;
    transition: border-color .15s, box-shadow .15s;
  }
  input::placeholder { color: #9aabc8 }
  input:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 4px #1a6dff26 }
  input[readonly] { background: var(--blue-soft); color: var(--muted) }
  button {
    width: 100%; min-height: 3.1rem; margin-top: .4rem; border: 0; border-radius: 99px; cursor: pointer;
    background: var(--blue); color: #fff; font: inherit; font-size: 1.05rem; font-weight: 800;
    box-shadow: 0 5px 0 var(--blue-deep); transition: transform .08s, box-shadow .08s;
  }
  button:hover { background: #2a7aff }
  button:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--blue-deep) }
  button:focus-visible { outline: 3px solid #ffc94d; outline-offset: 3px }
  .note { text-align: center; color: var(--muted); font-size: .82rem; margin: .9rem 0 0 }
  .error {
    margin: 0 0 1.1rem; padding: .7rem .9rem; border-radius: .9rem; background: #fff0f5;
    color: var(--error); border: 2px solid #ffc9da; font-size: .92rem;
  }
  .guide { margin-top: 1.4rem }
  .guide h2 { font-size: 1.05rem; margin: 0 0 .8rem }
  .guide ol { list-style: none; margin: 0; padding: 0; counter-reset: step }
  .guide li { position: relative; padding-left: 2.4rem; margin-bottom: .75rem; counter-increment: step }
  .guide li::before {
    content: counter(step); position: absolute; left: 0; top: .05rem; width: 1.7rem; height: 1.7rem;
    border-radius: 50%; color: #fff; font-weight: 800; font-size: .9rem; display: grid; place-items: center;
  }
  .guide li:nth-child(1)::before { background: #e91e63 }
  .guide li:nth-child(2)::before { background: #ff5722 }
  .guide li:nth-child(3)::before { background: #00a6a6 }
  a { color: var(--blue-deep); font-weight: 700; text-underline-offset: .2em }
  code { overflow-wrap: anywhere }
  .done { text-align: center; padding-block: 2.2rem }
  .check {
    width: 4.2rem; height: 4.2rem; margin: 0 auto .9rem; border-radius: 50%; display: grid;
    place-items: center; background: #19b37d; color: #fff; font-size: 2.2rem; font-weight: 900;
    box-shadow: 0 5px 0 #0e8a5f;
  }
`

interface PageText {
  lang: string
  title: string
  heading: string
  lead: (name: string) => string
  api: string
  loginName: string
  password: string
  submit: string
  note: string
  guide: string
  steps: (link: string) => string[]
  savedHeading: string
  saved: (name: string, user: string) => string
}

export type Language = 'en' | 'zh'

const text: Record<Language, PageText> = {
  en: {
    lang: 'en',
    title: 'Wiki login · InPageEdit CLI',
    heading: 'Connect a Wiki account',
    lead: (name) => `Signing in profile ${name}`,
    api: 'Action API URL',
    loginName: 'Bot Password login name',
    password: 'Bot Password',
    submit: 'Verify and save',
    note: 'Your password is kept in the system credential store.',
    guide: 'Get a Bot Password',
    steps: (link) => [
      `Sign in to your Wiki and open ${link}.`,
      'Create a Bot Password and grant the permissions the CLI needs.',
      'Copy the generated login name and password into the form above.',
    ],
    savedHeading: 'All set!',
    saved: (name, user) => `Profile ${name} is ready as ${user}. You can close this tab.`,
  },
  zh: {
    lang: 'zh-CN',
    title: '登录 Wiki · InPageEdit CLI',
    heading: '连接 Wiki 账号',
    lead: (name) => `正在登录 profile ${name}`,
    api: 'Action API 地址',
    loginName: 'Bot Password 登录名',
    password: 'Bot Password',
    submit: '验证并保存',
    note: '密码只保存在本机系统的凭据库里。',
    guide: '如何获取 Bot Password',
    steps: (link) => [
      `登录你的 Wiki，打开 ${link}。`,
      '新建一个 Bot Password，勾选 CLI 需要用到的权限。',
      '把生成的登录名和密码填进上面的表单。',
    ],
    savedHeading: '搞定！',
    saved: (name, user) => `profile ${name} 已经以 ${user} 的身份就绪，可以关掉这个页面了。`,
  },
}

/** Picks the page language from the browser's Accept-Language header. */
export function pageLanguage(acceptLanguage = ''): Language {
  return /^\s*zh\b/i.test(acceptLanguage) ? 'zh' : 'en'
}

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
      })[character]!
  )
}

function guideLink(api?: string) {
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

export interface LoginPageState {
  name: string
  api?: string
  loginName?: string
  locked?: boolean
  error?: string
  saved?: { username: string }
  language?: Language
}

export function loginPage({
  name,
  api,
  loginName,
  locked,
  error,
  saved,
  language = 'en',
}: LoginPageState) {
  const t = text[language]
  const pill = (value: string) => `<span class="pill">${escapeHtml(value)}</span>`
  const link = `<a href="${escapeHtml(guideLink(api))}" target="_blank" rel="noopener noreferrer">Special:BotPasswords</a>`
  const body = saved
    ? `
    <section class="card done">
      <div class="check" aria-hidden="true">✓</div>
      <h1>${t.savedHeading}</h1>
      <p class="lead">${t.saved(pill(name), `<strong>${escapeHtml(saved.username)}</strong>`)}</p>
    </section>`
    : `
    <section class="card">
      <h1>${t.heading}</h1>
      <p class="lead">${t.lead(pill(name))}</p>
      <form method="post" autocomplete="off">
        ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
        <div class="field">
          <label for="api">${t.api}</label>
          <input id="api" name="api" type="url" value="${escapeHtml(api)}" placeholder="https://wiki.example.org/w/api.php" required ${locked ? 'readonly' : ''}>
        </div>
        <div class="field">
          <label for="loginName">${t.loginName}</label>
          <input id="loginName" name="loginName" value="${escapeHtml(loginName)}" placeholder="Username@Bot" required>
        </div>
        <div class="field">
          <label for="password">${t.password}</label>
          <input id="password" name="password" type="password" autocomplete="new-password" required>
        </div>
        <button type="submit">${t.submit}</button>
        <p class="note">🔒 ${t.note}</p>
      </form>
      <div class="guide">
        <h2>${t.guide}</h2>
        <ol>${t
          .steps(link)
          .map((step) => `<li>${step}</li>`)
          .join('')}</ol>
      </div>
    </section>`
  return `<!doctype html>
<html lang="${t.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t.title}</title>
  <style>${styles}</style>
</head>
<body>
<main>
  <img class="logo" src="${logo}" alt="InPageEdit">
  ${body}
</main>
</body>
</html>`
}
