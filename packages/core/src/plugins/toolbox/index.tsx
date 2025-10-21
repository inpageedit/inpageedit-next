import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { ReactElement } from 'jsx-dom'
import './styles.scss'

declare module '@/InPageEdit' {
  interface InPageEdit {
    toolbox: PluginToolbox
  }
  interface Events {
    'toolbox/button-added'(payload: { ctx: InPageEdit; button: HTMLElement }): void
    'toolbox/button-removed'(payload: { ctx: InPageEdit; id: string }): void
  }
}

@RegisterPreferences(
  Schema.object({
    toolboxAlwaysShow: Schema.boolean()
      .description('Make the toolbox opened by default')
      .default(false),
  }).description('Toolbox preferences')
)
@Inject(['preferences'])
export class PluginToolbox extends Service {
  container!: HTMLElement

  constructor(public ctx: InPageEdit) {
    super(ctx, 'toolbox', false)
  }

  protected async start(): Promise<void> {
    this.container = this.createToolbox()
    this.ctx.preferences.get('toolboxAlwaysShow').then((val) => {
      if (val) {
        this.container.classList.add('is-persistent')
      }
    })
    this.setupHoverLogic()
    document.body.appendChild(this.container)

    // 初始化时更新按钮延迟
    this.updateButtonDelays()
  }

  protected stop(): void | Promise<void> {
    this.container?.remove()
  }

  private setupHoverLogic() {
    let hoverTimeout: number | null = null

    // 检查是否处于持久化状态的辅助函数
    const isPersistent = () => {
      return this.container.classList.contains('is-persistent')
    }

    // 鼠标进入时暂时展开
    this.container.addEventListener('mouseenter', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }

      // 如果不在持久化状态，则添加hover展开效果
      if (!isPersistent()) {
        this.container.classList.add('is-hovered')
      }
    })

    // 鼠标离开时收起（如果不是持久化状态）
    this.container.addEventListener('mouseleave', () => {
      if (!isPersistent()) {
        hoverTimeout = window.setTimeout(() => {
          this.container.classList.remove('is-hovered')
        }, 150) // 延迟150ms收起，避免快速移动鼠标时闪烁
      }
    })
  }

  /**
   * 计算按钮动画延迟
   * @param index 按钮索引（从0开始）
   * @param totalCount 总按钮数量
   * @returns 延迟时间（秒）
   */
  private calculateButtonDelay(index: number, totalCount: number): number {
    if (totalCount <= 1) return 0

    // 总动画时长150ms = 0.15s
    const totalDuration = 0.15
    // 使用平方根函数创建非线性延迟，差值逐渐缩小
    const normalizedIndex = index / (totalCount - 1)
    const delay = totalDuration * Math.sqrt(normalizedIndex)

    return Math.round(delay * 1000) / 1000 // 保留3位小数
  }

  /**
   * 更新按钮组的动画延迟
   */
  private updateButtonDelays() {
    const btnGroups = this.container.querySelectorAll('.btn-group')

    btnGroups.forEach((group) => {
      const buttons = group.querySelectorAll('.btn-tip-group')
      const totalCount = buttons.length

      buttons.forEach((button, index) => {
        const delay = this.calculateButtonDelay(index, totalCount)
        ;(button as HTMLElement).style.setProperty('--transition-delay', `${delay}s`)
        ;(button as HTMLElement).style.setProperty('--max-transition-delay', '0.15s')
      })
    })
  }

  private createToolbox() {
    const toggler = (
      <button
        className="ipe-toolbox-btn"
        id="toolbox-toggler"
        onClick={() => {
          const isPersistent = this.container.classList.contains('is-persistent')
          const newPersistent = !isPersistent
          this.container.classList.toggle('is-persistent', newPersistent)
          this.ctx.preferences.set('toolboxAlwaysShow', newPersistent)
        }}
      >
        {/* Font Awesome 5 Solid: Plus */}
        <svg xmlns="http://www.w3.org/2000/svg" width="448" height="512" viewBox="0 0 448 512">
          <rect width="448" height="512" fill="none" />
          <path
            fill="currentColor"
            d="M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32"
          />
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

  private normalizeButtonId(id: string) {
    if (!id) {
      id = Math.random().toString(36).substring(2, 8)
    }
    return `ipe-toolbox__${id.trim()}`.replace(/\s\.#/g, '-')
  }

  addButton(payload: {
    id: string
    group?: 'auto' | 'group1' | 'group2'
    icon: string | HTMLElement | SVGElement | ReactElement
    tooltip?: string | HTMLElement
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
        <button id={`${id}-btn`} class="ipe-toolbox-btn" {...buttonProps}>
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

    this.ctx.emit('toolbox/button-added', {
      ctx: this.ctx,
      button: button as HTMLElement,
    })

    // 更新按钮延迟
    this.updateButtonDelays()

    return button as HTMLElement
  }

  removeButton(id: string) {
    const button = this.container.querySelector(`.ipe-toolbox-btn#${id}`)
    button?.remove()
    this.ctx.emit('toolbox/button-removed', { ctx: this.ctx, id })

    // 更新按钮延迟
    this.updateButtonDelays()
  }
}
