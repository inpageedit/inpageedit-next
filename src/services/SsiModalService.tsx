import { Endpoints } from '@/constants/endpoints'
import { InPageEdit } from '@/InPageEdit'
import { SsiModal, SsiModalOptions } from '@/types/SsiModal'

declare module '@/InPageEdit' {
  interface InPageEdit {
    modal: typeof SsiModal
  }
  interface Events {
    'modal/show'(payload: { modal: SsiModal }): void
    'modal/close'(payload: { modal: SsiModal }): void
  }
}

declare module '@/types/SsiModal' {
  interface SsiModal {
    setLoadingState: (state: boolean) => void
  }
}

export class SsiModalService {
  static readonly inject = ['resourceLoader']
  private modal?: typeof SsiModal

  constructor(public ctx: InPageEdit) {
    this.start()
    this.ctx.on('dispose', () => {
      this.stop()
    })
  }

  protected start(): void | Promise<void> {
    const { promise, resolve } = promiseWithResolvers<typeof SsiModal>()

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

  hackSsiModal(ssi: typeof SsiModal) {
    const that = this

    const init = ssi.proto.init
    ssi.proto.init = function () {
      console.log('init', this)
      this.options.className ||= ''
      this.options.className += ' in-page-edit theme-ipe'
      return init.call(this)
    }

    const show = ssi.proto.show
    ssi.proto.show = function () {
      that.ctx.emit('modal/show', { modal: this })
      return show.call(this)
    }

    const close = ssi.proto.close
    ssi.proto.close = function () {
      that.ctx.emit('modal/close', { modal: this })
      return close.call(this)
    }

    ssi.proto.setLoadingState = function (state: boolean) {
      this.get$window().toggleClass('loading', state)
      this.get$buttons().find('.ssi-modalBtn').prop('disabled', state)

      if (state) {
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
        this.get$window().find('#ssi-modalLoadingWrapper').remove()
      }
    }
  }
}
