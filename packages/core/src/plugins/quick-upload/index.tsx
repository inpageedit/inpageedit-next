import { Inject, InPageEdit } from '@/InPageEdit'

import './style.scss'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickUpload: PluginQuickUpload
  }
}

@Inject(['modal', '$', 'wikiTitle', 'wikiFile'])
export class PluginQuickUpload extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-upload')
  }
  protected async start() {
    this.injectQuickEdit()
    this.injectToolbox()
    this.ctx.set('quickUpload', this)
  }
  protected async stop() {}

  private injectQuickEdit() {}
  private injectToolbox() {
    const $ = this.ctx.$
    this.ctx.inject(['toolbox'], (ctx) => {
      ctx.toolbox.addButton({
        id: 'quick-upload',
        group: 'group2',
        index: 2,
        icon: 'UP',
        tooltip: () => $`Quick Upload`,
        onClick: (e) => {
          e.preventDefault()
          this.showModal()
        },
      })
      ctx.on('dispose', () => {
        ctx.toolbox.removeButton('quick-upload')
      })
    })
  }

  private _objectUrls = new WeakMap<File, string>()
  private getObjectUrl(file: File) {
    if (!this._objectUrls.has(file)) {
      const objUrl = URL.createObjectURL(file)
      this._objectUrls.set(file, objUrl)
    }
    return this._objectUrls.get(file)!
  }

  private formatFileSize(size: number = 0) {
    size = Number(size)
    if (!Number.isFinite(size) || size < 0) {
      return '0 B'
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let index = 0

    while (size >= 1024 && index < units.length - 1) {
      size /= 1024
      index++
    }

    // 使用 Intl 来格式化数字（自动处理千分位、小数等）
    const formatter = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    })

    return `${formatter.format(size)} ${units[index]}`
  }

  showModal() {
    const $ = this.ctx.$

    const modal = this.ctx.modal.show({
      className: 'ipe-quickUpload',
      sizeClass: 'dialog',
      center: false,
      title: $`Quick Upload`,
      content: $`Quick Upload`,
    })

    const handlePreview = async (file: File) => {
      if (!manualChangedFileName) {
        form.querySelector<HTMLInputElement>('input[name="filename"]')!.value = file.name
      }
      preview.textContent = ''
      const objUrl = this.getObjectUrl(file)
      let fileType = file.type.split('/')[0]
      if (file.type.includes('svg')) {
        fileType = 'image'
      }
      switch (fileType) {
        case 'image':
          preview.appendChild(<img src={objUrl} alt={file.name} />)
          break
        case 'video':
          preview.appendChild(<video src={objUrl} controls={true} />)
          break
        case 'audio':
          preview.appendChild(<audio src={objUrl} controls={true} />)
          break
        default:
          preview.appendChild(
            <div className="ipe-quickUpload__preview-placeholder">
              <span>N/A</span>
            </div>
          )
          break
      }
      preview.appendChild(
        <section className="ipe-quickUpload__preview-info">
          <ul>
            <li>
              <strong>{file.name}</strong>
            </li>
            <li>
              <i>{file.type}</i>
            </li>
            <li>{this.formatFileSize(file.size)}</li>
          </ul>
        </section>
      )
    }
    const handleSubmit = async (e: Event) => {
      e.preventDefault()
      const formData = new FormData(form)
      const file = formData.get('file') as File
      const filename = formData.get('filename') as string

      if (!file?.size || !filename) {
        this.ctx.modal.notify('warning', {
          title: $`Failed to upload`,
          content: $`File and filename are required.`,
        })
        return false
      }

      try {
        const result = await this.ctx.wikiFile.uploadFile(filename, file)
        console.info(result)
        this.ctx.modal.notify('success', {
          title: $`Upload successful`,
          content: $`File has been uploaded successfully.`,
        })
        return true
      } catch (e) {
        this.ctx.logger.error(e)
        this.ctx.modal.notify('error', {
          title: $`Upload failed`,
          content: $`File has not been uploaded.`,
        })
        return false
      }
    }

    let manualChangedFileName = false
    const form = (
      <form onSubmit={handleSubmit} className="ipe-quickUpload__form">
        <InputBox
          label={$`File name`}
          name="filename"
          id="filename"
          inputProps={{
            onInput: () => {
              manualChangedFileName = true
            },
          }}
        />
        <div className="ipe-input-box">
          <label htmlFor="file">{$`File`}</label>
          <input
            onChange={(e: Event) => {
              const file = (e.target as HTMLInputElement)?.files?.[0]
              if (file?.size) {
                handlePreview(file)
              }
            }}
            type="file"
            name="file"
            id="file"
            accept="image/*,video/*,audio/*,application/pdf"
          />
        </div>
      </form>
    ) as HTMLFormElement

    const preview = (
      <div
        className="ipe-quickUpload__preview"
        onClick={(e) => {
          const target = e.target
          if (
            target &&
            (target as HTMLElement).closest('img, .ipe-quickUpload__preview-placeholder')
          ) {
            e.preventDefault()
            form.querySelector<HTMLInputElement>('input[type="file"]')!.click()
          }
        }}
      >
        <div className="ipe-quickUpload__preview-placeholder"></div>
      </div>
    )

    modal.setContent(
      <section>
        {preview}
        {form}
      </section>
    )

    modal.setButtons([
      {
        label: $`Upload`,
        className: 'is-primary is-text',
        method: (e) => {
          form.dispatchEvent(new Event('submit'))
        },
      },
    ])

    return modal
  }
}
