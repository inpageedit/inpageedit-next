import { InPageEdit } from '@/InPageEdit'

type LibSsiModal = typeof ssi_modal

declare module '@/InPageEdit' {
  interface InPageEdit {
    modal: LibSsiModal
  }
  interface Events {
    'modal/show'(payload: { modal: SsiModal }): void
    'modal/close'(payload: { modal: SsiModal }): void
  }
}

declare global {
  namespace SsiModal {
    interface SsiModal {
      /**
       * Toggle a visual loading overlay & disable buttons inside the modal
       */
      setLoadingState(state: boolean): void
    }
  }
}

export class SsiModalService {
  static readonly inject = ['resourceLoader']
  private modal?: typeof ssi_modal

  constructor(public ctx: InPageEdit) {
    this.start()
    this.ctx.on('dispose', () => {
      this.stop()
    })
  }

  protected start(): void | Promise<void> {
    const { promise, resolve } = Promise.withResolvers<LibSsiModal>()

    if (window.ssi_modal && typeof window.ssi_modal.show === 'function') {
      resolve(window.ssi_modal)
    } else {
      this.ctx.resourceLoader.loadStyle(`${Endpoints.PLUGIN_CDN_BASE}/lib/ssi-modal/ssi-modal.css`)
      this.ctx.resourceLoader
        .loadScript(`${Endpoints.PLUGIN_CDN_BASE}/lib/ssi-modal/ssi-modal.js`, {
          async: '',
        })
        .then(() => {
          resolve(window.ssi_modal)
        })
    }

    return promise.then((module) => {
      this.hackSsiModal(module)
      this.ctx.set('modal', module)
      this.modal = module
    })
  }

  protected stop(): void | Promise<void> {
    this.modal?.closeAll()
  }

  hackSsiModal(ssiModalLib: LibSsiModal) {
    const that = this

    const init = ssiModalLib.proto.init
    ssiModalLib.proto.init = function () {
      console.log('init', this)
      this.options.className ||= ''
      this.options.className += ' in-page-edit theme-ipe'
      return init.call(this)
    }

    const show = ssiModalLib.proto.show
    ssiModalLib.proto.show = function () {
      that.ctx.emit('modal/show', { modal: this })
      return show.call(this)
    }

    const close = ssiModalLib.proto.close
    ssiModalLib.proto.close = function () {
      that.ctx.emit('modal/close', { modal: this })
      return close.call(this)
    }
    ssiModalLib.proto.setLoadingState = function (this: SsiModal, state: boolean) {
      this.get$window().toggleClass('loading', state)

      // start loading
      if (state) {
        const inputsAndButtons = this.get$window().find('input:not([disabled]),button:not([disabled])')
        this.get$modal().data('inputsAndButtons', inputsAndButtons)
        inputsAndButtons.prop('disabled', true)
        this.get$window().append(
          <div
            id="ssi-modalLoadingWrapper"
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
        this.get$window().find('#ssi-modalLoadingWrapper').remove()
        const inputsAndButtons = this.get$modal().data('inputsAndButtons')
        if (inputsAndButtons) {
          inputsAndButtons.prop('disabled', false)
        }
      }
    }

    return ssiModalLib
  }
}
