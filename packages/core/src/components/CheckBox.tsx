import { JSX } from 'jsx-dom'

export type CheckBoxProps = {
  id?: string
  name: string
  label?: string | HTMLElement
  checked?: boolean
  inputProps?: JSX.IntrinsicElements['input']
  labelProps?: JSX.IntrinsicElements['span']
} & JSX.IntrinsicElements['label']

export const CheckBox = (props: CheckBoxProps) => {
  const { id, name, label, checked, inputProps, labelProps, children, ...rest } = props
  return (
    <label className="theme-ipe ipe-checkbox" {...rest}>
      <input type="checkbox" id={id} name={name} checked={checked} {...inputProps} />
      <span className="ipe-checkbox-box"></span>
      <span {...labelProps}>{label || children}</span>
    </label>
  )
}
