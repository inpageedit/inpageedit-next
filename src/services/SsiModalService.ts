import { Endpoints } from '@/constants/endpoints'
import { InPageEdit } from '@/InPageEdit'
import { SsiModal } from '@/types/SsiModal'

declare module '@/InPageEdit' {
  interface InPageEdit {
    modal: typeof SsiModal
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
      this.ctx.set('modal', module)
      this.modal = module
    })
  }

  protected stop(): void | Promise<void> {
    this.modal?.closeAll()
  }
}
