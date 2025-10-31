import { h, JSX } from 'jsx-dom'

export interface ActionButtonProps {
  type?: 'primary' | 'secondary' | 'danger' | 'default'
  tag?: 'a' | 'button' | 'div'
}

const origin = window?.location?.origin

export const ActionButton = ({
  type,
  tag,
  href,
  target,
  children,
  ...rest
}: ActionButtonProps &
  Omit<JSX.IntrinsicElements['button'], 'type'> &
  JSX.IntrinsicElements['a']) => {
  tag = tag || (href ? 'a' : 'button')
  if (
    typeof target === 'undefined' &&
    href &&
    href.startsWith('http') &&
    !href.startsWith(origin)
  ) {
    target = '_blank'
  }
  return h(
    tag,
    {
      className: `theme-ipe ipe-action-button ipe-modal-btn is-${type || 'default'}`,
      // @ts-ignore
      href: tag === 'a' ? href : undefined,
      target: tag === 'a' ? target : undefined,
      'data-href': tag !== 'a' ? href : undefined,
      ...rest,
    },
    children
  )
}
