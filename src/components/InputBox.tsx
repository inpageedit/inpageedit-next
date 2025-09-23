import { JSX } from 'jsx-dom'

export type InputBoxProps = {
  label: string
  id?: string
  name: string
  value?: string
  disabled?: boolean
  inputProps?: JSX.IntrinsicElements['input']
} & JSX.IntrinsicElements['div']

export const InputBox = (props: InputBoxProps) => {
  const { label, id, name, value, disabled, inputProps, ...rest } = props
  return (
    <div className="theme-ipe ipe-input-box" {...rest}>
      <label htmlFor={id} style={{ display: 'block' }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        {...inputProps}
        style={{ width: '100%' }}
      />
    </div>
  )
}
