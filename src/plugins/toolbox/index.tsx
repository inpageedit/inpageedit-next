import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'

declare module '@/InPageEdit' {
  interface InPageEdit {
    toolbox: PluginToolbox
  }
  interface Events {
    'toolbox/button/added'(payload: { ctx: InPageEdit; button: HTMLElement }): void
    'toolbox/button/removed'(payload: { ctx: InPageEdit; id: string }): void
  }
}

@RegisterPreferences(
  Schema.object({
    toolboxAlwaysShow: Schema.boolean().description('Make the toolbox opened by default'),
  }),
  {
    toolboxAlwaysShow: false,
  }
)
@Inject(['preferences'])
export class PluginToolbox extends Service {
  container!: HTMLElement
  private forceShow = false

  constructor(public ctx: InPageEdit) {
    super(ctx, 'toolbox', false)
  }

  protected async start(): Promise<void> {
    if (mw && mw.config.get('wgIsArticle') === false && !this.forceShow) {
      this.container = this.createIndicatorForNotArticlePage()
    } else {
      this.container = this.createToolbox()
    }
    document.body.appendChild(this.container)
    await sleep(0) // wait nextTick
    this.ctx.preferences.get('toolboxAlwaysShow').then((val) => {
      if (val) {
        this.container.querySelector('#toolbox-toggle')?.classList.add('opened')
        this.container.querySelectorAll('.btn-group').forEach((el) => {
          el.classList.add('opened')
        })
      }
    })
  }

  protected stop(): void | Promise<void> {
    this.container?.remove()
  }

  private createToolbox() {
    const toggler = (
      <button
        className="ipe-toolbox-btn"
        id="toolbox-toggle"
        onClick={function (e) {
          const isOpened = this.classList.contains('opened')
          this.classList.toggle('opened', !isOpened)
          element.querySelectorAll('.btn-group').forEach((el) => {
            el.classList.toggle('opened', !isOpened)
          })
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-plus"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M12 5l0 14" />
          <path d="M5 12l14 0" />
        </svg>
      </button>
    )
    const element = (
      <div id="ipe-edit-toolbox">
        <ul className="btn-group group1" style={{ display: 'flex', flexDirection: 'column' }}></ul>
        <ul className="btn-group group2" style={{ display: 'flex', flexDirection: 'row' }}></ul>
        {toggler}
      </div>
    )

    return element as HTMLElement
  }

  private createIndicatorForNotArticlePage() {
    const indicator = (
      <div id="ipe-edit-toolbox">
        <div
          id="ipe-toolbox-placeholder"
          style="width: 0.75rem; height: 0.75rem; border-radius: 50%; background: #3f51b5; color: #fff; pointer-events: none;"
        >
          <svg
            style="width: 0.5em; height: 0.5em; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon icon-tabler icons-tabler-outline icon-tabler-check"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M5 12l5 5l10 -10" />
          </svg>
        </div>
      </div>
    )
    return indicator as HTMLElement
  }

  private normalizeButtonId(id: string) {
    if (!id) {
      id = Math.random().toString(36).substring(2, 8)
    }
    return `ipe-toolbox__${id.trim()}`.replace(/\s\.#/g, '-')
  }

  addButton(payload: {
    id: string
    group?: 'auto' | 'group1' | 'group2'
    icon: string | HTMLElement | JQuery
    tooltip?: string | HTMLElement | JQuery
    buttonProps?: Record<string, any>
    onClick?: (event: MouseEvent) => void
    index?: number
  }) {
    let { id, group, icon, tooltip, buttonProps, onClick, index } = payload
    id = this.normalizeButtonId(id)

    const existingButton = this.container.querySelector(`#${id}`)
    if (existingButton) {
      this.ctx.logger('toolbox').warn(`Button with id ${id} already exists, replacing it.`)
      existingButton.remove()
    }

    let groupEl: HTMLElement | null = null
    if (typeof group === 'undefined' || group === 'auto') {
      // 选择按钮最少的那一组，一样多就选第一组
      const group1 = this.container.querySelector('.btn-group.group1') as HTMLElement
      const group2 = this.container.querySelector('.btn-group.group2') as HTMLElement
      const group1Count = group1?.children.length || 0
      const group2Count = group2?.children.length || 0
      groupEl = group1Count <= group2Count ? group1 : group2
    } else {
      groupEl = this.container.querySelector(`.btn-group.${group}`)
    }
    if (!groupEl) throw new Error(`Button group ${group} not found`)

    const button = (
      <li class="btn-tip-group" id={id} onClick={onClick}>
        <div class="btn-tip">{tooltip}</div>
        <button id="edit-btn" class="ipe-toolbox-btn" {...buttonProps}>
          {icon}
        </button>
      </li>
    )

    if (typeof index === 'number') {
      if (index <= 0) {
        groupEl.prepend(button)
      } else if (index >= groupEl.children.length) {
        groupEl.appendChild(button)
      } else {
        groupEl.children[index]?.before(button)
      }
    } else {
      groupEl.appendChild(button)
    }

    this.ctx.emit('toolbox/button/added', {
      ctx: this.ctx,
      button: button as HTMLElement,
    })

    return button as HTMLElement
  }

  removeButton(id: string) {
    const button = this.container.querySelector(`.ipe-toolbox-btn#${id}`)
    button?.remove()
    this.ctx.emit('toolbox/button/removed', { ctx: this.ctx, id })
  }
}
