import { JSX, ReactNode } from 'jsx-dom'

export const RadioBox = ({
  id,
  className,
  name,
  value,
  label,
  inputProps,
  labelProps,
  children,
}: {
  id?: string
  className?: string
  name: string
  value: string
  label?: string | HTMLElement
  inputProps?: JSX.IntrinsicElements['input']
  labelProps?: JSX.IntrinsicElements['span']
  children?: ReactNode
}) => (
  <label className={className}>
    <input type="radio" id={id} name={name} value={value} {...inputProps} />
    <span className="ipe-checkbox-box"></span>
    <span {...labelProps}>{label || children}</span>
  </label>
)
