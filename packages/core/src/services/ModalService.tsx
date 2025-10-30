import { InPageEdit } from '@/InPageEdit'
import { IPEModal, IPEModalEvent, IPEModalOptions } from '@inpageedit/modal'
import '@inpageedit/modal/style.css'

export * from '@inpageedit/modal'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    modal: ModalService
  }
}

// Custom plugins
export class CustomIPEModal extends IPEModal {
  constructor(options: Partial<IPEModalOptions> = {}) {
    options.className ||= ''
    options.className += ' theme-ipe'
    options.modalAnimation ||= {
      show: 'ipe-modal-fade-in',
      hide: 'ipe-modal-fade-out',
    }
    super(options)
  }

  private _tmpDisabledActiveInputs?: NodeListOf<HTMLInputElement | HTMLButtonElement>
  setLoadingState(state: boolean) {
    this.get$window().classList.toggle('loading', state)
    // start loading
    if (state) {
      const activeInputs = this.get$window().querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        'input:not([disabled]),button:not([disabled])'
      )
      this._tmpDisabledActiveInputs = activeInputs
      activeInputs.forEach((el) => {
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
      const activeInputs = this._tmpDisabledActiveInputs
      if (activeInputs) {
        activeInputs.forEach((el) => {
          el.disabled = false
        })
      }
    }
  }
}

export class ModalService {
  constructor(public ctx: InPageEdit) {
    ctx.set('modal', this)
    ctx.on('dispose', () => {
      CustomIPEModal.closeAll()
    })
  }
  IPEModal = CustomIPEModal
  IPEModalEvent = IPEModalEvent
  show = CustomIPEModal.show.bind(CustomIPEModal) as (
    ...args: Parameters<typeof CustomIPEModal.show>
  ) => CustomIPEModal
  createObject = CustomIPEModal.createObject.bind(CustomIPEModal) as (
    ...args: Parameters<typeof CustomIPEModal.createObject>
  ) => CustomIPEModal
  close = CustomIPEModal.close.bind(CustomIPEModal)
  closeAll = CustomIPEModal.closeAll.bind(CustomIPEModal)
  removeAll = CustomIPEModal.removeAll.bind(CustomIPEModal)
  dialog = CustomIPEModal.dialog.bind(CustomIPEModal) as (
    ...args: Parameters<typeof CustomIPEModal.dialog>
  ) => CustomIPEModal
  confirm = CustomIPEModal.confirm.bind(CustomIPEModal) as (
    ...args: Parameters<typeof CustomIPEModal.confirm>
  ) => CustomIPEModal
  notify = CustomIPEModal.notify.bind(CustomIPEModal) as (
    ...args: Parameters<typeof CustomIPEModal.notify>
  ) => CustomIPEModal
}
