import { JSX } from 'vue/jsx-runtime'
import styles from './styles.module.sass'

export const ProgressBar = (
  attrs: JSX.IntrinsicElements['div'] & { indeterminate?: boolean; progress?: number }
) => {
  const indeterminate = attrs.indeterminate ?? true
  const bar = (
    <div
      class={`${styles.ipe_progress}`}
      data-indeterminate={`${indeterminate}`}
      // @ts-ignore
      style={{ width: '100%', '--progress': attrs.progress ? `${attrs.progress}%` : '0%' }}
      {...attrs}
    ></div>
  ) as HTMLElement & { setProgress: (progress: number) => void }
  bar.setProgress = (progress: number | undefined) => {
    if (typeof progress === 'number') {
      bar.dataset.indeterminate = 'false'
      bar.style.setProperty('--progress', `${progress}%`)
    } else {
      bar.dataset.indeterminate = 'true'
      bar.style.setProperty('--progress', '0%')
    }
  }
  return bar
}
