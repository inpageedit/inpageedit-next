import { JSX } from 'jsx-dom/jsx-runtime'

function copyText(str = '') {
  const t = document.createElement('textarea')
  t.value = str.toString()
  document.body.appendChild(t)
  t.select()
  document.execCommand('copy')
  t.remove()
}

const IconCopy = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon icon-tabler icons-tabler-outline icon-tabler-copy"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
    <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
  </svg>
)
const IconCopyCheck = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="icon icon-tabler icons-tabler-filled icon-tabler-copy-check"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M18.333 6a3.667 3.667 0 0 1 3.667 3.667v8.666a3.667 3.667 0 0 1 -3.667 3.667h-8.666a3.667 3.667 0 0 1 -3.667 -3.667v-8.666a3.667 3.667 0 0 1 3.667 -3.667zm-3.333 -4c1.094 0 1.828 .533 2.374 1.514a1 1 0 1 1 -1.748 .972c-.221 -.398 -.342 -.486 -.626 -.486h-10c-.548 0 -1 .452 -1 1v9.998c0 .32 .154 .618 .407 .805l.1 .065a1 1 0 1 1 -.99 1.738a3 3 0 0 1 -1.517 -2.606v-10c0 -1.652 1.348 -3 3 -3zm1.293 9.293l-3.293 3.292l-1.293 -1.292a1 1 0 0 0 -1.414 1.414l2 2a1 1 0 0 0 1.414 0l4 -4a1 1 0 0 0 -1.414 -1.414" />
  </svg>
)

export function CopyButton(
  props: {
    value: string | (() => string) | undefined
  } & Omit<JSX.IntrinsicElements['button'], 'value'>
) {
  const { value, ...rest } = props
  let timer: ReturnType<typeof setTimeout> | null = null
  let ref: HTMLButtonElement
  return (
    <button
      ref={(el) => (ref = el)}
      className="copy-button"
      onClick={(ev) => {
        ev.preventDefault()
        copyText(typeof value === 'function' ? value() : value?.toString())
        if (timer) {
          clearTimeout(timer)
        }
        ref.innerText = ''
        ref.appendChild(
          <>
            <IconCopyCheck />
            done
          </>
        )
        ref.classList.add('copied')
        timer = setTimeout(() => {
          ref.innerText = ''
          ref.appendChild(
            <>
              <IconCopy />
              copy
            </>
          )
          ref.classList.remove('copied')
          timer = null
        }, 1500)
      }}
      {...rest}
    >
      <IconCopy />
      copy
    </button>
  )
}
