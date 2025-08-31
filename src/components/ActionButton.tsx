import { JSX, ReactNode } from 'jsx-dom'

export const ActionButton = ({
  type,
  link,
  target,
  buttonProps,
  anchorProps,
  children,
}: {
  type?: 'primary' | 'secondary' | 'danger'
  link?: string
  target?: string
  anchorProps?: JSX.IntrinsicElements['a']
  buttonProps?: JSX.IntrinsicElements['button']
  children?: ReactNode
}) => {
  const button = (
    <button className={`btn btn-${type || 'default'}`} data-href={link} {...buttonProps}>
      {children}
    </button>
  )
  if (!link) {
    return button
  } else {
    return (
      <a href={link} target={target} {...anchorProps}>
        {button}
      </a>
    )
  }
}
