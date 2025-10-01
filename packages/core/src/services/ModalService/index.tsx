import { InPageEdit } from '@/InPageEdit'
import { IPEModal, IPEModalEvent } from './IPEModal.js'
export { IPEModalEvent }

declare module '@/InPageEdit' {
  export interface InPageEdit {
    modal: ModalService
  }
}

// Custom plugins
declare module './IPEModal' {
  interface IPEModal {
    setLoadingState(state: boolean): void
    [INPUTS_AND_BUTTONS_SYMBOL]: NodeListOf<HTMLInputElement | HTMLButtonElement>
  }
}
const INPUTS_AND_BUTTONS_SYMBOL = Symbol.for('inputsAndButtons')
IPEModal.prototype.setLoadingState = function (this: IPEModal, state: boolean) {
  this.get$window().classList.toggle('loading', state)

  // start loading
  if (state) {
    const inputsAndButtons = this.get$window().querySelectorAll<
      HTMLInputElement | HTMLButtonElement
    >('input:not([disabled]),button:not([disabled])')
    this[INPUTS_AND_BUTTONS_SYMBOL] = inputsAndButtons
    inputsAndButtons.forEach((el) => {
      el.disabled = true
    })
    this.get$content().append(
      <div
        id="ipe-modalLoadingWrapper"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          zIndex: 2000,
        }}
      >
        <ProgressBar style={{ width: '80%', maxWidth: '800px' }} />
      </div>
    )
  } else {
    // stop loading
    this.get$window().querySelector('#ipe-modalLoadingWrapper')?.remove()
    const inputsAndButtons = this[INPUTS_AND_BUTTONS_SYMBOL]
    if (inputsAndButtons) {
      inputsAndButtons.forEach((el) => {
        el.disabled = false
      })
    }
  }
}

export class ModalService {
  constructor(public ctx: InPageEdit) {
    ctx.set('modal', this)
  }
  IPEModal = IPEModal
  IPEModalEvent = IPEModalEvent
  show = IPEModal.show.bind(IPEModal)
  createObject = IPEModal.createObject.bind(IPEModal)
  close = IPEModal.close.bind(IPEModal)
  closeAll = IPEModal.closeAll.bind(IPEModal)
  removeAll = IPEModal.removeAll.bind(IPEModal)
  dialog = IPEModal.dialog.bind(IPEModal)
  confirm = IPEModal.confirm.bind(IPEModal)
  notify = IPEModal.notify.bind(IPEModal)
}
