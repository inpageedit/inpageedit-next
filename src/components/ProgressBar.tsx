export const ProgressBar = () => {
  return (
    <div class="ipe-progress" style="width: 100%">
      <div class="ipe-progress-bar"></div>
    </div>
  )
}

export const setProgressBarToComplete = (el: HTMLElement) => {
  if (el.classList.contains('ipe-progress')) {
    el.classList.add('done')
  }
  return el
}
