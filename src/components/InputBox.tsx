import { JSX } from 'jsx-dom'

export type InputBoxProps = {
  label: string
  id?: string
  name: string
  value?: string
  disabled?: boolean
  labelProps?: JSX.IntrinsicElements['label']
  inputProps?: JSX.IntrinsicElements['input']
} & JSX.IntrinsicElements['div']

export const InputBox = (props: InputBoxProps) => {
  const { label, id, name, value, disabled, labelProps, inputProps, ...rest } = props
  return (
    <div className="theme-ipe ipe-input-box" {...rest}>
      <label htmlFor={id} style={{ display: 'block' }} {...labelProps}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        style={{ width: '100%' }}
        {...inputProps}
      />
    </div>
  )
}
