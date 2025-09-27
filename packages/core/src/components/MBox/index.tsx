import { ReactNode } from 'jsx-dom'
import { JSX } from 'jsx-dom/jsx-runtime'
import styles from './styles.module.sass'

export type MBoxProps = {
  type?:
    | ''
    | 'default'
    | 'note'
    | 'info'
    | 'tip'
    | 'success'
    | 'important'
    | 'done'
    | 'warning'
    | 'caution'
    | 'error'
  title?: ReactNode
  content?: ReactNode
  closeable?: boolean
  titleProps?: JSX.IntrinsicElements['div']
  contentProps?: JSX.IntrinsicElements['div']
} & JSX.IntrinsicElements['div']

export type MBoxElement = HTMLElement & {
  close: () => Promise<void>
}

export const MBox = (props: MBoxProps) => {
  const {
    type = 'default',
    title,
    content,
    closeable = true,
    titleProps,
    contentProps,
    children,
    ...rest
  } = props
  let titleContent = title
  if (typeof title === 'undefined' && type !== 'default') {
    titleContent = type[0].toUpperCase() + type.slice(1).toLowerCase()
  }

  const close = async () => {
    if (!box) {
      return Promise.resolve()
    }
    const { promise, resolve } = Promise.withResolvers<void>()

    const animation = box.animate(
      [
        { opacity: '1', height: box.clientHeight + 'px' },
        { opacity: '0', height: '0px', margin: '0px' },
      ],
      {
        duration: 300,
        easing: 'ease',
      }
    )

    animation.addEventListener('finish', () => {
      box.remove()
      resolve()
    })

    return promise
  }

  const box = (
    <div className={`theme-ipe ipe-mbox mbox-type-${type || 'default'} ${styles.mbox}`} {...rest}>
      {titleContent && (
        <div className={`ipe-mbox-title ${styles.title}`} {...titleProps}>
          {titleContent}
        </div>
      )}
      <div className={`ipe-mbox-content ${styles.content}`} {...contentProps}>
        {children || content}
      </div>
      {closeable && (
        <a onClick={close} className={`ipe-mbox-close ${styles.close}`}>
          ×
        </a>
      )}
    </div>
  ) as MBoxElement
  box.close = close
  return box
}
