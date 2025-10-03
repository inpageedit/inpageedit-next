import { JSX } from 'jsx-dom/jsx-runtime'
import styles from './styles.module.sass'

export type TwinSwapInputProps = {
  inputs: [TwinSwapInputInput, TwinSwapInputInput]
  enableSwap?: boolean
} & JSX.IntrinsicElements['div']

export interface TwinSwapInputInput {
  label?: string
  id?: string
  name: string
  value?: string
  disabled?: boolean
  required?: boolean
  inputProps?: Omit<JSX.IntrinsicElements['input'], 'name' | 'value'>
}

export type TwinSwapElement = HTMLDivElement & {
  swap: () => void
  toggleEnableSwap: (enable?: boolean) => void
}

export const TwinSwapInput = (props: TwinSwapInputProps) => {
  const { inputs, enableSwap = true, ...rest } = props

  const normalizedInputs =
    inputs?.length === 2
      ? inputs
      : ([inputs?.[0] ?? {}, inputs?.[1] ?? {}] as [TwinSwapInputInput, TwinSwapInputInput])

  // 内部稳定引用
  const inputRefs: [HTMLInputElement | null, HTMLInputElement | null] = [null, null]

  let swapCount = 0
  let swapBtnRef: HTMLButtonElement | null = null
  let svgRef: SVGElement | null = null

  const checkIfInputDisabled = () => inputRefs.some((el) => el && el.disabled)

  const swap = () => {
    if (!inputRefs[0] || !inputRefs[1]) return
    if (checkIfInputDisabled()) return

    const a = inputRefs[0]
    const b = inputRefs[1]
    const va = a.value
    const vb = b.value
    a.value = vb
    b.value = va

    // 与原实现一致：派发 change（不冒泡）
    a.dispatchEvent(new Event('change'))
    b.dispatchEvent(new Event('change'))

    swapCount++
    if (svgRef) {
      svgRef.style.transform = `rotateY(${swapCount * -180}deg)`
      svgRef.style.transition = 'transform 200ms ease'
    }
  }

  const toggleEnableSwap = (enable?: boolean) => {
    if (!swapBtnRef) return
    const next = enable ?? !swapBtnRef.disabled
    swapBtnRef.disabled = !next
    if (next) {
      // 与原实现一致：开启时把 inputs 解禁
      inputRefs.forEach((el) => {
        if (el) el.disabled = false
      })
    }
  }

  const swapButton = (
    <button
      type="button"
      aria-label="Swap values"
      onClick={swap}
      disabled={checkIfInputDisabled() || !enableSwap}
      ref={(el) => (swapBtnRef = el as HTMLButtonElement)}
    >
      <svg
        ref={(el) => (svgRef = el as unknown as SVGElement)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="icon-tabler icons-tabler-outline icon-tabler-transfer"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M20 10h-16l5.5 -6" />
        <path d="M4 14h16l-5.5 6" />
      </svg>
    </button>
  ) as HTMLButtonElement

  const container = (
    <div className={`twin-swap-input ${styles.twinSwapInput}`} {...rest}>
      {normalizedInputs.map((input, index) => {
        const { label, id, name, value, disabled, required, inputProps } = input
        const isLeft = index === 0
        const inputId = id || name

        return (
          <div
            className={`${styles.inputWrapper} ${isLeft ? styles.inputLeft : styles.inputRight}`}
          >
            {label && <label htmlFor={inputId}>{label}</label>}
            <input
              ref={(el) => (inputRefs[index] = el as HTMLInputElement)}
              type="text"
              id={inputId}
              name={name}
              value={value}
              disabled={disabled}
              required={required}
              {...inputProps}
            />
          </div>
        )
      })}

      <div className={styles.swapButton}>{swapButton}</div>
    </div>
  ) as TwinSwapElement

  container.swap = swap
  container.toggleEnableSwap = toggleEnableSwap

  return container
}
