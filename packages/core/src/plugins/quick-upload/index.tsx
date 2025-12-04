import { Inject, InPageEdit, Schema } from '@/InPageEdit'

import './style.scss'
import { UploadFileResult } from '@/services/WikiFileService'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickUpload: PluginQuickUpload
  }
  interface Preferences {
    'quickUpload.summary': string
  }
}

const PreviewPlaceholderNA = ({ $ }: { $: (strings: TemplateStringsArray) => string }) => (
  <div className="ipe-quickUpload__preview-placeholder is-na">
    <span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="icon icon-tabler icons-tabler-filled icon-tabler-file-unknown"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm0 15a1 1 0 0 0 -.993 .883l-.007 .127a1 1 0 0 0 1.993 .117l.007 -.127a1 1 0 0 0 -1 -1m1.136 -5.727a2.5 2.5 0 0 0 -3.037 .604a1 1 0 0 0 1.434 1.389l.088 -.09a.5 .5 0 1 1 .379 .824a1 1 0 0 0 -.002 2a2.5 2.5 0 0 0 1.137 -4.727" />
        <path d="M19 7h-4l-.001 -4.001z" />
      </svg>
      <p>{$`No preview available`}</p>
    </span>
  </div>
)

@RegisterPreferences(
  Schema.object({
    'quickUpload.summary': Schema.string()
      .description('Default summary of the quick upload')
      .default('[IPE-NEXT] Quick upload'),
  })
)
@Inject(['modal', '$', 'wikiTitle', 'wikiFile', 'quickPreview', 'preferences'])
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
        icon: <IconUpload />,
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

  private getDefaultPreviewPlaceholder() {
    const $ = this.ctx.$
    return (
      <div className="ipe-quickUpload__preview-placeholder">
        <span>
          <IconUpload />
          <p>{$`Drag & drop a file here`}</p>
        </span>
      </div>
    )
  }

  async showModal() {
    const $ = this.ctx.$

    const modal = this.ctx.modal.show({
      className: 'ipe-quickUpload compact-buttons',
      sizeClass: 'smallToMedium',
      center: false,
      title: $`Quick Upload`,
      content: $`Quick Upload`,
      outSideClose: false,
    })

    let isUploading = false
    const resetForm = () => {
      formEl.reset()
      handlePreview()
      isInputFileName = false
    }
    const handlePreview = async (file?: File) => {
      previewWrapper.innerHTML = ''
      if (!file) {
        previewWrapper.appendChild(this.getDefaultPreviewPlaceholder())
        return
      }
      if (!isInputFileName) {
        formEl.querySelector<HTMLInputElement>('input[name="filename"]')!.value = file.name
      }
      const previewEl = (await this.ctx.quickPreview.getPreviewElement(file)) || (
        <PreviewPlaceholderNA $={$} />
      )
      previewWrapper.appendChild(
        <div className="ipe-quickUpload__preview-content">{previewEl}</div>
      )
      previewWrapper.appendChild(
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
      if (isUploading) {
        return false
      }

      const formData = new FormData(formEl)
      const body = Object.fromEntries(formData.entries())

      isUploading = true
      modal.setLoadingState(true)

      try {
        const result = await this.ctx.wikiFile.upload(body)
        this.logger.debug(result)

        if (result.data?.upload?.result === 'Success') {
          this.ctx.modal.notify('success', {
            title: $`Upload successful`,
            content: $`File has been uploaded successfully.`,
          })
          resetForm()
          return true
        }

        // Handle errors
        throw result
      } catch (e) {
        this.ctx.logger.error(e)

        if ((e as any)?.data?.upload) {
          const uploadResult = (e as any).data.upload as UploadFileResult
          if (
            Array.isArray(uploadResult.warnings?.duplicate) &&
            uploadResult.warnings.duplicate.length > 0
          ) {
            this.ctx.modal.dialog({
              title: $`File duplicated`,
              content: (
                <span
                  innerHTML={$({
                    title: `File:${uploadResult.warnings.duplicate[0]}`,
                  })`This file is duplicated with {{ getWikiLink(title, title, true) }}.`}
                ></span>
              ),
            })
            return false
          }
          if (uploadResult.warnings?.exists) {
            this.ctx.modal.dialog({
              title: $`File already exists`,
              content: $`There is a file with the same name already exists.`,
            })
            return false
          }
        }

        this.ctx.modal.dialog({
          title: $`Upload failed`,
          content: e instanceof Error ? e.message : $`Upload failed with unknown error.`,
        })
        return false
      } finally {
        modal.setLoadingState(false)
        isUploading = false
      }
    }
    const isFileAccepted = (file: File, accept: string): boolean => {
      if (!accept) return true
      const rules = accept
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!rules.length) return true
      const fileType = file.type || ''
      const fileName = file.name || ''
      return rules.some((rule) => {
        // extension: .png .pdf
        if (rule.startsWith('.')) {
          return fileName.toLowerCase().endsWith(rule.toLowerCase())
        }
        // image/*, video/* ...
        if (rule.endsWith('/*')) {
          const prefix = rule.slice(0, -1) // keep the trailing slash
          return fileType.startsWith(prefix)
        }
        // exact mime
        return fileType === rule
      })
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget as HTMLElement
      container?.classList.remove('is-dragover')
      const fileInput = formEl.querySelector<HTMLInputElement>('input[type="file"]')
      if (!fileInput) return
      const files = Array.from(e.dataTransfer?.files || [])
      if (!files.length) return
      const accept = fileInput.accept || ''
      const picked = files.find((f) => isFileAccepted(f, accept)) || null
      if (!picked) {
        // 不符合 accept 的文件，不做处理
        return
      }
      const dt = new DataTransfer()
      dt.items.add(picked)
      fileInput.files = dt.files
      // 触发原有 onChange 逻辑（包含预览）
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget as HTMLElement
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
      container?.classList.add('is-dragover')
    }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget as HTMLElement
      container?.classList.remove('is-dragover')
    }

    let isInputFileName = false
    const formEl = (
      <form onSubmit={handleSubmit} className="ipe-quickUpload__form">
        <InputBox
          label={$`File name`}
          name="filename"
          id="filename"
          placeholder="Example.jpg"
          required={true}
          inputProps={{
            onInput: () => {
              isInputFileName = true
            },
          }}
        />
        <InputBox label={$`File`} name="file" id="file" required>
          <input
            required
            type="file"
            name="file"
            id="file"
            accept="image/*,video/*,audio/*,application/pdf"
            onChange={(e: Event) => {
              const file = (e.target as HTMLInputElement)?.files?.[0]
              if (file?.size) {
                handlePreview(file)
              }
            }}
          />
        </InputBox>
        <InputBox
          label={$`Summary`}
          id="summary"
          // DO NOT CHANGE:
          // 虽然文案是 summary，但其实 API 里是 comment
          name="comment"
          placeholder="Upload file from ..."
          value={(await this.ctx.preferences.get('quickUpload.summary')) || ''}
        />
        <div className="ipe-input-box">
          <label htmlFor="text">{$`File description`}</label>
          <textarea
            name="text"
            id="text"
            placeholder={'This file is for...\n[[Category:XXX]]'}
          ></textarea>
        </div>
        <CheckBox name="ignorewarnings" label={$`Ignore warnings`} />
      </form>
    ) as HTMLFormElement

    const previewWrapper = (
      <div
        className="ipe-quickUpload__preview"
        onClick={(e) => {
          const target = e.target
          if (
            target &&
            (target as HTMLElement).closest('img, .ipe-quickUpload__preview-placeholder')
          ) {
            e.preventDefault()
            formEl.querySelector<HTMLInputElement>('input[type="file"]')!.click()
          }
        }}
      >
        {this.getDefaultPreviewPlaceholder()}
      </div>
    )

    const containerEl = (
      <section
        className="ipe-quickUpload__container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {previewWrapper}
        {formEl}
      </section>
    ) as HTMLElement

    modal.setContent(containerEl)

    modal.setButtons([
      {
        label: $`Cancel`,
        className: 'is-danger is-text',
        method: (e) => {
          modal.close()
        },
      },
      {
        label: $`Upload`,
        className: 'is-primary is-text',
        method: (e) => {
          formEl.requestSubmit()
        },
      },
    ])

    return modal
  }
}
