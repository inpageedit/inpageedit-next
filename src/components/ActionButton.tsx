import { JSX, ReactNode } from 'jsx-dom'

export const ActionButton = ({
  type,
  link,
  buttonProps,
  children,
}: {
  type?: 'primary' | 'secondary' | 'danger'
  link?: string
  buttonProps?: JSX.IntrinsicElements['button']
  children?: ReactNode
}) => {
  return (
    <button
      className={`btn btn-${type || 'default'}`}
      data-href={link}
      onClick={(e) => {
        if (link) {
          e.preventDefault()
          location.href = link
        }
      }}
      {...buttonProps}
    >
      {children}
    </button>
  )
}
