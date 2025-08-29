import { JSX, ReactNode } from 'jsx-dom'

export const CheckBox = ({
  id,
  className,
  name,
  label,
  checked,
  inputProps,
  labelProps,
  children,
}: {
  id?: string
  className?: string
  name: string
  label?: string | HTMLElement
  checked?: boolean
  inputProps?: JSX.IntrinsicElements['input']
  labelProps?: JSX.IntrinsicElements['span']
  children?: ReactNode
}) => (
  <label className={className}>
    <input type="checkbox" id={id} name={name} checked={checked} {...inputProps} />
    <span className="ipe-checkbox-box"></span>
    <span {...labelProps}>{label || children}</span>
  </label>
)
