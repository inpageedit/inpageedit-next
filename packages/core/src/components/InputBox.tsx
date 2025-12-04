import { JSX } from 'jsx-dom'

export type InputBoxProps = {
  label: string
  id?: string
  name: string
  value?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  labelProps?: JSX.IntrinsicElements['label']
  inputProps?: JSX.IntrinsicElements['input']
} & JSX.IntrinsicElements['div']

export const InputBox = (props: InputBoxProps) => {
  const {
    label,
    id,
    name,
    value,
    placeholder,
    disabled,
    required,
    labelProps,
    inputProps,
    children,
    ...rest
  } = props
  return (
    <div className="theme-ipe ipe-input-box" {...rest}>
      <label htmlFor={id} style={{ display: 'block' }} {...labelProps}>
        {label}
        {required && (
          <>
            {' '}
            <span className="required">*</span>
          </>
        )}
      </label>
      {children ?? (
        <input
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          style={{ width: '100%' }}
          {...inputProps}
        />
      )}
    </div>
  )
}
