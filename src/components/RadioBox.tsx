import { JSX, ReactNode } from 'jsx-dom'

export type RadioBoxProps = {
  id?: string
  name: string
  value: string
  label?: string | HTMLElement
  inputProps?: JSX.IntrinsicElements['input']
  labelProps?: JSX.IntrinsicElements['span']
  children?: ReactNode
} & JSX.IntrinsicElements['label']

export const RadioBox = (props: RadioBoxProps) => {
  const { id, name, value, label, inputProps, labelProps, children, ...rest } = props
  return (
    <label className="theme-ipe ipe-radio-box" {...rest}>
      <input type="radio" id={id} name={name} value={value} {...inputProps} />
      <span className="ipe-checkbox-box"></span>
      <span {...labelProps}>{label || children}</span>
    </label>
  )
}
